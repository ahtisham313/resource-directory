import "server-only";
import { redirect } from "next/navigation";
import {
  AuthorizationError,
  getCurrentAdmin,
  requireAdmin,
} from "./authorization";

export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AuthorizationError && error.status === 401)
      redirect("/admin/login");
    throw error;
  }
}

export async function redirectSignedInAdmin() {
  if (await getCurrentAdmin()) redirect("/admin");
}
