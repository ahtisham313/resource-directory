import { z } from "zod";

export const directoryFiltersSchema = z.object({
  search: z.string().trim().max(100).catch(""),
  category: z
    .string()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
    .max(128)
    .catch(""),
  sort: z.enum(["daily", "az", "za", "nearest", "farthest"]).catch("daily"),
  page: z.coerce.number().int().min(1).max(100000).catch(1),
  view: z.enum(["cards", "list"]).catch("cards"),
});
export type DirectoryFilters = z.infer<typeof directoryFiltersSchema>;
export const visitorCoordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();
export type VisitorCoordinates = z.infer<typeof visitorCoordinatesSchema>;

export const publicResourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  providerName: z.string().nullable(),
  categories: z.array(z.string()),
  description: z.string(),
  address: z.string(),
  phone: z.string(),
  website: z.string().nullable(),
  officeHours: z.string(),
  timeZone: z.string(),
  openState: z.enum(["Open", "Closed", "Hours unavailable"]),
  ageRange: z.array(z.string()),
  averageWait: z.string().nullable(),
  imageUrl: z.string(),
  distanceMiles: z.number().finite().nonnegative().nullable(),
});
export type PublicResource = z.infer<typeof publicResourceSchema>;
export const directoryResultSchema = z.object({
  resources: z.array(publicResourceSchema),
  total: z.number().int().nonnegative(),
  pages: z.number().int().positive(),
  filters: directoryFiltersSchema,
  locationEnabled: z.boolean(),
  orderDate: z.string(),
});
export type DirectoryResult = z.infer<typeof directoryResultSchema>;
export type DirectoryOptions = {
  categories: Array<{ slug: string; name: string }>;
  surveyPath: string | null;
};
export const resourceDetailSchema = z.object({
  resource: publicResourceSchema,
  sections: z.array(
    z.object({
      title: z.string(),
      fields: z.array(
        z.object({
          key: z.string(),
          label: z.string(),
          text: z.string(),
          content: z.string().nullable(),
          url: z.string().nullable(),
          image: z.boolean(),
        }),
      ),
    }),
  ),
});
export type ResourceDetail = z.infer<typeof resourceDetailSchema>;

export function directoryUrl(filters: DirectoryFilters): string {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.category) params.set("category", filters.category);
  if (filters.sort !== "daily") params.set("sort", filters.sort);
  if (filters.page > 1) params.set("page", String(filters.page));
  if (filters.view !== "cards") params.set("view", filters.view);
  return params.size ? `/?${params}` : "/";
}

export function safeWebsite(input: string | null | undefined): string | null {
  if (!input) return null;
  try {
    const url = new URL(input);
    return ["http:", "https:"].includes(url.protocol) &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
}

export class DirectoryError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "DirectoryError";
  }
}
