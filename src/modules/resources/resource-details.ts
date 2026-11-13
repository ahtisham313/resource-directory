import "server-only";
import { getDb } from "@/lib/db";
import {
  parseSurveyDefinition,
  surveyIdSchema,
} from "@/modules/surveys/survey-definition";
import { surveyAnswerSchema } from "@/modules/surveys/survey-snapshot";
import { displaySurveyAnswer } from "@/modules/surveys/answer-display";
import { publicResource } from "./directory-query";
import {
  DirectoryError,
  safeWebsite,
  type ResourceDetail,
} from "./directory-types";

export async function getPublicResource(id: string): Promise<ResourceDetail> {
  if (!surveyIdSchema.safeParse(id).success)
    throw new DirectoryError(404, "Resource not found.");
  const row = await getDb().resource.findFirst({
    where: { id, active: true },
    select: {
      id: true,
      name: true,
      providerName: true,
      description: true,
      address: true,
      phone: true,
      website: true,
      officeHours: true,
      timeZone: true,
      ageRange: true,
      averageWait: true,
      imageKey: true,
      currentAnswers: true,
      surveyVersionId: true,
      categories: {
        select: { category: { select: { name: true } } },
        orderBy: { category: { name: "asc" } },
      },
    },
  });
  if (!row)
    throw new DirectoryError(404, "This resource is no longer available.");
  const version = await getDb().surveyVersion.findUnique({
    where: { id: row.surveyVersionId },
    select: { snapshot: true },
  });
  let snapshot;
  try {
    snapshot = parseSurveyDefinition(version?.snapshot);
  } catch {
    throw new DirectoryError(
      422,
      "Full provider details are currently unavailable.",
    );
  }
  const answers =
    row.currentAnswers &&
    typeof row.currentAnswers === "object" &&
    !Array.isArray(row.currentAnswers)
      ? row.currentAnswers
      : {};
  const resource = publicResource(
    {
      ...row,
      categories: row.categories.map((link) => link.category.name),
      hasImage: Boolean(row.imageKey),
      distanceMiles: null,
    },
    new Date(),
  );
  const sections = snapshot.sections.map((section) => ({
    title: section.title,
    fields: section.fields.map((field) => {
      const parsed = surveyAnswerSchema.safeParse(answers[field.fieldKey]);
      const answer = parsed.success ? parsed.data : undefined;
      return {
        key: field.fieldKey,
        label: field.label,
        text:
          parsed.success || answers[field.fieldKey] === undefined
            ? displaySurveyAnswer(field, answer, Boolean(row.imageKey))
            : "Information unavailable",
        content:
          field.fieldType === "TERMS_ACKNOWLEDGEMENT"
            ? field.content || snapshot.termsText
            : null,
        url:
          field.fieldType === "URL" && typeof answer?.value === "string"
            ? safeWebsite(answer.value)
            : null,
        image: field.fieldType === "IMAGE_UPLOAD",
      };
    }),
  }));
  // Recheck visibility after loading the version; never return a newly deactivated resource.
  if (
    !(await getDb().resource.findFirst({
      where: { id, active: true },
      select: { id: true },
    }))
  )
    throw new DirectoryError(404, "This resource is no longer available.");
  return { resource, sections };
}
