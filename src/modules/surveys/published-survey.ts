import "server-only";
import { getDb } from "@/lib/db";
import type { Prisma } from "@/generated/prisma/client";
import { parseSurveyDefinition, surveyIdSchema } from "./survey-definition";
import { SurveyServiceError } from "./survey-error";

export async function getPublishedSurvey(
  id: string,
  db: Pick<Prisma.TransactionClient, "survey"> = getDb(),
) {
  if (!surveyIdSchema.safeParse(id).success)
    throw new SurveyServiceError(404, "This survey is not available.");
  const survey = await db.survey.findUnique({
    where: { id },
    select: {
      status: true,
      deletedAt: true,
      publishedVersion: { select: { id: true, snapshot: true } },
    },
  });
  if (
    !survey ||
    survey.status !== "PUBLISHED" ||
    survey.deletedAt ||
    !survey.publishedVersion
  )
    throw new SurveyServiceError(404, "This survey is not available.");
  try {
    return {
      versionId: survey.publishedVersion.id,
      snapshot: parseSurveyDefinition(survey.publishedVersion.snapshot, id),
    };
  } catch {
    throw new SurveyServiceError(
      503,
      "This survey is temporarily unavailable. Please try again later.",
    );
  }
}
