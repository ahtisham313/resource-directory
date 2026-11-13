import type { SurveyFieldDefinition } from "./survey-snapshot";

export const maxImageBytes = 2 * 1024 * 1024;
export const imageMimeTypes = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;
export const defaultProviderImage = "/provider-default.svg";

export function imageMetadataError(
  file: Pick<File, "size" | "type">,
  field?: SurveyFieldDefinition,
): string | null {
  const maximum = Math.min(
    maxImageBytes,
    field?.validationRules.maxBytes ?? maxImageBytes,
  );
  if (!file.size) return "Choose a non-empty image.";
  if (file.size > maximum)
    return `The image must be ${maximum / 1024 / 1024} MB or smaller.`;
  const allowed: readonly string[] =
    field?.validationRules.mimeTypes ?? imageMimeTypes;
  if (
    !imageMimeTypes.some((type) => type === file.type) ||
    !allowed.includes(file.type)
  )
    return "Choose a PNG, JPG, or WEBP image.";
  return null;
}
