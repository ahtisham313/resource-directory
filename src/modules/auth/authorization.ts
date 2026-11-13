import "server-only";
import { auth } from "@/auth";
import { getDb } from "@/lib/db";
import { safeAdminSchema, type AdminRole, type SafeAdmin } from "./auth-types";

export class AuthorizationError extends Error {
  constructor(public readonly status: 401 | 403) {
    super(status === 401 ? "Authentication required." : "Access denied.");
    this.name = "AuthorizationError";
  }
}

export async function getCurrentAdmin(): Promise<SafeAdmin | null> {
  const session = await auth();
  const id = session?.user?.id;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) return null;

  // Do not cache this across requests: disabled accounts must lose access even with a valid JWT.
  const admin = await getDb().adminUser.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true, status: true },
  });
  if (!admin || admin.status !== "ACTIVE") return null;
  return safeAdminSchema.parse(admin);
}

export async function requireAdmin(): Promise<SafeAdmin> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new AuthorizationError(401);
  return admin;
}

export async function requireRole(requiredRole: AdminRole): Promise<SafeAdmin> {
  const admin = await requireAdmin();
  if (admin.role !== "SUPER_ADMIN" && admin.role !== requiredRole)
    throw new AuthorizationError(403);
  return admin;
}
