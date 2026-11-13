import "server-only";
import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/admin-api";
import { ReviewError } from "./review-types";

export function reviewApi(handler: () => Promise<Response>): Promise<Response> {
  return withAdmin(async () => {
    try {
      return await handler();
    } catch (error) {
      if (error instanceof ReviewError)
        return NextResponse.json(
          { error: error.message, ...(error.code ? { code: error.code } : {}) },
          { status: error.status },
        );
      throw error;
    }
  });
}

export async function readReviewRequest(request: Request): Promise<unknown> {
  const origin = request.headers.get("origin");
  const canonical = process.env.NEXTAUTH_URL
    ? new URL(process.env.NEXTAUTH_URL).origin
    : new URL(request.url).origin;
  if (
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (origin && origin !== new URL(request.url).origin && origin !== canonical)
  )
    throw new ReviewError(403, "This request could not be accepted.");
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  )
    throw new ReviewError(415, "Send the review as JSON.");
  const reader = request.body?.getReader();
  if (!reader) throw new ReviewError(400, "The review could not be read.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 8192) {
        await reader.cancel();
        throw new ReviewError(413, "The review is too large.");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ReviewError(400, "The review could not be read.");
  }
}
