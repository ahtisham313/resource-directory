import "server-only";
import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/admin-api";
import { SurveyBuilderError } from "./builder-schema";

export function builderApi(handler: () => Promise<Response>) {
  return withAdmin(async () => {
    try {
      return await handler();
    } catch (error) {
      if (error instanceof SurveyBuilderError)
        return NextResponse.json(
          { error: error.message, issues: error.issues },
          { status: error.status },
        );
      throw error;
    }
  });
}
export async function readBuilderRequest(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin"),
    canonical = process.env.NEXTAUTH_URL
      ? new URL(process.env.NEXTAUTH_URL).origin
      : new URL(request.url).origin;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin && origin !== canonical)
  )
    throw new SurveyBuilderError(403, "This request could not be accepted.");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new SurveyBuilderError(415, "Send survey settings as JSON.");
  const reader = request.body?.getReader();
  if (!reader)
    throw new SurveyBuilderError(400, "The survey request could not be read.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 1048576) {
        await reader.cancel();
        throw new SurveyBuilderError(413, "The survey draft is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new SurveyBuilderError(
      400,
      "The survey request contains invalid JSON.",
    );
  }
}
