import "server-only";
import { getDb } from "@/lib/db";
import { requireRole } from "@/modules/auth/authorization";
import {
  adminEditSchema,
  checkId,
  ManagementError,
  revisionSchema,
} from "./management-types";
import { lockActor, lockAdminManagement } from "./management-lock";
const adminSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

export async function listAdmins() {
  await requireRole("SUPER_ADMIN");
  const rows = await getDb().adminUser.findMany({
    select: adminSelect,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const invitations = await getDb().adminInvitation.findMany({
    where: { acceptedAt: null, expiresAt: { gt: new Date() } },
    select: { id: true, email: true, role: true, expiresAt: true },
    orderBy: { createdAt: "desc" },
  });
  return {
    rows: rows.map((row) => ({
      ...row,
      createdAt: row.createdAt.toISOString(),
      updatedAt: undefined,
      revision: row.updatedAt.toISOString(),
    })),
    invitations: invitations.map((row) => ({
      ...row,
      expiresAt: row.expiresAt.toISOString(),
    })),
  };
}
export async function updateAdmin(id: string, input: unknown) {
  const actor = await requireRole("SUPER_ADMIN");
  checkId(id);
  const parsed = adminEditSchema.safeParse(input);
  if (!parsed.success)
    throw new ManagementError(
      400,
      "Enter a name, a valid role and status, and the current account revision.",
    );
  const edit = parsed.data;
  return getDb().$transaction(async (tx) => {
    await lockAdminManagement(tx);
    await lockActor(tx, actor.id, true);
    await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${id} FOR UPDATE`;
    const target = await tx.adminUser.findUnique({
      where: { id },
      select: adminSelect,
    });
    if (!target) throw new ManagementError(404, "Administrator not found.");
    if (target.updatedAt.toISOString() !== edit.revision)
      throw new ManagementError(
        409,
        "This account changed. Reload the list before editing.",
      );
    if (
      target.status === "ACTIVE" &&
      edit.status !== "ACTIVE" &&
      (await tx.adminUser.count({ where: { status: "ACTIVE" } })) <= 1
    )
      throw new ManagementError(409, "Keep at least one active administrator.");
    if (
      target.status === "ACTIVE" &&
      target.role === "SUPER_ADMIN" &&
      (edit.status !== "ACTIVE" || edit.role !== "SUPER_ADMIN") &&
      (await tx.adminUser.count({
        where: { role: "SUPER_ADMIN", status: "ACTIVE" },
      })) <= 1
    )
      throw new ManagementError(409, "Keep at least one active super admin.");
    await tx.adminUser.update({
      where: { id },
      data: {
        name: edit.name,
        role: edit.role,
        status: edit.status,
        updatedAt: new Date(
          Math.max(Date.now(), target.updatedAt.getTime() + 1),
        ),
      },
    });
    await tx.auditLog.create({
      data: {
        adminId: actor.id,
        action:
          target.status !== edit.status
            ? "ADMIN_STATUS_CHANGED"
            : "ADMIN_UPDATED",
        entityType: "AdminUser",
        entityId: id,
        metadata: {
          previousRole: target.role,
          role: edit.role,
          previousStatus: target.status,
          status: edit.status,
        },
      },
    });
    return { id };
  });
}
export async function deleteAdmin(id: string, input: unknown) {
  const actor = await requireRole("SUPER_ADMIN");
  checkId(id);
  const parsed = revisionSchema.safeParse(input);
  if (!parsed.success)
    throw new ManagementError(400, "Reload the admin list before deleting.");
  if (id === actor.id)
    throw new ManagementError(409, "You cannot delete your own account.");
  return getDb().$transaction(async (tx) => {
    await lockAdminManagement(tx);
    await lockActor(tx, actor.id, true);
    await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${id} FOR UPDATE`;
    const target = await tx.adminUser.findUnique({
      where: { id },
      select: adminSelect,
    });
    if (!target) throw new ManagementError(404, "Administrator not found.");
    if (target.updatedAt.toISOString() !== parsed.data)
      throw new ManagementError(
        409,
        "This account changed. Reload before deleting.",
      );
    if (
      target.status === "ACTIVE" &&
      (await tx.adminUser.count({ where: { status: "ACTIVE" } })) <= 1
    )
      throw new ManagementError(409, "Keep at least one active administrator.");
    if (
      target.status === "ACTIVE" &&
      target.role === "SUPER_ADMIN" &&
      (await tx.adminUser.count({
        where: { status: "ACTIVE", role: "SUPER_ADMIN" },
      })) <= 1
    )
      throw new ManagementError(409, "Keep at least one active super admin.");
    const identity = { id: target.id, name: target.name, email: target.email };
    // Preserve attribution before foreign keys are cleared by account deletion.
    await tx.$executeRaw`UPDATE "AuditLog" SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object('actorIdentity', ${JSON.stringify(identity)}::jsonb) WHERE "adminId" = ${id}`;
    const reviewed = await tx.surveyResponse.findMany({
      where: { reviewerId: id },
      select: { id: true },
    });
    if (reviewed.length)
      await tx.auditLog.createMany({
        data: reviewed.map((response) => ({
          adminId: actor.id,
          action: "REVIEWER_REMOVED",
          entityType: "SurveyResponse",
          entityId: response.id,
          metadata: { reviewer: identity },
        })),
      });
    await tx.adminUser.delete({ where: { id } });
    await tx.auditLog.create({
      data: {
        adminId: actor.id,
        action: "ADMIN_DELETED",
        entityType: "AdminUser",
        entityId: id,
        metadata: { ...identity, role: target.role },
      },
    });
    return { id };
  });
}
