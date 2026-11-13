import type { JWT } from "next-auth/jwt";
import { safeAdminSchema, type SafeAdmin } from "./auth-types";

export function createAdminToken(user: unknown): JWT {
  const admin = safeAdminSchema.parse(user);
  return {
    sub: admin.id,
    name: admin.name,
    email: admin.email,
    role: admin.role,
  };
}

export function readSessionAdmin(token: JWT): SafeAdmin | undefined {
  const parsed = safeAdminSchema.safeParse({
    id: token.sub,
    name: token.name,
    email: token.email,
    role: token.role,
  });
  return parsed.success ? parsed.data : undefined;
}

export function safeAdminRedirect(url: string, baseUrl: string): string {
  const origin = new URL(baseUrl).origin;
  const fallback = `${origin}/admin`;
  try {
    const destination = new URL(url, origin);
    if (destination.origin !== origin) return fallback;
    if (
      destination.pathname !== "/admin" &&
      !destination.pathname.startsWith("/admin/")
    )
      return fallback;
    // Destinations are fixed admin paths; query strings cannot carry credentials or nested redirects.
    return `${origin}${destination.pathname}`;
  } catch {
    return fallback;
  }
}
