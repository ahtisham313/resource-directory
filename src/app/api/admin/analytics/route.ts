import { NextResponse } from "next/server";
import { withAdmin } from "@/modules/auth/admin-api";
import { getAnalytics } from "@/modules/analytics/analytics-data";
import { AnalyticsError } from "@/modules/analytics/analytics-period";
export async function GET(request: Request) {
  return withAdmin(async () => {
    const query = new URL(request.url).searchParams;
    try {
      for (const key of query.keys())
        if (query.getAll(key).length > 1)
          throw new AnalyticsError(400, "Use one value per reporting filter.");
      return NextResponse.json(await getAnalytics(Object.fromEntries(query)));
    } catch (error) {
      if (error instanceof AnalyticsError)
        return NextResponse.json(
          { error: error.message },
          { status: error.status },
        );
      throw error;
    }
  });
}
