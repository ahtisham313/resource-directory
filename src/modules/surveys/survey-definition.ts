import { z } from "zod";
import {
  surveySnapshotSchema,
  type SurveySnapshot,
  type SurveyFieldDefinition,
} from "./survey-snapshot";

export const surveyIdSchema = z
  .string()
  .regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/);
export const displayFieldTypes = new Set(["DISPLAY_TEXT", "SECTION_HEADING"]);
export const choiceFieldTypes = new Set([
  "SINGLE_SELECT",
  "RADIO",
  "MULTI_SELECT",
  "DAY_OF_WEEK",
]);

export function parseSurveyDefinition(
  input: unknown,
  surveyId?: string,
): SurveySnapshot {
  const snapshot = surveySnapshotSchema.parse(input);
  if (surveyId && snapshot.surveyId !== surveyId)
    throw new Error("Survey snapshot identity does not match.");
  const imageFields = snapshot.sections
    .flatMap((section) => section.fields)
    .filter((field) => field.fieldType === "IMAGE_UPLOAD");
  if (imageFields.length > 1)
    throw new Error("Only one image field is supported.");
  if (
    !snapshot.sections.some((section) =>
      section.fields.some(
        (field) =>
          field.fieldType === "TERMS_ACKNOWLEDGEMENT" && field.required,
      ),
    )
  ) {
    throw new Error("A public survey requires terms acknowledgement.");
  }
  return {
    ...snapshot,
    sections: [...snapshot.sections]
      .sort((a, b) => a.order - b.order)
      .map((section) => ({
        ...section,
        fields: [...section.fields]
          .sort((a, b) => a.order - b.order)
          .map((field) => ({
            ...field,
            options: [...field.options].sort((a, b) => a.order - b.order),
          })),
      })),
  };
}

export function getImageField(
  snapshot: SurveySnapshot,
): SurveyFieldDefinition | undefined {
  return snapshot.sections
    .flatMap((section) => section.fields)
    .find((field) => field.fieldType === "IMAGE_UPLOAD");
}

export function countWords(value: string): number {
  return value.trim().split(/\s+/u).filter(Boolean).length;
}
