import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import {
  createImageKey,
  getImageStorage,
  type ImageStorage,
} from "@/lib/image-storage";
import { requireAdmin } from "@/modules/auth/authorization";
import {
  checkId,
  ManagementError,
  revisionSchema,
} from "@/modules/management/management-types";
import { lockActor } from "@/modules/management/management-lock";
import {
  prepareApprovedResource,
  resolveApprovalCategories,
} from "@/modules/responses/approval-projection";
import { coordinatesSchema } from "@/modules/responses/review-types";
import { resolveCoordinates } from "@/modules/responses/resolve-coordinates";
import {
  parseSurveyDefinition,
  getImageField,
} from "@/modules/surveys/survey-definition";
import {
  SurveyAnswerError,
  validateSurveyAnswers,
} from "@/modules/surveys/answer-validation";
import { surveyAnswersSchema } from "@/modules/surveys/survey-snapshot";
import { validateImage } from "@/modules/surveys/validate-image";

export async function listManagedResources(input: {
  q?: string;
  category?: string;
  page?: string;
}) {
  await requireAdmin();
  const q = (input.q ?? "").trim().slice(0, 200),
    category = (input.category ?? "").slice(0, 128);
  const requested = /^[1-9]\d{0,6}$/.test(input.page ?? "")
    ? Number(input.page)
    : 1;
  const where: Prisma.ResourceWhereInput = {
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { providerName: { contains: q, mode: "insensitive" } },
            { address: { contains: q, mode: "insensitive" } },
          ],
        }
      : {}),
    ...(category ? { categories: { some: { categoryId: category } } } : {}),
  };
  return getDb().$transaction(
    async (tx) => {
      const total = await tx.resource.count({ where }),
        pages = Math.max(1, Math.ceil(total / 10)),
        page = Math.min(requested, pages);
      const rows = await tx.resource.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (page - 1) * 10,
        take: 10,
        select: {
          id: true,
          name: true,
          address: true,
          phone: true,
          active: true,
          createdAt: true,
          updatedAt: true,
          categories: { select: { category: { select: { name: true } } } },
        },
      });
      const categories = await tx.category.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      });
      return {
        total,
        pages,
        page,
        q,
        category,
        categories,
        rows: rows.map((row) => ({
          ...row,
          createdAt: row.createdAt.toISOString(),
          revision: row.updatedAt.toISOString(),
          updatedAt: undefined,
          categories: row.categories.map((link) => link.category.name),
        })),
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
async function resourceRecord(id: string) {
  checkId(id);
  const row = await getDb().resource.findUnique({ where: { id } });
  if (!row) throw new ManagementError(404, "Resource not found.");
  const version = await getDb().surveyVersion.findUniqueOrThrow({
    where: { id: row.surveyVersionId },
    select: { snapshot: true },
  });
  return {
    row,
    snapshot: parseSurveyDefinition(version.snapshot),
    answers: surveyAnswersSchema.parse(row.currentAnswers),
  };
}
export async function getResourceEditor(id: string) {
  await requireAdmin();
  const { row, snapshot, answers } = await resourceRecord(id);
  return {
    id: row.id,
    name: row.name,
    snapshot,
    answers,
    revision: row.updatedAt.toISOString(),
    hasImage: Boolean(row.imageKey),
    latitude: row.latitude,
    longitude: row.longitude,
  };
}
const editSchema = z
  .object({
    revision: revisionSchema,
    answers: surveyAnswersSchema,
    coordinates: coordinatesSchema.optional(),
    removeImage: z.boolean().default(false),
  })
  .strict();
export async function editResource(id: string, input: unknown, file?: File) {
  const admin = await requireAdmin();
  const parsed = editSchema.safeParse(input);
  if (!parsed.success)
    throw new ManagementError(
      400,
      "Check the answers, coordinates, and resource revision.",
    );
  const { row, snapshot, answers: stored } = await resourceRecord(id);
  if (row.updatedAt.toISOString() !== parsed.data.revision)
    throw new ManagementError(
      409,
      "This resource changed. Reload it before saving.",
    );
  const edited = { ...parsed.data.answers };
  // The original acknowledgement is historical consent, not a new admin input.
  for (const field of snapshot.sections.flatMap((section) => section.fields))
    if (field.fieldType === "TERMS_ACKNOWLEDGEMENT") {
      delete edited[field.fieldKey];
      if (stored[field.fieldKey])
        edited[field.fieldKey] = stored[field.fieldKey];
    }
  const imageField = getImageField(snapshot);
  if (file && !imageField)
    throw new ManagementError(
      422,
      "This resource definition does not accept images.",
    );
  const image =
    file && imageField ? await validateImage(file, imageField) : undefined;
  const retainedKey = parsed.data.removeImage ? null : row.imageKey;
  let validated;
  try {
    validated = validateSurveyAnswers(
      snapshot,
      edited,
      Boolean(image || retainedKey),
    );
  } catch (error) {
    if (error instanceof SurveyAnswerError)
      throw new ManagementError(
        422,
        "Check the highlighted answers.",
        error.fieldErrors,
      );
    throw error;
  }
  const prepared = prepareApprovedResource(snapshot, validated, retainedKey);
  const unchanged = ["streetAddress", "city", "state", "zipCode"] as const;
  const savedCoordinates = coordinatesSchema.safeParse({
    latitude: row.latitude,
    longitude: row.longitude,
  });
  const location =
    !parsed.data.coordinates &&
    unchanged.every((key) => row[key] === prepared.data[key]) &&
    savedCoordinates.success
      ? { ...savedCoordinates.data, source: "EXISTING" as const }
      : await resolveCoordinates(prepared.data, parsed.data.coordinates);
  let storage: ImageStorage | undefined,
    newKey: string | undefined,
    imageVersion: string | undefined;
  try {
    if (image) {
      storage = getImageStorage();
      newKey = createImageKey(image.extension);
      imageVersion = await storage.put(newKey, image);
    }
    await getDb().$transaction(async (tx) => {
      await lockActor(tx, admin.id);
      const categoryIds = await resolveApprovalCategories(
        tx,
        prepared.categories,
      );
      const updated = await tx.resource.updateMany({
        where: { id, updatedAt: row.updatedAt },
        data: {
          ...prepared.data,
          imageKey: newKey ?? retainedKey,
          latitude: location.latitude,
          longitude: location.longitude,
          updatedAt: new Date(
            Math.max(Date.now(), row.updatedAt.getTime() + 1),
          ),
        },
      });
      if (updated.count !== 1)
        throw new ManagementError(
          409,
          "This resource changed or was deleted. Reload before saving.",
        );
      await tx.resourceCategory.deleteMany({ where: { resourceId: id } });
      await tx.resourceCategory.createMany({
        data: categoryIds.map((categoryId) => ({ resourceId: id, categoryId })),
      });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "RESOURCE_UPDATED",
          entityType: "Resource",
          entityId: id,
          metadata: { coordinateSource: location.source },
        },
      });
    });
  } catch (error) {
    if (storage && newKey) {
      try {
        await storage.remove(newKey, imageVersion);
      } catch {
        console.error("Failed to clean up an unsaved resource image.");
      }
    }
    throw error;
  }
  // Old images may still belong to the original response and must remain available there.
  return { id };
}
const actionSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("visibility"),
      active: z.boolean(),
      revision: revisionSchema,
    })
    .strict(),
  z.object({ action: z.literal("delete"), revision: revisionSchema }).strict(),
]);
export async function changeResource(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkId(id);
  const parsed = actionSchema.safeParse(input);
  if (!parsed.success)
    throw new ManagementError(400, "Invalid resource action.");
  const data = parsed.data;
  return getDb().$transaction(async (tx) => {
    await lockActor(tx, admin.id);
    await tx.$queryRaw`SELECT id FROM "Resource" WHERE id = ${id} FOR UPDATE`;
    const row = await tx.resource.findUnique({
      where: { id },
      select: { updatedAt: true, name: true },
    });
    if (!row) throw new ManagementError(404, "Resource not found.");
    if (row.updatedAt.toISOString() !== data.revision)
      throw new ManagementError(
        409,
        "This resource changed. Reload the list before continuing.",
      );
    if (data.action === "delete") await tx.resource.delete({ where: { id } });
    else
      await tx.resource.update({
        where: { id },
        data: {
          active: data.active,
          updatedAt: new Date(
            Math.max(Date.now(), row.updatedAt.getTime() + 1),
          ),
        },
      });
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action:
          data.action === "delete"
            ? "RESOURCE_DELETED"
            : data.active
              ? "RESOURCE_ACTIVATED"
              : "RESOURCE_DEACTIVATED",
        entityType: "Resource",
        entityId: id,
        metadata: { name: row.name },
      },
    });
    return { id };
  });
}
