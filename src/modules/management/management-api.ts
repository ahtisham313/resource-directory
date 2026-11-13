import "server-only";
import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/admin-api";
import type { AdminRole } from "@/modules/auth/auth-types";
import { ReviewError } from "@/modules/responses/review-types";
import { SurveyServiceError } from "@/modules/surveys/survey-error";
import { ManagementError } from "./management-types";

export async function managementErrors(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (
      error instanceof ManagementError ||
      error instanceof ReviewError ||
      error instanceof SurveyServiceError
    )
      return NextResponse.json(
        {
          error: error.message,
          ...("fieldErrors" in error ? { fieldErrors: error.fieldErrors } : {}),
        },
        {
          status: error.status,
          headers: { "Cache-Control": "private, no-store" },
        },
      );
    throw error;
  }
}
export function managementApi(
  handler: () => Promise<Response>,
  role: AdminRole = "ADMIN",
) {
  return withAdmin(() => managementErrors(handler), role);
}
export async function readManagementBody(
  request: Request,
  multipart = false,
): Promise<unknown> {
  const origin = request.headers.get("origin");
  const canonical = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : new URL(request.url).origin;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin && origin !== canonical)
  )
    throw new ManagementError(403, "This request could not be accepted.");
  const contentType = request.headers.get("content-type") ?? "";
  if (
    !contentType
      .toLowerCase()
      .startsWith(multipart ? "multipart/form-data;" : "application/json")
  )
    throw new ManagementError(
      415,
      "Use the provided form to send this request.",
    );
  const reader = request.body?.getReader();
  if (!reader) throw new ManagementError(400, "The request is empty.");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > (multipart ? 3 * 1024 * 1024 : 300 * 1024)) {
        await reader.cancel();
        throw new ManagementError(413, "The request is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = Buffer.concat(chunks);
  try {
    return multipart
      ? await new Response(bytes, {
          headers: { "Content-Type": contentType },
        }).formData()
      : JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new ManagementError(400, "The request could not be read.");
  }
}
export async function readResourceEdit(request: Request) {
  const form = await readManagementBody(request, true);
  if (!(form instanceof FormData))
    throw new ManagementError(400, "Invalid form.");
  for (const key of form.keys())
    if (!["data", "image"].includes(key) || form.getAll(key).length !== 1)
      throw new ManagementError(400, "Invalid form fields.");
  const data = form.get("data"),
    image = form.get("image");
  if (
    typeof data !== "string" ||
    Buffer.byteLength(data) > 300 * 1024 ||
    (image !== null && !(image instanceof File))
  )
    throw new ManagementError(400, "Invalid form data.");
  let input: unknown;
  try {
    input = JSON.parse(data);
  } catch {
    throw new ManagementError(400, "Invalid form data.");
  }
  return { input, file: image instanceof File ? image : undefined };
}
