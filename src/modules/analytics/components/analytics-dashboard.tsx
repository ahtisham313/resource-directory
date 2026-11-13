import { Activity, Library, ClipboardList, Users } from "lucide-react";
import type { getAnalytics } from "../analytics-data";
import { AnalyticsFilters } from "./analytics-filters";
import { CategoryUsageChart } from "./category-usage-chart";
type Data = Awaited<ReturnType<typeof getAnalytics>>;
export function AnalyticsDashboard({
  data,
  currentYear,
}: {
  data: Data;
  currentYear: number;
}) {
  const cards = [
    {
      label: "Website Sessions",
      value: data.sessions.status === "available" ? data.sessions.count : null,
      icon: Activity,
      note: "PostHog · Selected period",
    },
    {
      label: "Total Resources",
      value: data.totals.resources,
      icon: Library,
      note: "Current · Active and inactive",
    },
    {
      label: "Pending Survey Responses",
      value: data.totals.pending,
      icon: ClipboardList,
      note: "Current · Awaiting review",
    },
    {
      label: "Total Administrators",
      value: data.totals.admins,
      icon: Users,
      note: "Current · Active and inactive",
    },
  ];
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Public directory activity and current application totals.
        </p>
      </div>
      <AnalyticsFilters
        key={`${data.period.mode}:${data.period.startIso}:${data.period.endIso}`}
        period={data.period}
        currentYear={currentYear}
      />
      <p className="text-sm font-medium" data-reporting-period>
        {data.period.label}
      </p>
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon, note }) => (
          <section
            key={label}
            aria-label={label}
            className="min-w-0 rounded-xl border bg-background p-5"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm leading-6 font-medium text-muted-foreground">
                {label}
              </h2>
              <Icon
                className="mt-1 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
            </div>
            <p
              className="mt-4 text-3xl font-semibold tabular-nums"
              data-stat-value
            >
              {value === null ? "Unavailable" : value.toLocaleString("en")}
            </p>
            <p className="mt-2 text-xs leading-6 text-muted-foreground">
              {note}
            </p>
          </section>
        ))}
      </div>
      {data.sessions.status !== "available" && (
        <p
          role="status"
          className="rounded-lg border bg-background p-4 text-sm leading-6 wrap-break-word text-muted-foreground"
        >
          {data.sessions.message}
        </p>
      )}
      {!data.publicTrackingConfigured && (
        <p className="rounded-lg border bg-background p-4 text-sm leading-6 wrap-break-word text-muted-foreground">
          PostHog public tracking is not configured. Set
          NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN and NEXT_PUBLIC_POSTHOG_HOST, then
          restart or rebuild the app. Local category selections can still appear
          below.
        </p>
      )}
      <section
        className="min-w-0 rounded-xl border bg-background p-4 sm:p-6"
        aria-labelledby="category-usage-title"
      >
        <h2 id="category-usage-title" className="text-xl font-semibold">
          Category Usage
        </h2>
        <p className="mt-2 mb-6 text-sm leading-7 text-muted-foreground">
          Selections made through the public category filter during{" "}
          {data.period.label}. These counts come from recorded interactions,
          including categories with zero usage.
        </p>
        <CategoryUsageChart categories={data.categories} />
      </section>
      <p className="text-xs leading-6 text-muted-foreground">
        Website sessions count distinct PostHog session IDs with a public page
        view in the selected period. Session counts may take time to arrive and
        refresh at most once per minute for each period. Application totals show
        the current database state.
      </p>
    </div>
  );
}
