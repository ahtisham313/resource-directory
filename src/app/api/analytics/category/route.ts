import { NextResponse } from "next/server";
import { readManagementBody } from "@/modules/management/management-api";
import { ManagementError } from "@/modules/management/management-types";
import { AnalyticsError } from "@/modules/analytics/analytics-period";
import {
  categoryRetryAfter,
  recordCategorySelection,
} from "@/modules/analytics/category-events";

export async function POST(request: Request) {
  const headers = { "Cache-Control": "no-store" };
  try {
    if (
      request.headers.get("DNT") === "1" ||
      request.headers.get("Sec-GPC") === "1"
    )
      return new Response(null, { status: 204, headers });
    const retry = categoryRetryAfter(request);
    if (retry)
      return NextResponse.json(
        { error: "Please wait before recording more category selections." },
        { status: 429, headers: { ...headers, "Retry-After": String(retry) } },
      );
    await recordCategorySelection(
      await readManagementBody(request, false, 4096),
    );
    return new Response(null, { status: 204, headers });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof AnalyticsError || error instanceof ManagementError
            ? error.message
            : "Category activity could not be recorded.",
      },
      {
        status:
          error instanceof AnalyticsError || error instanceof ManagementError
            ? error.status
            : 503,
        headers,
      },
    );
  }
}
