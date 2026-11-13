import { z } from "zod";

export class AnalyticsError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const inputSchema = z
  .object({
    mode: z.enum(["year", "month", "range"]).optional(),
    year: z.string().optional(),
    month: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  })
  .strict();
function calendarDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new AnalyticsError(400, "Use valid dates in YYYY-MM-DD format.");
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value ||
    date.getUTCFullYear() < 2000 ||
    date.getUTCFullYear() > 2100
  )
    throw new AnalyticsError(
      400,
      "Choose valid calendar dates between 2000 and 2100.",
    );
  return date;
}
export function parseAnalyticsPeriod(input: unknown, now = new Date()) {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success)
    throw new AnalyticsError(
      400,
      "Choose a valid reporting mode, year, month, or date range.",
    );
  const filters = parsed.data,
    mode = filters.mode ?? "month";
  let year = now.getUTCFullYear(),
    month = now.getUTCMonth() + 1,
    start: Date,
    end: Date,
    label: string;
  if (mode === "range") {
    start = calendarDate(filters.start ?? "");
    const last = calendarDate(filters.end || filters.start || "");
    if (last < start)
      throw new AnalyticsError(
        400,
        "The end date must be on or after the start date.",
      );
    end = new Date(last.getTime() + 86400000);
    if (end.getTime() - start.getTime() > 366 * 86400000)
      throw new AnalyticsError(400, "Choose a date range of at most 366 days.");
    label =
      filters.start === last.toISOString().slice(0, 10)
        ? `${filters.start} (UTC)`
        : `${filters.start} to ${last.toISOString().slice(0, 10)} (UTC)`;
  } else {
    const selected = filters.year || String(year);
    if (
      !/^\d{4}$/.test(selected) ||
      Number(selected) < 2000 ||
      Number(selected) > 2100
    )
      throw new AnalyticsError(400, "Choose a year between 2000 and 2100.");
    year = Number(selected);
    if (mode === "month") {
      const selectedMonth = filters.month || String(month);
      if (!/^(?:[1-9]|1[0-2])$/.test(selectedMonth))
        throw new AnalyticsError(
          400,
          "Choose a month from January to December.",
        );
      month = Number(selectedMonth);
      start = new Date(Date.UTC(year, month - 1, 1));
      end = new Date(Date.UTC(year, month, 1));
      label =
        new Intl.DateTimeFormat("en", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(start) + " (UTC)";
    } else {
      start = new Date(Date.UTC(year, 0, 1));
      end = new Date(Date.UTC(year + 1, 0, 1));
      label = `${year} (UTC)`;
    }
  }
  return {
    mode,
    year,
    month,
    start: filters.start ?? "",
    end: filters.end ?? "",
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    label,
  };
}
export type AnalyticsPeriod = ReturnType<typeof parseAnalyticsPeriod>;
