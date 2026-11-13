import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { requireAdmin } from "@/modules/auth/authorization";
import { parseAnalyticsPeriod } from "./analytics-period";
import {
  getPosthogSessions,
  isPublicPosthogConfigured,
} from "./posthog-sessions";

export async function getAnalytics(input: unknown) {
  await requireAdmin();
  const period = parseAnalyticsPeriod(input);
  const [local, sessions] = await Promise.all([
    getDb().$transaction(
      async (tx) => {
        const resources = await tx.resource.count(),
          pending = await tx.surveyResponse.count({
            where: { status: "PENDING" },
          }),
          admins = await tx.adminUser.count();
        const categories = await tx.category.findMany({
          select: { id: true, name: true },
          orderBy: [{ name: "asc" }, { id: "asc" }],
        });
        const usage = await tx.analyticsEvent.groupBy({
          by: ["categoryId"],
          where: {
            eventType: "CATEGORY_SELECTION",
            categoryId: { not: null },
            createdAt: {
              gte: new Date(period.startIso),
              lt: new Date(period.endIso),
            },
          },
          _count: { _all: true },
        });
        const counts = new Map(
          usage.map((row) => [row.categoryId, row._count._all]),
        );
        const rows = categories
          .map((category) => ({
            ...category,
            count: counts.get(category.id) ?? 0,
          }))
          .sort(
            (a, b) =>
              b.count - a.count ||
              a.name.localeCompare(b.name, "en") ||
              a.id.localeCompare(b.id),
          );
        return { totals: { resources, pending, admins }, categories: rows };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    ),
    getPosthogSessions(period),
  ]);
  return {
    ...local,
    period,
    sessions,
    publicTrackingConfigured: isPublicPosthogConfigured(),
  };
}
