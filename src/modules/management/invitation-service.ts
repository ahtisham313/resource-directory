import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { getDb } from "@/lib/db";
import { requireRole } from "@/modules/auth/authorization";
import {
  acceptSchema,
  checkId,
  inviteSchema,
  ManagementError,
} from "./management-types";
import { lockActor, lockAdminManagement } from "./management-lock";
import {
  validateInvitationMailConfig,
  sendInvitation,
} from "./invitation-mail";

function tokenHash(token: string) {
  if (!/^[a-f0-9]{64}$/.test(token))
    throw new ManagementError(
      404,
      "This invitation is invalid. Ask a super admin for a new invitation.",
    );
  return createHash("sha256").update(token).digest("hex");
}
export async function inviteAdmin(input: unknown) {
  const actor = await requireRole("SUPER_ADMIN"),
    parsed = inviteSchema.safeParse(input);
  if (!parsed.success)
    throw new ManagementError(400, "Enter a valid email and role.");
  validateInvitationMailConfig();
  const token = randomBytes(32).toString("hex"),
    digest = tokenHash(token);
  const invitation = await getDb().$transaction(async (tx) => {
    await lockAdminManagement(tx);
    await lockActor(tx, actor.id, true);
    if (
      await tx.adminUser.findUnique({
        where: { email: parsed.data.email },
        select: { id: true },
      })
    )
      throw new ManagementError(
        409,
        "An administrator already uses that email.",
      );
    const now = new Date();
    if (
      await tx.adminInvitation.findFirst({
        where: {
          email: parsed.data.email,
          acceptedAt: null,
          expiresAt: { gt: now },
        },
        select: { id: true },
      })
    )
      throw new ManagementError(
        409,
        "There is already an active invitation for this email. Cancel it before inviting again.",
      );
    await tx.adminInvitation.deleteMany({
      where: {
        email: parsed.data.email,
        acceptedAt: null,
        expiresAt: { lte: now },
      },
    });
    return tx.adminInvitation.create({
      data: {
        ...parsed.data,
        tokenHash: digest,
        invitedById: actor.id,
        createdAt: now,
        expiresAt: new Date(now.getTime() + 86400000),
      },
      select: { id: true, expiresAt: true },
    });
  });
  try {
    await sendInvitation(
      parsed.data.email,
      parsed.data.role,
      token,
      invitation.expiresAt,
    );
  } catch (error) {
    // A failed send never leaves a pending invitation blocking a deliberate retry.
    await getDb().adminInvitation.deleteMany({
      where: { id: invitation.id, acceptedAt: null },
    });
    if (error instanceof ManagementError) throw error;
    console.error(
      "Invitation email delivery failed. Check the SMTP connection and sender settings.",
    );
    throw new ManagementError(
      503,
      "The email could not be sent. Check SMTP settings, then invite again.",
    );
  }
  await getDb().auditLog.create({
    data: {
      action: "ADMIN_INVITED",
      entityType: "AdminInvitation",
      entityId: invitation.id,
      metadata: {
        invitedById: actor.id,
        email: parsed.data.email,
        role: parsed.data.role,
      },
    },
  });
  return { message: "Invitation sent. The link expires in 24 hours." };
}
export async function cancelInvitation(id: string) {
  const actor = await requireRole("SUPER_ADMIN");
  checkId(id);
  return getDb().$transaction(async (tx) => {
    await lockAdminManagement(tx);
    await lockActor(tx, actor.id, true);
    const result = await tx.adminInvitation.deleteMany({
      where: { id, acceptedAt: null },
    });
    if (!result.count)
      throw new ManagementError(
        409,
        "This invitation has already been accepted or removed.",
      );
    await tx.auditLog.create({
      data: {
        adminId: actor.id,
        action: "ADMIN_INVITATION_CANCELLED",
        entityType: "AdminInvitation",
        entityId: id,
      },
    });
    return { id };
  });
}
function checkInvitation<
  T extends { acceptedAt: Date | null; expiresAt: Date },
>(invitation: T | null): T {
  if (!invitation)
    throw new ManagementError(
      404,
      "This invitation is invalid. Ask a super admin for a new invitation.",
    );
  if (invitation.acceptedAt)
    throw new ManagementError(
      410,
      "This invitation has already been used. Sign in with your account.",
    );
  if (invitation.expiresAt.getTime() <= Date.now())
    throw new ManagementError(
      410,
      "This invitation has expired. Ask a super admin for a new invitation.",
    );
  return invitation;
}
export async function getInvitation(token: string) {
  const invitation = checkInvitation(
    await getDb().adminInvitation.findUnique({
      where: { tokenHash: tokenHash(token) },
      select: {
        id: true,
        email: true,
        role: true,
        acceptedAt: true,
        expiresAt: true,
      },
    }),
  );
  if (
    await getDb().adminUser.findUnique({
      where: { email: invitation.email },
      select: { id: true },
    })
  )
    throw new ManagementError(
      409,
      "This email already has an administrator account. Sign in or contact a super admin.",
    );
  return {
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
  };
}
export async function acceptInvitation(token: string, input: unknown) {
  const digest = tokenHash(token),
    parsed = acceptSchema.safeParse(input);
  if (!parsed.success)
    throw new ManagementError(
      422,
      parsed.error.issues[0]?.message ?? "Check your details.",
    );
  await getInvitation(token);
  const passwordHash = await hash(parsed.data.password, 12);
  return getDb().$transaction(async (tx) => {
    await lockAdminManagement(tx);
    const invitation = checkInvitation(
      await tx.adminInvitation.findUnique({ where: { tokenHash: digest } }),
    );
    if (
      await tx.adminUser.findUnique({
        where: { email: invitation.email },
        select: { id: true },
      })
    )
      throw new ManagementError(
        409,
        "This email already has an administrator account.",
      );
    const now = new Date();
    const recipients = await tx.adminUser.findMany({
      where: { status: "ACTIVE" },
      select: { id: true },
    });
    const admin = await tx.adminUser.create({
      data: {
        name: parsed.data.name,
        email: invitation.email,
        role: invitation.role,
        status: "ACTIVE",
        passwordHash,
      },
      select: { id: true, name: true, role: true },
    });
    await tx.adminInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: now },
    });
    if (recipients.length)
      await tx.notification.createMany({
        data: recipients.map((recipient) => ({
          recipientId: recipient.id,
          type: "ADMIN_JOINED",
          title: "New administrator",
          message: `${admin.name} joined Resource Directory as ${admin.role === "SUPER_ADMIN" ? "a super admin" : "an administrator"}.`,
          metadata: { adminId: admin.id },
        })),
      });
    await tx.auditLog.create({
      data: {
        adminId: admin.id,
        action: "ADMIN_JOINED",
        entityType: "AdminUser",
        entityId: admin.id,
        metadata: { invitationId: invitation.id },
      },
    });
    return {
      message: "Your administrator account is ready. You can now sign in.",
    };
  });
}
