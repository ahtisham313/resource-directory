import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { listResponses } from "../response-data";
import { ResponseStatus } from "./response-status";

export function reviewDate(date: Date | null): string {
  return date
    ? new Intl.DateTimeFormat("en-US", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "UTC",
      }).format(date) + " UTC"
    : "—";
}

export function ResponseList({
  result,
}: {
  result: Awaited<ReturnType<typeof listResponses>>;
}) {
  const { filters, total, pages, rows } = result;
  const pageUrl = (page: number) => {
    const params = new URLSearchParams({
      q: filters.q,
      status: filters.status,
      page: String(page),
    });
    return `/admin/responses?${params}`;
  };
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Survey Responses
        </h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Review submitted provider information before it is published.
        </p>
      </div>
      <form
        action="/admin/responses"
        method="get"
        className="flex flex-col gap-3 rounded-xl border bg-background p-4 sm:flex-row sm:items-end"
      >
        <div className="min-w-0 flex-1 space-y-2">
          <label htmlFor="response-search" className="text-sm font-medium">
            Search submissions
          </label>
          <input
            id="response-search"
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="Practice, provider, or category"
            className="min-h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="response-status" className="text-sm font-medium">
            Status
          </label>
          <select
            id="response-status"
            name="status"
            defaultValue={filters.status}
            className="block min-h-11 w-full rounded-lg border bg-background px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="ALL">All</option>
            <option value="PENDING">Pending</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
        <Button type="submit" className="min-h-11 px-5">
          Apply filters
        </Button>
      </form>
      <div className="overflow-hidden rounded-xl border bg-background">
        <p className="border-b px-4 py-3 text-sm text-muted-foreground">
          {total} {total === 1 ? "response" : "responses"}
        </p>
        {rows.length === 0 ? (
          <div className="p-8 text-center">
            <h2 className="font-medium">No responses found</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Try another search or status filter.
            </p>
          </div>
        ) : (
          <div
            className="relative overflow-x-auto"
            role="region"
            aria-label="Survey responses table"
            tabIndex={0}
          >
            <table className="w-full min-w-[760px] text-left text-sm">
              <caption className="sr-only">
                Submitted surveys and their review status
              </caption>
              <thead className="border-b bg-muted/40">
                <tr>
                  {[
                    "Practice / provider",
                    "Category",
                    "Submitted",
                    "Status",
                    "Reviewed by",
                    "Reviewed",
                    "Details",
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-4 py-3 font-medium"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-b last:border-0">
                    <td className="max-w-64 px-4 py-4">
                      <p className="font-medium break-words">{row.title}</p>
                      {row.provider && row.provider !== row.title && (
                        <p className="mt-1 text-xs text-muted-foreground">
                          {row.provider}
                        </p>
                      )}
                    </td>
                    <td className="max-w-48 px-4 py-4">
                      {row.categories.join(", ") || "Not provided"}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {reviewDate(row.createdAt)}
                    </td>
                    <td className="px-4 py-4">
                      <ResponseStatus status={row.status} />
                    </td>
                    <td className="max-w-44 px-4 py-4 break-words">
                      {row.reviewer?.name || row.reviewer?.email || "—"}
                    </td>
                    <td className="px-4 py-4 text-xs">
                      {reviewDate(row.reviewedAt)}
                    </td>
                    <td className="px-4 py-4">
                      <Link
                        href={`/admin/responses/${row.id}`}
                        className="inline-flex min-h-11 items-center rounded-lg px-2 font-medium underline underline-offset-4 focus-visible:outline-2"
                      >
                        View details
                        <span className="sr-only"> for {row.title}</span>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <nav
        aria-label="Response pages"
        className="flex flex-wrap items-center justify-between gap-3 text-sm"
      >
        <p>
          Page {filters.page} of {pages}
        </p>
        <div className="flex gap-2">
          {filters.page > 1 && (
            <Link
              href={pageUrl(filters.page - 1)}
              className="inline-flex min-h-11 items-center rounded-lg border bg-background px-4 focus-visible:outline-2"
            >
              Previous
            </Link>
          )}
          {filters.page < pages && (
            <Link
              href={pageUrl(filters.page + 1)}
              className="inline-flex min-h-11 items-center rounded-lg border bg-background px-4 focus-visible:outline-2"
            >
              Next
            </Link>
          )}
        </div>
      </nav>
    </div>
  );
}
