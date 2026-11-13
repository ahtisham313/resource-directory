import { z } from "zod";
import { surveyIdSchema } from "@/modules/surveys/survey-definition";

export const responseIdSchema = surveyIdSchema;
export const responseFiltersSchema = z.object({
  q: z.string().trim().max(100).default(""),
  status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("ALL"),
  page: z.coerce.number().int().min(1).max(100000).default(1),
});
export type ResponseFilters = z.infer<typeof responseFiltersSchema>;
export const coordinatesSchema = z
  .object({
    latitude: z.number().finite().min(-90).max(90),
    longitude: z.number().finite().min(-180).max(180),
  })
  .strict();
export type Coordinates = z.infer<typeof coordinatesSchema>;
export const reviewNoteSchema = z.string().trim().max(2000).optional();
export const rejectInputSchema = z.object({ note: reviewNoteSchema }).strict();
export const approveInputSchema = z
  .object({ note: reviewNoteSchema, coordinates: coordinatesSchema.optional() })
  .strict();

export class ReviewError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: "COORDINATES_REQUIRED",
  ) {
    super(message);
    this.name = "ReviewError";
  }
}
