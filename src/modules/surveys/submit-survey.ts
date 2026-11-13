import "server-only";
import { getDb } from "@/lib/db";
import {
  createImageKey,
  getImageStorage,
  type ImageStorage,
} from "@/lib/image-storage";
import { SurveyAnswerError, validateSurveyAnswers } from "./answer-validation";
import { getImageField, surveyIdSchema } from "./survey-definition";
import { getPublishedSurvey } from "./published-survey";
import { SurveyServiceError } from "./survey-error";
import { validateImage } from "./validate-image";

export async function submitSurvey(
  id: string,
  versionId: string,
  input: unknown,
  file?: File,
) {
  if (!surveyIdSchema.safeParse(versionId).success)
    throw new SurveyServiceError(400, "Reload the survey and try again.");
  const published = await getPublishedSurvey(id);
  if (published.versionId !== versionId)
    throw new SurveyServiceError(
      409,
      "The survey has changed. Reload this page before submitting.",
    );
  let answers;
  try {
    answers = validateSurveyAnswers(published.snapshot, input, Boolean(file));
  } catch (error) {
    if (error instanceof SurveyAnswerError)
      throw new SurveyServiceError(
        422,
        "Please check the highlighted answers.",
        error.fieldErrors,
      );
    throw error;
  }
  const imageField = getImageField(published.snapshot);
  if (file && !imageField)
    throw new SurveyServiceError(422, "This survey does not accept an image.");
  const image =
    file && imageField ? await validateImage(file, imageField) : undefined;
  let storage: ImageStorage | undefined;
  let imageKey: string | undefined;
  let imageVersion: string | undefined;
  try {
    if (image) {
      storage = getImageStorage();
      imageKey = createImageKey(image.extension);
      imageVersion = await storage.put(imageKey, image);
    }
    await getDb().$transaction(async (tx) => {
      // Hold publication changes until the response is saved, including while checking the version again.
      await tx.$queryRaw`SELECT id FROM "Survey" WHERE id = ${id} FOR SHARE`;
      const current = await getPublishedSurvey(id, tx);
      if (current.versionId !== versionId)
        throw new SurveyServiceError(
          409,
          "The survey has changed. Reload this page before submitting.",
        );
      await tx.surveyResponse.create({
        data: {
          surveyId: id,
          surveyVersionId: versionId,
          answers,
          uploadedImageKey: imageKey ?? null,
          status: "PENDING",
        },
      });
    });
  } catch (error) {
    if (storage && imageKey) {
      try {
        await storage.remove(imageKey, imageVersion);
      } catch {
        console.error(
          "Failed to clean up a survey image after an unsuccessful submission.",
        );
      }
    }
    if (error instanceof SurveyServiceError) throw error;
    throw new SurveyServiceError(
      503,
      "Unable to save your submission. Please try again. You can remove the image and retry if uploads are unavailable.",
    );
  }
  return {
    message: published.snapshot.closingMessage,
    status: "PENDING" as const,
  };
}
