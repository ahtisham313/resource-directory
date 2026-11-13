"use client";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { AnalyticsPeriod } from "../analytics-period";

export function AnalyticsFilters({
  period,
  currentYear,
}: {
  period: AnalyticsPeriod;
  currentYear: number;
}) {
  const [mode, setMode] = useState(period.mode);
  const years = [
    ...new Set([
      period.year,
      ...Array.from(
        { length: currentYear - 2000 + 2 },
        (_, index) => currentYear + 1 - index,
      ),
    ]),
  ].sort((a, b) => b - a);
  const control =
    "mt-2 min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-sm";
  return (
    <form
      action="/admin"
      method="get"
      className="space-y-4 rounded-xl border bg-background p-4 sm:p-5"
      aria-label="Analytics reporting period"
    >
      <div className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label className="min-w-0 text-sm font-medium">
          Period
          <select
            name="mode"
            value={mode}
            onChange={(event) =>
              setMode(
                event.target.value === "year"
                  ? "year"
                  : event.target.value === "range"
                    ? "range"
                    : "month",
              )
            }
            className={control}
          >
            <option value="month">Month</option>
            <option value="year">Year</option>
            <option value="range">Specific date / Date range</option>
          </select>
        </label>
        {mode !== "range" && (
          <label className="min-w-0 text-sm font-medium">
            Year
            <select name="year" defaultValue={period.year} className={control}>
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === "month" && (
          <label className="min-w-0 text-sm font-medium">
            Month
            <select
              name="month"
              defaultValue={period.month}
              className={control}
            >
              {Array.from({ length: 12 }, (_, index) => (
                <option key={index} value={index + 1}>
                  {new Intl.DateTimeFormat("en", {
                    month: "long",
                    timeZone: "UTC",
                  }).format(new Date(Date.UTC(2020, index, 1)))}
                </option>
              ))}
            </select>
          </label>
        )}
        {mode === "range" && (
          <>
            <label className="min-w-0 text-sm font-medium">
              Start date
              <input
                type="date"
                name="start"
                defaultValue={period.start}
                required
                min="2000-01-01"
                max="2100-12-31"
                className={control}
              />
            </label>
            <label className="min-w-0 text-sm font-medium">
              End date (optional)
              <input
                type="date"
                name="end"
                defaultValue={period.end}
                min="2000-01-01"
                max="2100-12-31"
                className={control}
              />
            </label>
          </>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" className="min-h-11">
          Apply filters
        </Button>
        <Link
          href="/admin"
          className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm underline"
        >
          Reset filters
        </Link>
        <p className="basis-full text-xs leading-6 text-muted-foreground">
          Usage and sessions use UTC dates. Leave the end date empty for one
          day. Date ranges can cover up to 366 days.
        </p>
      </div>
    </form>
  );
}
