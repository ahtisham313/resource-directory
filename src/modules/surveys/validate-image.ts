import "server-only";
import { imageMetadataError } from "./image-rules";
import type { SurveyFieldDefinition } from "./survey-snapshot";
import { SurveyServiceError } from "./survey-error";

export type ValidatedImage = {
  bytes: Uint8Array;
  contentType: "image/png" | "image/jpeg" | "image/webp";
  extension: "png" | "jpg" | "webp";
};

export async function validateImage(
  file: File,
  field: SurveyFieldDefinition,
): Promise<ValidatedImage> {
  const fail = (message: string, status = 422): never => {
    throw new SurveyServiceError(status, "Check the selected image.", {
      [field.fieldKey]: message,
    });
  };
  const metadataError = imageMetadataError(file, field);
  if (metadataError)
    fail(
      metadataError,
      file.size > Math.min(2097152, field.validationRules.maxBytes ?? 2097152)
        ? 413
        : 422,
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  let image: ValidatedImage | undefined;
  if (
    bytes.length >= 45 &&
    bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
    bytes.readUInt32BE(8) === 13 &&
    bytes.toString("ascii", 12, 16) === "IHDR" &&
    bytes.readUInt32BE(16) > 0 &&
    bytes.readUInt32BE(20) > 0 &&
    bytes.toString("ascii", bytes.length - 8, bytes.length - 4) === "IEND"
  ) {
    image = { bytes, contentType: "image/png", extension: "png" };
  } else if (
    bytes.length >= 12 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255 &&
    bytes[bytes.length - 2] === 255 &&
    bytes[bytes.length - 1] === 217
  ) {
    image = { bytes, contentType: "image/jpeg", extension: "jpg" };
  } else if (
    bytes.length >= 20 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP" &&
    bytes.readUInt32LE(4) + 8 === bytes.length &&
    ["VP8 ", "VP8L", "VP8X"].includes(bytes.toString("ascii", 12, 16))
  ) {
    image = { bytes, contentType: "image/webp", extension: "webp" };
  }
  if (!image || image.contentType !== file.type)
    return fail("The file content must match a valid PNG, JPG, or WEBP image.");
  return image;
}
