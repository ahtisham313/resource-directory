import { randomUUID, randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { afterAll, expect, it, vi } from "vitest";
import { getDb } from "../src/lib/db";
import { AuthorizationError } from "../src/modules/auth/authorization";
import { getAnalytics } from "../src/modules/analytics/analytics-data";
import { recordCategorySelection } from "../src/modules/analytics/category-events";
const { currentAdmin } = vi.hoisted(() => ({ currentAdmin: vi.fn() }));
vi.mock("@/modules/auth/authorization", async (original) => ({
  ...(await original<typeof import("../src/modules/auth/authorization")>()),
  requireAdmin: currentAdmin,
}));
const url = process.env.DATABASE_TEST_URL;
if (
  !url ||
  url !== process.env.DATABASE_URL ||
  !["localhost", "127.0.0.1", "[::1]"].includes(new URL(url).hostname) ||
  !/^\/resource_directory_test_[a-f0-9]+$/.test(new URL(url).pathname)
)
  throw new Error(
    "Run using npm run test:db with a disposable local database.",
  );
afterAll(async () => {
  vi.unstubAllEnvs();
  await getDb().$disconnect();
});
it("records each category selection once, aggregates UTC boundaries including zero-use categories, and authorizes reports", async () => {
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  const db = getDb(),
    marker = randomUUID();
  const admin = await db.adminUser.create({
    data: {
      name: "Analytics fixture",
      email: `analytics-${marker}@example.com`,
      passwordHash: await hash(randomBytes(24).toString("hex"), 4),
    },
  });
  currentAdmin.mockResolvedValue(admin);
  const [first, zero] = await Promise.all([
    db.category.create({
      data: {
        name: "Analytics fixture used",
        slug: `analytics-used-${marker}`,
      },
    }),
    db.category.create({
      data: {
        name: "Analytics fixture zero",
        slug: `analytics-zero-${marker}`,
      },
    }),
  ]);
  const eventId = randomUUID(),
    input = { event: "category_selected", categorySlug: first.slug, eventId };
  await Promise.all([
    recordCategorySelection(input),
    recordCategorySelection(input),
  ]);
  expect(await db.analyticsEvent.count({ where: { id: eventId } })).toBe(1);
  expect(
    await db.analyticsEvent.findUnique({
      where: { id: eventId },
      select: {
        categoryId: true,
        eventType: true,
        anonymousSessionId: true,
        metadata: true,
      },
    }),
  ).toEqual({
    categoryId: first.id,
    eventType: "CATEGORY_SELECTION",
    anonymousSessionId: null,
    metadata: null,
  });
  await expect(
    recordCategorySelection({
      ...input,
      eventId: randomUUID(),
      categorySlug: "not-a-category",
    }),
  ).rejects.toMatchObject({ status: 404 });
  await expect(
    recordCategorySelection({
      ...input,
      eventId: randomUUID(),
      answers: "private",
    }),
  ).rejects.toMatchObject({ status: 400 });
  for (const [timestamp, eventType] of [
    ["2024-02-01T00:00:00.000Z", "CATEGORY_SELECTION"],
    ["2024-02-29T23:59:59.999Z", "CATEGORY_SELECTION"],
    ["2024-03-01T00:00:00.000Z", "CATEGORY_SELECTION"],
    ["2024-02-15T00:00:00.000Z", "CATEGORY_VIEW"],
  ] as const)
    await db.analyticsEvent.create({
      data: { categoryId: first.id, eventType, createdAt: new Date(timestamp) },
    });
  const report = await getAnalytics({
    mode: "month",
    year: "2024",
    month: "2",
  });
  expect(report.categories.find((row) => row.id === first.id)?.count).toBe(2);
  expect(report.categories.find((row) => row.id === zero.id)?.count).toBe(0);
  expect(report.totals).toEqual({
    resources: await db.resource.count(),
    pending: await db.surveyResponse.count({ where: { status: "PENDING" } }),
    admins: await db.adminUser.count(),
  });
  const day = await getAnalytics({ mode: "range", start: "2024-02-29" });
  expect(day.categories.find((row) => row.id === first.id)?.count).toBe(1);
  currentAdmin.mockRejectedValue(new AuthorizationError(401));
  await expect(getAnalytics({})).rejects.toMatchObject({ status: 401 });
});
