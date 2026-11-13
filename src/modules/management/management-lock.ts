import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { AuthorizationError } from "@/modules/auth/authorization";

export async function lockActor(
  tx: Prisma.TransactionClient,
  id: string,
  superAdmin = false,
) {
  const rows = await tx.$queryRaw<
    Array<{ role: string }>
  >`SELECT role FROM "AdminUser" WHERE id = ${id} AND status = 'ACTIVE' FOR SHARE`;
  if (!rows.length) throw new AuthorizationError(401);
  if (superAdmin && rows[0].role !== "SUPER_ADMIN")
    throw new AuthorizationError(403);
}
export async function lockAdminManagement(tx: Prisma.TransactionClient) {
  // Serialize account changes and invitations before checking the last active admin.
  await tx.$queryRaw`SELECT true AS locked FROM pg_advisory_xact_lock(8152008)`;
}
