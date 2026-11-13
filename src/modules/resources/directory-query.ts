import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { isImageStorageConfigured } from "@/lib/image-storage";
import { defaultProviderImage } from "@/modules/surveys/image-rules";
import { officeStatus } from "./office-hours";
import {
  directoryFiltersSchema,
  visitorCoordinatesSchema,
  safeWebsite,
  type DirectoryResult,
  type DirectoryOptions,
  type PublicResource,
  type VisitorCoordinates,
} from "./directory-types";

type CardRow = {
  id: string;
  name: string;
  providerName: string | null;
  description: string;
  address: string;
  phone: string;
  website: string | null;
  officeHours: Prisma.JsonValue;
  timeZone: string;
  ageRange: string[];
  averageWait: string | null;
  hasImage: boolean;
  categories: string[];
  distanceMiles: number | null;
};

export function publicResource(row: CardRow, now: Date): PublicResource {
  return {
    id: row.id,
    name: row.name,
    providerName: row.providerName,
    description: row.description,
    address: row.address,
    phone: row.phone,
    website: safeWebsite(row.website),
    ...officeStatus(row.officeHours, row.timeZone, now),
    timeZone: row.timeZone,
    ageRange: row.ageRange,
    averageWait: row.averageWait,
    categories: row.categories,
    imageUrl:
      row.hasImage && isImageStorageConfigured()
        ? `/api/resources/${row.id}/image`
        : defaultProviderImage,
    distanceMiles: row.distanceMiles,
  };
}

export async function getDirectoryOptions(): Promise<DirectoryOptions> {
  const [categories, survey] = await Promise.all([
    getDb().category.findMany({
      select: { slug: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    getDb().survey.findFirst({
      where: {
        status: "PUBLISHED",
        deletedAt: null,
        publishedVersionId: { not: null },
      },
      select: { id: true },
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
    }),
  ]);
  return { categories, surveyPath: survey ? `/survey/${survey.id}` : null };
}

export async function queryDirectory(
  input: unknown,
  location?: VisitorCoordinates | null,
  now = new Date(),
): Promise<DirectoryResult> {
  const filters = directoryFiltersSchema.parse(input ?? {});
  const coordinates = location
    ? visitorCoordinatesSchema.parse(location)
    : null;
  if (!coordinates && ["nearest", "farthest"].includes(filters.sort))
    filters.sort = "daily";
  const orderDate = now.toISOString().slice(0, 10);
  const pattern = `%${filters.search.replace(/[\\%_]/g, "\\$&")}%`;
  const where = Prisma.sql`r.active = true
    AND (${filters.search} = '' OR r.name ILIKE ${pattern} OR r."providerName" ILIKE ${pattern} OR r.address ILIKE ${pattern}
      OR EXISTS (SELECT 1 FROM "ResourceCategory" rc JOIN "Category" c ON c.id = rc."categoryId" WHERE rc."resourceId" = r.id AND c.name ILIKE ${pattern}))
    AND (${filters.category} = '' OR EXISTS (SELECT 1 FROM "ResourceCategory" rc JOIN "Category" c ON c.id = rc."categoryId" WHERE rc."resourceId" = r.id AND c.slug = ${filters.category}))`;
  const distance = coordinates
    ? Prisma.sql`CASE WHEN r.latitude BETWEEN -90 AND 90 AND r.longitude BETWEEN -180 AND 180
    THEN 3958.7613 * 2 * asin(sqrt(LEAST(1.0, GREATEST(0.0,
      power(sin(radians(r.latitude - ${coordinates.latitude}::double precision) / 2), 2)
      + cos(radians(${coordinates.latitude}::double precision)) * cos(radians(r.latitude))
      * power(sin(radians(r.longitude - ${coordinates.longitude}::double precision) / 2), 2)))))
    ELSE NULL END`
    : Prisma.sql`NULL::double precision`;
  const orders = {
    daily: Prisma.sql`md5(${orderDate} || ':' || r.id) ASC, r.id ASC`,
    az: Prisma.sql`lower(r.name) ASC, r.id ASC`,
    za: Prisma.sql`lower(r.name) DESC, r.id ASC`,
    nearest: Prisma.sql`r."distanceMiles" ASC NULLS LAST, r.id ASC`,
    farthest: Prisma.sql`r."distanceMiles" DESC NULLS LAST, r.id ASC`,
  };
  return getDb().$transaction(
    async (tx) => {
      const counts = await tx.$queryRaw<Array<{ total: number }>>(
        Prisma.sql`SELECT count(*)::int AS total FROM "Resource" r WHERE ${where}`,
      );
      const total = counts[0]?.total ?? 0;
      const pages = Math.max(1, Math.ceil(total / 10));
      filters.page = Math.min(filters.page, pages);
      const rows = await tx.$queryRaw<CardRow[]>(Prisma.sql`
      WITH matching AS (
        SELECT r.id, r.name, r."providerName", r.description, r.address, r.phone, r.website,
          r."officeHours", r."timeZone", r."ageRange", r."averageWait", (r."imageKey" IS NOT NULL) AS "hasImage",
          ${distance} AS "distanceMiles"
        FROM "Resource" r WHERE ${where}
      )
      SELECT r.*, ARRAY(SELECT c.name FROM "ResourceCategory" rc JOIN "Category" c ON c.id = rc."categoryId"
        WHERE rc."resourceId" = r.id ORDER BY c.name, c.id) AS categories
      FROM matching r ORDER BY ${orders[filters.sort]} LIMIT 10 OFFSET ${(filters.page - 1) * 10}`);
      return {
        resources: rows.map((row) => publicResource(row, now)),
        total,
        pages,
        filters,
        locationEnabled: Boolean(coordinates),
        orderDate,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
  );
}
