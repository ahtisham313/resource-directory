import "server-only";
import { compare } from "bcryptjs";
import { getDb } from "@/lib/db";
import {
  credentialsSchema,
  safeAdminSchema,
  type SafeAdmin,
} from "./auth-types";

export async function verifyCredentials(
  input: unknown,
): Promise<SafeAdmin | null> {
  const parsed = credentialsSchema.safeParse(input);
  if (!parsed.success) return null;

  const admin = await getDb().adminUser.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      passwordHash: true,
    },
  });
  if (!admin || admin.status !== "ACTIVE") return null;
  if (!(await compare(parsed.data.password, admin.passwordHash))) return null;

  return safeAdminSchema.parse(admin);
}
