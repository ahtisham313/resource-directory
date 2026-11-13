import type { SurveyAnswers, SurveyFieldDefinition } from "./survey-snapshot";

export function displaySurveyAnswer(
  field: SurveyFieldDefinition,
  answer: SurveyAnswers[string] | undefined,
  hasImage = false,
): string {
  if (
    field.fieldType === "DISPLAY_TEXT" ||
    field.fieldType === "SECTION_HEADING"
  )
    return field.content ?? field.label;
  if (field.fieldType === "IMAGE_UPLOAD")
    return hasImage ? "Image supplied" : "Default image";
  if (answer?.notApplicable) return "N/A";
  if (
    !answer ||
    answer.value === null ||
    answer.value === "" ||
    (Array.isArray(answer.value) && !answer.value.length)
  )
    return "Not provided";
  if (field.fieldType === "TERMS_ACKNOWLEDGEMENT")
    return answer.value === true ? "Agreed" : "Not agreed";
  const values = Array.isArray(answer.value) ? answer.value : [answer.value];
  return values
    .map((value) => {
      const option = field.options.find((option) => option.value === value);
      return option?.kind === "OTHER"
        ? answer.otherText?.trim() || option.label
        : (option?.label ?? String(value));
    })
    .join(", ");
}
