import type { SurveyDraft } from "./builder-schema";
import type { SurveyFieldDefinition } from "./survey-snapshot";

export function normalizeDraft(draft: SurveyDraft): SurveyDraft {
  let order = 0;
  draft.sections.forEach((section, index) => {
    section.order = index + 1;
    section.fields.forEach((field) => {
      field.order = ++order;
      field.options.forEach((option, index) => {
        option.order = index;
      });
    });
  });
  return draft;
}
export function newQuestion(): SurveyFieldDefinition {
  const id = crypto.randomUUID();
  return {
    id,
    fieldKey: `question-${id.slice(0, 8)}`,
    label: "New question",
    fieldType: "SHORT_TEXT",
    helperText: null,
    placeholder: null,
    content: null,
    required: false,
    order: 0,
    validationRules: {},
    displayMapping: null,
    allowsOther: false,
    allowsNA: false,
    options: [],
  };
}
export function dayOptions() {
  return [
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
    "Sunday",
  ].map((label, order) => ({
    id: crypto.randomUUID(),
    label,
    value: label.toLowerCase(),
    order,
    kind: "STANDARD" as const,
  }));
}
