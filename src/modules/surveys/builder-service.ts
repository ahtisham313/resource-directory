import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isImageStorageConfigured } from "@/lib/image-storage";
import { AuthorizationError, requireAdmin } from "@/modules/auth/authorization";
import { resolveApprovalCategories } from "@/modules/responses/approval-projection";
import { readDraftDefinition, snapshotFromDraft } from "./snapshot-from-draft";
import { surveyIdSchema } from "./survey-definition";
import {
  actionSchema,
  createSurveySchema,
  draftDefinitionSchema,
  publicationIssues,
  saveDraftSchema,
  SurveyBuilderError,
  type SurveyDraft,
} from "./builder-schema";

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);
  if (!result.success)
    throw new SurveyBuilderError(
      422,
      "Please check the survey settings.",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  return result.data;
}
function checkId(id: string) {
  if (!surveyIdSchema.safeParse(id).success)
    throw new SurveyBuilderError(404, "Survey not found.");
}
async function lockAdmin(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM "AdminUser" WHERE id = ${id} AND status = 'ACTIVE' FOR SHARE`;
  if (!rows.length) throw new AuthorizationError(401);
}
async function lockSurvey(
  tx: Prisma.TransactionClient,
  id: string,
  revision: string,
) {
  await tx.$queryRaw`SELECT id FROM "Survey" WHERE id = ${id} FOR UPDATE`;
  const survey = await tx.survey.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      termsText: true,
      updatedAt: true,
      deletedAt: true,
      status: true,
      publishedVersionId: true,
    },
  });
  if (!survey || survey.deletedAt)
    throw new SurveyBuilderError(404, "Survey not found.");
  if (survey.updatedAt.toISOString() !== revision)
    throw new SurveyBuilderError(
      409,
      "This survey changed in another session. Reload it before saving or publishing. Your unsaved edits are still here.",
    );
  return survey;
}
const nextTimestamp = (current: Date) =>
  new Date(Math.max(Date.now(), current.getTime() + 1));
const meta = (definition: SurveyDraft) => ({
  title: definition.title,
  introText: definition.introText,
  closingMessage: definition.closingMessage,
  termsText: definition.termsText,
  deadlineText: definition.deadlineText,
  contactName: definition.contactName,
  contactEmail: definition.contactEmail,
});
async function insertSections(
  tx: Prisma.TransactionClient,
  id: string,
  definition: SurveyDraft,
) {
  for (const section of definition.sections) {
    await tx.surveySection.create({
      data: {
        id: section.id,
        surveyId: id,
        title: section.title,
        order: section.order,
      },
    });
    for (const field of section.fields) {
      const { options, ...data } = field;
      await tx.surveyField.create({
        data: {
          ...data,
          surveyId: id,
          sectionId: section.id,
          options: { create: options },
        },
      });
    }
  }
}
async function readEditor(tx: Prisma.TransactionClient, id: string) {
  const [survey, definition, categories] = await Promise.all([
    tx.survey.findUnique({
      where: { id },
      select: {
        status: true,
        updatedAt: true,
        deletedAt: true,
        publishedVersion: { select: { versionNumber: true } },
      },
    }),
    readDraftDefinition(tx, id),
    tx.category.findMany({
      select: { slug: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!survey || survey.deletedAt)
    throw new SurveyBuilderError(404, "Survey not found.");
  return {
    definition: parse(draftDefinitionSchema, definition),
    revision: survey.updatedAt.toISOString(),
    status: survey.status,
    publishedVersion: survey.publishedVersion?.versionNumber ?? null,
    categories,
  };
}
export async function listManagedSurveys() {
  await requireAdmin();
  const rows = await getDb().survey.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      title: true,
      status: true,
      updatedAt: true,
      publishedVersion: { select: { versionNumber: true } },
      _count: { select: { responses: true } },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    status: row.status,
    revision: row.updatedAt.toISOString(),
    publishedVersion: row.publishedVersion?.versionNumber ?? null,
    responseCount: row._count.responses,
  }));
}
export type ManagedSurvey = Awaited<
  ReturnType<typeof listManagedSurveys>
>[number];
export type SurveyEditorData = Awaited<ReturnType<typeof getSurveyEditor>>;
export async function getSurveyEditor(id: string) {
  await requireAdmin();
  checkId(id);
  if (
    !(await getDb().survey.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    }))
  )
    throw new SurveyBuilderError(404, "Survey not found.");
  return getDb().$transaction((tx) => readEditor(tx, id), {
    isolationLevel: "RepeatableRead",
  });
}
export async function createSurvey(input: unknown) {
  const admin = await requireAdmin(),
    parsed = parse(createSurveySchema, input);
  return getDb().$transaction(async (tx) => {
    await lockAdmin(tx, admin.id);
    const survey = await tx.survey.create({
      data: {
        id: randomUUID(),
        title: parsed.title,
        introText: "",
        closingMessage: "",
        termsText: "",
      },
      select: { id: true },
    });
    await tx.surveySection.create({
      data: {
        id: randomUUID(),
        surveyId: survey.id,
        title: "General information",
        order: 1,
      },
    });
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: "CREATE_SURVEY",
        entityType: "Survey",
        entityId: survey.id,
      },
    });
    return { id: survey.id };
  });
}
export async function saveSurveyDraft(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkId(id);
  const { definition, revision } = parse(saveDraftSchema, input);
  if (definition.surveyId !== id)
    throw new SurveyBuilderError(
      400,
      "The draft does not belong to this survey.",
    );
  return getDb().$transaction(
    async (tx) => {
      await lockAdmin(tx, admin.id);
      const survey = await lockSurvey(tx, id, revision);
      const incomingFields = definition.sections.flatMap(
        (section) => section.fields,
      );
      const [existing, foreignSections, foreignFields, foreignOptions] =
        await Promise.all([
          tx.surveyField.findMany({
            where: { surveyId: id },
            select: { id: true, fieldKey: true },
          }),
          tx.surveySection.count({
            where: {
              id: { in: definition.sections.map((section) => section.id) },
              surveyId: { not: id },
            },
          }),
          tx.surveyField.count({
            where: {
              id: { in: incomingFields.map((field) => field.id) },
              surveyId: { not: id },
            },
          }),
          tx.surveyFieldOption.count({
            where: {
              id: {
                in: incomingFields.flatMap((field) =>
                  field.options.map((option) => option.id),
                ),
              },
              field: { surveyId: { not: id } },
            },
          }),
        ]);
      if (foreignSections || foreignFields || foreignOptions)
        throw new SurveyBuilderError(
          422,
          "Section, question, or option identifiers belong to another survey. Reload this draft.",
        );
      for (const field of incomingFields) {
        const original = existing.find((item) => item.id === field.id);
        if (original && original.fieldKey !== field.fieldKey)
          throw new SurveyBuilderError(
            422,
            "Saved field keys cannot be changed.",
            [
              {
                path: `field:${original.fieldKey}`,
                message: "Keep this question's stable field key.",
              },
            ],
          );
        if (
          field.fieldType === "DISPLAY_TEXT" &&
          field.content === survey.termsText &&
          survey.termsText !== definition.termsText
        )
          field.content = definition.termsText;
      }
      // Draft children have no historical foreign keys. Reinsert the same IDs atomically to avoid order-uniqueness collisions.
      await tx.surveySection.deleteMany({ where: { surveyId: id } });
      await insertSections(tx, id, definition);
      await tx.survey.update({
        where: { id },
        data: {
          ...meta(definition),
          updatedAt: nextTimestamp(survey.updatedAt),
        },
      });
      return readEditor(tx, id);
    },
    { timeout: 20000 },
  );
}
export async function publishSurvey(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkId(id);
  const { revision } = parse(actionSchema, input);
  return getDb().$transaction(
    async (tx) => {
      await lockAdmin(tx, admin.id);
      const survey = await lockSurvey(tx, id, revision);
      const draft = parse(
        draftDefinitionSchema,
        await readDraftDefinition(tx, id),
      );
      const issues = publicationIssues(draft);
      if (
        draft.sections.some((section) =>
          section.fields.some(
            (field) => field.fieldType === "IMAGE_UPLOAD" && field.required,
          ),
        ) &&
        !isImageStorageConfigured()
      )
        issues.push({
          path: "sections",
          message:
            "Image storage is not configured. Make the image optional or configure storage before publishing.",
        });
      if (issues.length)
        throw new SurveyBuilderError(
          422,
          "Complete these settings before publishing.",
          issues,
        );
      for (const field of draft.sections
        .flatMap((section) => section.fields)
        .filter((field) => field.displayMapping === "CATEGORY")) {
        try {
          await resolveApprovalCategories(
            tx,
            field.options.map((option) => ({
              value: option.value,
              label: option.label,
            })),
          );
        } catch {
          throw new SurveyBuilderError(
            422,
            "Use existing directory categories before publishing.",
            [
              {
                path: `field:${field.fieldKey}`,
                message: `${field.label}: every option must match an existing directory category. Use the directory category options.`,
              },
            ],
          );
        }
      }
      const snapshot = await snapshotFromDraft(tx, id);
      const previous = await tx.surveyVersion.aggregate({
        where: { surveyId: id },
        _max: { versionNumber: true },
      });
      const number = (previous._max.versionNumber ?? 0) + 1,
        now = nextTimestamp(survey.updatedAt);
      const version = await tx.surveyVersion.create({
        data: {
          id: randomUUID(),
          surveyId: id,
          versionNumber: number,
          snapshot,
          publishedAt: now,
        },
        select: { id: true },
      });
      await tx.survey.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          publishedVersionId: version.id,
          updatedAt: now,
        },
      });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "PUBLISH_SURVEY",
          entityType: "Survey",
          entityId: id,
          metadata: { versionId: version.id, versionNumber: number },
        },
      });
      return { id, versionNumber: number, revision: now.toISOString() };
    },
    { timeout: 10000 },
  );
}
export async function unpublishSurvey(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkId(id);
  const { revision } = parse(actionSchema, input);
  return getDb().$transaction(async (tx) => {
    await lockAdmin(tx, admin.id);
    const survey = await lockSurvey(tx, id, revision);
    if (survey.status !== "PUBLISHED")
      throw new SurveyBuilderError(
        409,
        "This survey is not currently published.",
      );
    const now = nextTimestamp(survey.updatedAt);
    await tx.survey.update({
      where: { id },
      data: { status: "UNPUBLISHED", updatedAt: now },
    });
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: "UNPUBLISH_SURVEY",
        entityType: "Survey",
        entityId: id,
      },
    });
    return { id, revision: now.toISOString() };
  });
}
export async function duplicateSurvey(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkId(id);
  const { revision } = parse(actionSchema, input);
  return getDb().$transaction(
    async (tx) => {
      await lockAdmin(tx, admin.id);
      await lockSurvey(tx, id, revision);
      const draft = parse(
        draftDefinitionSchema,
        await readDraftDefinition(tx, id),
      );
      const copy = await tx.survey.create({
        data: {
          id: randomUUID(),
          ...meta(draft),
          title: `${draft.title.slice(0, 193)} (copy)`,
        },
        select: { id: true },
      });
      draft.surveyId = copy.id;
      draft.sections = draft.sections.map((section) => ({
        ...section,
        id: randomUUID(),
        fields: section.fields.map((field) => ({
          ...field,
          id: randomUUID(),
          options: field.options.map((option) => ({
            ...option,
            id: randomUUID(),
          })),
        })),
      }));
      await insertSections(tx, copy.id, draft);
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "CREATE_SURVEY",
          entityType: "Survey",
          entityId: copy.id,
          metadata: { duplicatedFrom: id },
        },
      });
      return { id: copy.id };
    },
    { timeout: 20000 },
  );
}
export async function deleteSurvey(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkId(id);
  const { revision } = parse(actionSchema, input);
  return getDb().$transaction(async (tx) => {
    await lockAdmin(tx, admin.id);
    const survey = await lockSurvey(tx, id, revision);
    const [versions, responses] = await Promise.all([
      tx.surveyVersion.count({ where: { surveyId: id } }),
      tx.surveyResponse.count({ where: { surveyId: id } }),
    ]);
    const archived = versions > 0 || responses > 0;
    if (archived) {
      const now = nextTimestamp(survey.updatedAt);
      await tx.survey.update({
        where: { id },
        data: { deletedAt: now, status: "UNPUBLISHED", updatedAt: now },
      });
    } else await tx.survey.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: archived ? "ARCHIVE_SURVEY" : "DELETE_SURVEY",
        entityType: "Survey",
        entityId: id,
      },
    });
    return { id, archived };
  });
}
