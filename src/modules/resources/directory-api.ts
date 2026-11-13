import "server-only";
import { NextResponse } from "next/server";
import { DirectoryError } from "./directory-types";

export async function directoryApi(
  handler: () => Promise<Response>,
): Promise<Response> {
  let response: Response;
  try {
    response = await handler();
  } catch (error) {
    response = NextResponse.json(
      {
        error:
          error instanceof DirectoryError
            ? error.message
            : "The directory is temporarily unavailable. Please try again.",
      },
      { status: error instanceof DirectoryError ? error.status : 503 },
    );
  }
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  return response;
}
