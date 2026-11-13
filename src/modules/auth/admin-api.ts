import "server-only";
import { NextResponse } from "next/server";
import { AuthorizationError, requireRole } from "./authorization";
import type { AdminRole, SafeAdmin } from "./auth-types";

export async function withAdmin(
  handler: (admin: SafeAdmin) => Promise<Response> | Response,
  requiredRole: AdminRole = "ADMIN",
): Promise<Response> {
  try {
    const admin = await requireRole(requiredRole);
    const response = await handler(admin);
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    const status = error instanceof AuthorizationError ? error.status : 503;
    const message =
      error instanceof AuthorizationError
        ? error.message
        : "Unable to complete this request. Please try again.";
    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}
