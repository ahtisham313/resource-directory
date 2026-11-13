"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
type Category = { id: string; name: string; count: number };
export function CategoryUsageChart({ categories }: { categories: Category[] }) {
  if (!categories.length)
    return (
      <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
        No directory categories are available yet.
      </p>
    );
  const maximum = Math.max(...categories.map((row) => row.count)),
    minimum = Math.min(...categories.map((row) => row.count));
  return (
    <div className="min-w-0">
      {maximum === 0 ? (
        <p
          role="status"
          className="mb-5 rounded-lg bg-muted/50 p-4 text-sm leading-6 text-muted-foreground"
        >
          No category selections were recorded in this period. All available
          categories are shown with zero usage.
        </p>
      ) : (
        <div className="mb-5 space-y-2 text-sm leading-6">
          <p className="wrap-break-word">
            <span className="font-medium">Most used ({maximum}): </span>
            {categories
              .filter((row) => row.count === maximum)
              .map((row) => row.name)
              .join(", ")}
          </p>
          <p className="wrap-break-word">
            <span className="font-medium">Least used ({minimum}): </span>
            {categories
              .filter((row) => row.count === minimum)
              .map((row) => row.name)
              .join(", ")}
          </p>
        </div>
      )}
      <div className="w-full min-w-0" aria-label="Category selection counts">
        <ResponsiveContainer
          width="100%"
          height={Math.max(260, categories.length * 52 + 40)}
          minWidth={0}
          initialDimension={{ width: 260, height: 300 }}
        >
          <BarChart
            data={categories}
            layout="vertical"
            margin={{ top: 8, right: 18, bottom: 8, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis
              type="number"
              allowDecimals={false}
              domain={[0, Math.max(1, maximum)]}
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={112}
              tickFormatter={(value: unknown) =>
                typeof value === "string"
                  ? value.length > 17
                    ? `${value.slice(0, 15)}…`
                    : value
                  : ""
              }
              tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)" }}
              contentStyle={{
                background: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "0.5rem",
                color: "var(--foreground)",
                maxWidth: "min(20rem, 75vw)",
                whiteSpace: "normal",
              }}
              labelStyle={{ overflowWrap: "anywhere" }}
            />
            <Bar
              dataKey="count"
              name="Selections"
              fill="var(--primary)"
              radius={[0, 4, 4, 0]}
              maxBarSize={28}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul
        aria-label="Category usage values"
        className="mt-5 grid min-w-0 gap-3 border-t pt-5 sm:grid-cols-2"
      >
        {categories.map((category) => (
          <li
            key={category.id}
            className="flex min-w-0 items-start justify-between gap-3 text-sm leading-6"
          >
            <span className="min-w-0 wrap-break-word text-muted-foreground">
              {category.name}
            </span>
            <span className="shrink-0 font-medium tabular-nums">
              {category.count.toLocaleString("en")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
