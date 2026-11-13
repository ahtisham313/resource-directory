import "server-only";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { createSubmissionLimiter } from "@/modules/surveys/submission-limiter";
import { AnalyticsError } from "./analytics-period";

const selectionSchema = z
  .object({
    event: z.literal("category_selected"),
    categorySlug: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    eventId: z.uuid(),
  })
  .strict();
const limit = createSubmissionLimiter(30, 60000, 1000);
export function categoryRetryAfter(request: Request) {
  const address = (
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  ).slice(0, 128);
  const key = createHmac(
    "sha256",
    process.env.AUTH_SECRET || "local-category-rate-limit",
  )
    .update(address)
    .digest("hex");
  return limit(key);
}
export async function recordCategorySelection(input: unknown) {
  const parsed = selectionSchema.safeParse(input);
  if (!parsed.success)
    throw new AnalyticsError(400, "Choose a valid directory category.");
  const category = await getDb().category.findUnique({
    where: { slug: parsed.data.categorySlug },
    select: { id: true },
  });
  if (!category) throw new AnalyticsError(404, "Category not found.");
  // PostgreSQL handles retry races with INSERT ... ON CONFLICT DO NOTHING.
  await getDb().analyticsEvent.createMany({
    skipDuplicates: true,
    data: [
      {
        id: parsed.data.eventId,
        eventType: "CATEGORY_SELECTION",
        categoryId: category.id,
      },
    ],
  });
}
