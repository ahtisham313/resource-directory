import { describe, expect, it } from "vitest";
import { defaultSurvey } from "../prisma/seed-data/default-survey";
import { getImageField } from "../src/modules/surveys/survey-definition";
import { validateImage } from "../src/modules/surveys/validate-image";
import {
  imageMetadataError,
  maxImageBytes,
  defaultProviderImage,
} from "../src/modules/surveys/image-rules";
import { createImageKey } from "../src/lib/image-storage";
import { surveyImage } from "./fixtures/survey-images";

const field = getImageField(defaultSurvey)!;
describe("survey image validation", () => {
  it.each(["png", "jpg", "webp"] as const)(
    "accepts actual %s image content",
    async (format) => {
      const image = await validateImage(surveyImage(format), field);
      expect(image.extension).toBe(format);
    },
  );
  it("rejects unsupported, empty and oversized files", async () => {
    for (const file of [
      new File(["<svg/>"], "image.svg", { type: "image/svg+xml" }),
      new File([], "empty.png", { type: "image/png" }),
      new File([new Uint8Array(maxImageBytes + 1)], "large.png", {
        type: "image/png",
      }),
    ])
      await expect(validateImage(file, field)).rejects.toMatchObject({
        fieldErrors: { image: expect.any(String) },
      });
  });
  it("rejects fake signatures and mismatched MIME metadata", async () => {
    await expect(
      validateImage(
        new File(["not an image"], "fake.png", { type: "image/png" }),
        field,
      ),
    ).rejects.toThrow();
    const png = surveyImage();
    await expect(
      validateImage(
        new File([await png.arrayBuffer()], "fake.jpg", { type: "image/jpeg" }),
        field,
      ),
    ).rejects.toThrow();
  });
  it("uses generated keys independent of unsafe filenames", async () => {
    const image = await validateImage(
      surveyImage("png", "../../private/unsafe.png"),
      field,
    );
    const key = createImageKey(image.extension);
    expect(key).toMatch(/^pending\/[a-f0-9-]{36}\.png$/);
    expect(createImageKey(image.extension)).not.toBe(key);
  });
  it("uses the application fallback and definition-specific upload limits", () => {
    expect(defaultProviderImage).toBe("/provider-default.svg");
    expect(
      imageMetadataError(
        { size: 101, type: "image/png" },
        { ...field, validationRules: { maxBytes: 100 } },
      ),
    ).toContain("smaller");
  });
});
