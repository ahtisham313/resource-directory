import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/authorization";
import { mappedValues } from "@/modules/resources/project-resource";
import { parseSurveyDefinition } from "@/modules/surveys/survey-definition";
import {
  surveyAnswersSchema,
  surveySnapshotSchema,
} from "@/modules/surveys/survey-snapshot";
import {
  responseFiltersSchema,
  responseIdSchema,
  ReviewError,
} from "./review-types";

export const responseSelect = {
  id: true,
  surveyId: true,
  surveyVersionId: true,
  answers: true,
  uploadedImageKey: true,
  status: true,
  createdAt: true,
  reviewerId: true,
  reviewedAt: true,
  reviewNote: true,
  reviewer: { select: { name: true, email: true } },
  surveyVersion: { select: { snapshot: true, versionNumber: true } },
  resource: {
    select: { id: true, active: true, latitude: true, longitude: true },
  },
} satisfies Prisma.SurveyResponseSelect;

async function preserveReviewerNames<
  T extends { id: string; reviewer: { name: string; email: string } | null },
>(rows: T[], db: Prisma.TransactionClient) {
  const missing = rows.filter((row) => !row.reviewer).map((row) => row.id);
  if (!missing.length) return rows;
  const logs = await db.auditLog.findMany({
    where: {
      action: "REVIEWER_REMOVED",
      entityType: "SurveyResponse",
      entityId: { in: missing },
    },
    select: { entityId: true, metadata: true },
  });
  const identities = new Map<string, { name: string; email: string }>();
  for (const log of logs) {
    const parsed = z
      .object({ reviewer: z.object({ name: z.string(), email: z.string() }) })
      .safeParse(log.metadata);
    if (parsed.success) identities.set(log.entityId, parsed.data.reviewer);
  }
  return rows.map((row) => ({
    ...row,
    reviewer: row.reviewer ?? identities.get(row.id) ?? null,
  }));
}

function responseIdentity(
  row: Prisma.SurveyResponseGetPayload<{ select: typeof responseSelect }>,
) {
  const snapshot = surveySnapshotSchema.safeParse(row.surveyVersion.snapshot);
  const answers = surveyAnswersSchema.safeParse(row.answers);
  if (!snapshot.success || !answers.success)
    return {
      title: "Submission with an unreadable definition",
      provider: "",
      categories: [] as string[],
    };
  const title = mappedValues(snapshot.data, answers.data, "TITLE")[0];
  const provider =
    mappedValues(snapshot.data, answers.data, "PROVIDER_NAME")[0] ?? "";
  return {
    title: title || provider || "Unnamed submission",
    provider,
    categories: mappedValues(snapshot.data, answers.data, "CATEGORY"),
  };
}

export async function listResponses(input: unknown) {
  await requireAdmin();
  const parsed = responseFiltersSchema.safeParse(input);
  if (!parsed.success)
    throw new ReviewError(400, "Choose a valid status, search term, and page.");
  const filters = parsed.data;
  const pattern = `%${filters.q.replace(/[\\%_]/g, "\\$&")}%`;
  // Match stored values and their original option labels, using mappings from each historical snapshot.
  const where = Prisma.sql`
    (${filters.status} = 'ALL' OR r.status::text = ${filters.status})
    AND (${filters.q} = '' OR EXISTS (
      SELECT 1 FROM jsonb_path_query(v.snapshot, '$.sections[*].fields[*] ? (@.displayMapping == "TITLE" || @.displayMapping == "PROVIDER_NAME" || @.displayMapping == "CATEGORY")') AS mapped(field)
      WHERE (r.answers -> (field ->> 'fieldKey') -> 'value')::text ILIKE ${pattern}
        OR (r.answers -> (field ->> 'fieldKey') ->> 'otherText') ILIKE ${pattern}
        OR EXISTS (
          SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(field -> 'options') = 'array' THEN field -> 'options' ELSE '[]'::jsonb END) AS choices(option)
          WHERE option ->> 'label' ILIKE ${pattern}
            AND ((r.answers -> (field ->> 'fieldKey') -> 'value') = (option -> 'value')
              OR (r.answers -> (field ->> 'fieldKey') -> 'value') @> jsonb_build_array(option -> 'value'))
        )
    ))`;
  return getDb().$transaction(
    async (tx) => {
      const counts = await tx.$queryRaw<Array<{ total: number }>>(
        Prisma.sql`SELECT count(*)::int AS total FROM "SurveyResponse" r JOIN "SurveyVersion" v ON v.id = r."surveyVersionId" WHERE ${where}`,
      );
      const total = counts[0]?.total ?? 0;
      const pages = Math.max(1, Math.ceil(total / 10));
      const page = Math.min(filters.page, pages);
      const ids = await tx.$queryRaw<Array<{ id: string }>>(
        Prisma.sql`SELECT r.id FROM "SurveyResponse" r JOIN "SurveyVersion" v ON v.id = r."surveyVersionId" WHERE ${where} ORDER BY r."createdAt" DESC, r.id DESC LIMIT 10 OFFSET ${(page - 1) * 10}`,
      );
      const rows = await tx.surveyResponse.findMany({
        where: { id: { in: ids.map((row) => row.id) } },
        select: responseSelect,
      });
      const attributed = await preserveReviewerNames(rows, tx);
      const byId = new Map(attributed.map((row) => [row.id, row]));
      return {
        filters: { ...filters, page },
        total,
        pages,
        rows: ids.flatMap(({ id }) => {
          const row = byId.get(id);
          return row
            ? [
                {
                  id: row.id,
                  ...responseIdentity(row),
                  createdAt: row.createdAt,
                  status: row.status,
                  reviewer: row.reviewer,
                  reviewedAt: row.reviewedAt,
                },
              ]
            : [];
        }),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}

export async function getResponseDetails(id: string) {
  await requireAdmin();
  if (!responseIdSchema.safeParse(id).success)
    throw new ReviewError(404, "Response not found.");
  const row = await getDb().surveyResponse.findUnique({
    where: { id },
    select: responseSelect,
  });
  if (!row) throw new ReviewError(404, "Response not found.");
  try {
    const snapshot = parseSurveyDefinition(
      row.surveyVersion.snapshot,
      row.surveyId,
    );
    const answers = surveyAnswersSchema.parse(row.answers);
    const [attributed] = await preserveReviewerNames([row], getDb());
    return { ...attributed, snapshot, answers, ...responseIdentity(row) };
  } catch {
    throw new ReviewError(
      422,
      "This submission's stored definition or answers could not be read. Review its survey version before continuing.",
    );
  }
}
