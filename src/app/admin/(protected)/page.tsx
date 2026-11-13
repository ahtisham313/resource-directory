import { requireAdminPage } from "@/modules/auth/page-access";
import Link from "next/link";
import { getAnalytics } from "@/modules/analytics/analytics-data";
import { AnalyticsError } from "@/modules/analytics/analytics-period";
import { AnalyticsDashboard } from "@/modules/analytics/components/analytics-dashboard";

export const metadata = { title: "Dashboard" };
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  let data,
    message = "";
  try {
    data = await getAnalytics(await searchParams);
  } catch (error) {
    if (error instanceof AnalyticsError) message = error.message;
    else throw error;
  }
  if (!data)
    return (
      <div
        role="alert"
        className="space-y-4 rounded-xl border bg-background p-6"
      >
        <h1 className="text-2xl font-semibold">Check the reporting period</h1>
        <p className="text-sm leading-7">{message}</p>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm"
        >
          Reset filters
        </Link>
      </div>
    );
  return (
    <AnalyticsDashboard data={data} currentYear={new Date().getUTCFullYear()} />
  );
}
