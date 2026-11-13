import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { AuthorizationError, requireAdmin } from "@/modules/auth/authorization";
import {
  approveInputSchema,
  rejectInputSchema,
  responseIdSchema,
  ReviewError,
} from "./review-types";
import { getResponseDetails } from "./response-data";
import {
  prepareApprovedResource,
  resolveApprovalCategories,
} from "./approval-projection";
import { resolveCoordinates } from "./resolve-coordinates";

function checkResponseId(id: string) {
  if (!responseIdSchema.safeParse(id).success)
    throw new ReviewError(404, "Response not found.");
}

async function lockReviewer(tx: Prisma.TransactionClient, adminId: string) {
  // Keep the current account active until the review transaction commits.
  const active = await tx.$queryRaw<
    Array<{ id: string }>
  >`SELECT id FROM "AdminUser" WHERE id = ${adminId} AND status = 'ACTIVE' FOR SHARE`;
  if (!active.length) throw new AuthorizationError(401);
}

async function claimResponse(
  tx: Prisma.TransactionClient,
  id: string,
  adminId: string,
  status: "APPROVED" | "REJECTED",
  note: string | null,
  reviewedAt: Date,
) {
  const claimed = await tx.surveyResponse.updateMany({
    where: { id, status: "PENDING" },
    data: { status, reviewerId: adminId, reviewedAt, reviewNote: note },
  });
  if (claimed.count === 1) return null;
  const existing = await tx.surveyResponse.findUnique({
    where: { id },
    select: { status: true, resource: { select: { id: true } } },
  });
  if (!existing) throw new ReviewError(404, "Response not found.");
  if (
    existing.status === status &&
    (status === "REJECTED" || existing.resource)
  )
    return {
      status,
      alreadyReviewed: true,
      ...(existing.resource ? { resourceId: existing.resource.id } : {}),
    };
  throw new ReviewError(
    409,
    "This response has already been reviewed. Refresh the page to see the recorded decision.",
  );
}

export async function rejectResponse(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkResponseId(id);
  const parsed = rejectInputSchema.safeParse(input);
  if (!parsed.success)
    throw new ReviewError(
      400,
      "Use an optional review note of at most 2,000 characters.",
    );
  const reviewedAt = new Date();
  return getDb().$transaction(async (tx) => {
    await lockReviewer(tx, admin.id);
    const repeated = await claimResponse(
      tx,
      id,
      admin.id,
      "REJECTED",
      parsed.data.note || null,
      reviewedAt,
    );
    if (repeated) return repeated;
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: "REJECT_RESPONSE",
        entityType: "SurveyResponse",
        entityId: id,
        createdAt: reviewedAt,
        metadata: { previousStatus: "PENDING", status: "REJECTED" },
      },
    });
    return { status: "REJECTED" as const, alreadyReviewed: false };
  });
}

export async function approveResponse(id: string, input: unknown) {
  const admin = await requireAdmin();
  checkResponseId(id);
  const parsed = approveInputSchema.safeParse(input);
  if (!parsed.success)
    throw new ReviewError(
      400,
      "Use an optional note of at most 2,000 characters and valid latitude/longitude when entering coordinates.",
    );
  const response = await getResponseDetails(id);
  if (response.status === "APPROVED" && response.resource)
    return {
      status: "APPROVED" as const,
      alreadyReviewed: true,
      resourceId: response.resource.id,
    };
  if (response.status !== "PENDING")
    throw new ReviewError(
      409,
      "This response has already been reviewed. Refresh the page to see the recorded decision.",
    );
  const prepared = prepareApprovedResource(
    response.snapshot,
    response.answers,
    response.uploadedImageKey,
  );
  // Resolve external data before opening the transaction; submitted answers and versions are immutable.
  const location = await resolveCoordinates(
    prepared.data,
    parsed.data.coordinates,
  );
  const reviewedAt = new Date();
  try {
    return await getDb().$transaction(async (tx) => {
      await lockReviewer(tx, admin.id);
      const repeated = await claimResponse(
        tx,
        id,
        admin.id,
        "APPROVED",
        parsed.data.note || null,
        reviewedAt,
      );
      if (repeated) return repeated;
      const categoryIds = await resolveApprovalCategories(
        tx,
        prepared.categories,
      );
      const resource = await tx.resource.create({
        data: {
          ...prepared.data,
          sourceResponseId: id,
          surveyVersionId: response.surveyVersionId,
          active: true,
          latitude: location.latitude,
          longitude: location.longitude,
          categories: {
            create: categoryIds.map((categoryId) => ({ categoryId })),
          },
        },
        select: { id: true },
      });
      await tx.auditLog.create({
        data: {
          adminId: admin.id,
          action: "APPROVE_RESPONSE",
          entityType: "SurveyResponse",
          entityId: id,
          createdAt: reviewedAt,
          metadata: {
            resourceId: resource.id,
            previousStatus: "PENDING",
            status: "APPROVED",
            coordinateSource: location.source,
          },
        },
      });
      return {
        status: "APPROVED" as const,
        alreadyReviewed: false,
        resourceId: resource.id,
      };
    });
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2002"
    )
      throw new ReviewError(
        409,
        "This response already has a resource. Refresh the page before continuing.",
      );
    throw error;
  }
}
