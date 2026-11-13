import { z } from "zod";
import {
  surveyFieldSchema,
  fieldKeySchema,
  type SurveySnapshot,
  type SurveyFieldDefinition,
} from "./survey-snapshot";
import { choiceFieldTypes, displayFieldTypes } from "./survey-definition";

const identifier = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/);
const nullableText = z.string().max(20000).nullable();
export const draftDefinitionSchema = z
  .object({
    schemaVersion: z.literal(1),
    surveyId: identifier,
    title: z.string().trim().min(1, "Enter a survey title.").max(200),
    introText: z.string().max(20000),
    closingMessage: z.string().max(20000),
    termsText: z.string().max(20000),
    deadlineText: nullableText,
    contactName: z.string().max(200).nullable(),
    contactEmail: z.email().nullable(),
    sections: z
      .array(
        z
          .object({
            id: identifier,
            title: z.string().trim().min(1, "Enter a section title.").max(200),
            order: z.number().int().min(0).max(10000),
            fields: z
              .array(
                surveyFieldSchema.extend({
                  id: identifier,
                  fieldKey: fieldKeySchema.max(100),
                  label: z.string().trim().min(1).max(1000),
                  helperText: nullableText,
                  placeholder: z.string().max(1000).nullable(),
                  content: nullableText,
                  options: z
                    .array(
                      surveyFieldSchema.shape.options.element.extend({
                        id: identifier,
                        value: z.string().trim().min(1).max(200),
                        label: z.string().trim().min(1).max(1000),
                      }),
                    )
                    .max(100),
                }),
              )
              .max(200),
          })
          .strict(),
      )
      .max(30),
  })
  .strict()
  .superRefine((draft, context) => {
    const ids = new Set<string>(),
      keys = new Set<string>(),
      sectionOrders = new Set<number>(),
      mappings = new Set<string>();
    let fields = 0,
      images = 0;
    const fail = (path: Array<string | number>, message: string) =>
      context.addIssue({ code: "custom", path, message });
    const identity = (id: string, path: Array<string | number>) => {
      if (ids.has(id)) fail(path, "Use a unique identifier.");
      ids.add(id);
    };
    for (const [si, section] of draft.sections.entries()) {
      const path = ["sections", si];
      identity(section.id, [...path, "id"]);
      if (sectionOrders.has(section.order))
        fail([...path, "order"], "Section order must be unique.");
      sectionOrders.add(section.order);
      const orders = new Set<number>();
      for (const [fi, field] of section.fields.entries()) {
        fields++;
        const fp = [...path, "fields", fi];
        identity(field.id, [...fp, "id"]);
        if (keys.has(field.fieldKey))
          fail([...fp, "fieldKey"], "Field keys must be unique.");
        keys.add(field.fieldKey);
        if (orders.has(field.order))
          fail(
            [...fp, "order"],
            "Question order must be unique within a section.",
          );
        orders.add(field.order);
        const mapping = field.displayMapping;
        if (mapping && !mappingTypes[mapping].includes(field.fieldType))
          fail(
            [...fp, "displayMapping"],
            `${mappingLabels[mapping]} is not compatible with this field type.`,
          );
        if (
          mapping &&
          !["CATEGORY", "SPECIALTY", "DESCRIPTION", "AGE_RANGE"].includes(
            mapping,
          )
        ) {
          if (mappings.has(mapping))
            fail(
              [...fp, "displayMapping"],
              "This directory mapping is already assigned.",
            );
          mappings.add(mapping);
        }
        if (field.fieldType === "IMAGE_UPLOAD") images++;
        if (
          (displayFieldTypes.has(field.fieldType) ||
            field.fieldType === "TERMS_ACKNOWLEDGEMENT" ||
            field.fieldType === "IMAGE_UPLOAD") &&
          (field.allowsOther || field.allowsNA)
        )
          fail(fp, "Other and N/A are not supported for this field type.");
        if (displayFieldTypes.has(field.fieldType) && field.required)
          fail([...fp, "required"], "Display-only fields cannot be required.");
        const choice = choiceFieldTypes.has(field.fieldType);
        if (!choice && (field.options.length || field.allowsOther))
          fail(
            [...fp, "options"],
            "Only selection fields can have options or Other.",
          );
        const values = new Set<string>(),
          optionOrders = new Set<number>();
        for (const [oi, option] of field.options.entries()) {
          const op = [...fp, "options", oi];
          identity(option.id, [...op, "id"]);
          if (values.has(option.value))
            fail([...op, "value"], "Option values must be unique.");
          values.add(option.value);
          if (optionOrders.has(option.order))
            fail([...op, "order"], "Option order must be unique.");
          optionOrders.add(option.order);
          if (option.kind === "OTHER" && !field.allowsOther)
            fail(op, "Enable Other to use this option.");
          if (option.kind === "NA" && !field.allowsNA)
            fail(op, "Enable N/A to use this option.");
        }
        for (const [kind, enabled] of [
          ["OTHER", field.allowsOther],
          ["NA", field.allowsNA],
        ] as const) {
          const count = field.options.filter(
            (option) => option.kind === kind,
          ).length;
          if (count > 1 || (choice && enabled && count !== 1))
            fail(
              [...fp, "options"],
              `Use exactly one ${kind === "OTHER" ? "Other" : "N/A"} option when enabled.`,
            );
        }
        const rules = field.validationRules;
        const textField = [
          "SHORT_TEXT",
          "LONG_TEXT",
          "EMAIL",
          "PHONE",
          "URL",
          "TIME",
        ].includes(field.fieldType);
        if (
          !textField &&
          (rules.minLength !== undefined ||
            rules.maxLength !== undefined ||
            rules.pattern !== undefined)
        )
          fail(
            [...fp, "validationRules"],
            "Character limits and patterns require a text input.",
          );
        if (
          rules.format &&
          !{
            zip: ["SHORT_TEXT"],
            phone: ["SHORT_TEXT", "PHONE"],
            "iana-time-zone": ["SHORT_TEXT", "SINGLE_SELECT", "RADIO"],
          }[rules.format].includes(field.fieldType)
        )
          fail(
            [...fp, "validationRules", "format"],
            "This format does not apply to the selected field type.",
          );
        if (
          rules.minLength !== undefined &&
          rules.maxLength !== undefined &&
          rules.minLength > rules.maxLength
        )
          fail(
            [...fp, "validationRules"],
            "Minimum length cannot exceed maximum length.",
          );
        if (
          rules.min !== undefined &&
          rules.max !== undefined &&
          rules.min > rules.max
        )
          fail(
            [...fp, "validationRules"],
            "Minimum number cannot exceed maximum number.",
          );
        if (
          [rules.min, rules.max].some(
            (value) => value !== undefined && !Number.isFinite(value),
          )
        )
          fail([...fp, "validationRules"], "Numeric limits must be finite.");
        if (
          (rules.min !== undefined || rules.max !== undefined) &&
          field.fieldType !== "NUMBER"
        )
          fail(
            [...fp, "validationRules"],
            "Numeric limits require a number field.",
          );
        if (
          rules.maxWords !== undefined &&
          (field.fieldType !== "LONG_TEXT" || rules.maxWords > 20000)
        )
          fail(
            [...fp, "validationRules", "maxWords"],
            "Use a word limit up to 20,000 on a long-text field.",
          );
        if ((rules.maxLength ?? 0) > 20000 || (rules.minLength ?? 0) > 20000)
          fail(
            [...fp, "validationRules"],
            "Text limits cannot exceed 20,000 characters.",
          );
        if (rules.pattern) {
          try {
            if (rules.pattern.length > 200) throw new Error();
            new RegExp(rules.pattern);
          } catch {
            fail(
              [...fp, "validationRules", "pattern"],
              "Enter a valid regular expression up to 200 characters.",
            );
          }
        }
        if (
          (rules.maxBytes !== undefined || rules.mimeTypes !== undefined) &&
          field.fieldType !== "IMAGE_UPLOAD"
        )
          fail(
            [...fp, "validationRules"],
            "Image limits require an image field.",
          );
        if (rules.maxBytes !== undefined && rules.maxBytes > 2097152)
          fail(
            [...fp, "validationRules", "maxBytes"],
            "Images are limited to 2 MB.",
          );
        if (
          rules.mimeTypes &&
          (!rules.mimeTypes.length ||
            rules.mimeTypes.some(
              (type) =>
                !["image/png", "image/jpeg", "image/webp"].includes(type),
            ))
        )
          fail(
            [...fp, "validationRules", "mimeTypes"],
            "Choose PNG, JPEG, or WEBP image types.",
          );
      }
    }
    if (fields > 200)
      fail(["sections"], "A survey can contain at most 200 questions.");
    if (images > 1)
      fail(["sections"], "Only one image upload field is supported.");
  });

export type SurveyDraft = z.infer<typeof draftDefinitionSchema>;
export type BuilderIssue = { path: string; message: string };
export function builderIssueLabel(draft: SurveySnapshot, path: string): string {
  if (path.startsWith("field:"))
    return (
      draft.sections
        .flatMap((section) => section.fields)
        .find((field) => field.fieldKey === path.slice(6))?.label ?? "Question"
    );
  const parts = path.split(".");
  if (parts[0] === "sections" && parts[1] !== undefined) {
    const section = draft.sections[Number(parts[1])];
    const field =
      parts[2] === "fields" ? section?.fields[Number(parts[3])] : null;
    return (
      [section?.title, field?.label].filter(Boolean).join(" — ") ||
      "Sections and questions"
    );
  }
  return (
    (
      {
        title: "Survey title",
        introText: "Introduction",
        closingMessage: "Thank-you message",
        termsText: "Terms and conditions",
        contactEmail: "Contact email",
        contactName: "Contact name",
        deadlineText: "Deadline text",
        sections: "Sections and questions",
        mappings: "Directory mappings",
      } as Record<string, string>
    )[path] ?? "Survey settings"
  );
}
export const revisionSchema = z.iso.datetime();
export const saveDraftSchema = z
  .object({ revision: revisionSchema, definition: draftDefinitionSchema })
  .strict();
export const actionSchema = z.object({ revision: revisionSchema }).strict();
export const createSurveySchema = z
  .object({ title: z.string().trim().min(1).max(200) })
  .strict();

const text = ["SHORT_TEXT", "LONG_TEXT"];
const choices = ["SINGLE_SELECT", "RADIO", "MULTI_SELECT"];
export const mappingTypes: Record<string, string[]> = {
  TITLE: text,
  PROVIDER_NAME: text,
  CATEGORY: choices,
  SPECIALTY: [...text, ...choices],
  DESCRIPTION: [...text, ...choices],
  STREET_ADDRESS: text,
  CITY: text,
  STATE: [...text, "SINGLE_SELECT", "RADIO"],
  ZIP_CODE: ["SHORT_TEXT"],
  PHONE: ["PHONE", "SHORT_TEXT"],
  WEBSITE: ["URL"],
  HOURS_START_DAY: ["DAY_OF_WEEK", "SINGLE_SELECT", "RADIO"],
  HOURS_END_DAY: ["DAY_OF_WEEK", "SINGLE_SELECT", "RADIO"],
  HOURS_START_TIME: ["TIME"],
  HOURS_END_TIME: ["TIME"],
  TIME_ZONE: ["SHORT_TEXT", "SINGLE_SELECT", "RADIO"],
  AGE_RANGE: [...text, ...choices],
  AVERAGE_WAIT: [...text, "SINGLE_SELECT", "RADIO"],
  IMAGE: ["IMAGE_UPLOAD"],
};
export const mappingLabels: Record<string, string> = {
  TITLE: "Resource title",
  PROVIDER_NAME: "Provider name",
  CATEGORY: "Category",
  SPECIALTY: "Specialty",
  DESCRIPTION: "Description",
  STREET_ADDRESS: "Street address",
  CITY: "City",
  STATE: "State",
  ZIP_CODE: "ZIP code",
  PHONE: "Phone",
  WEBSITE: "Website",
  HOURS_START_DAY: "Office start day",
  HOURS_END_DAY: "Office end day",
  HOURS_START_TIME: "Opening time",
  HOURS_END_TIME: "Closing time",
  TIME_ZONE: "Time zone",
  AGE_RANGE: "Ages served",
  AVERAGE_WAIT: "Average waiting time",
  IMAGE: "Provider image",
};
export const fieldTypeLabels: Record<
  SurveyFieldDefinition["fieldType"],
  string
> = {
  SHORT_TEXT: "Short text",
  LONG_TEXT: "Long text",
  NUMBER: "Number",
  EMAIL: "Email",
  PHONE: "Phone",
  URL: "Website URL",
  SINGLE_SELECT: "Dropdown",
  RADIO: "Radio selection",
  MULTI_SELECT: "Checkboxes",
  TIME: "Time",
  DAY_OF_WEEK: "Day of week",
  IMAGE_UPLOAD: "Image upload",
  SECTION_HEADING: "Section heading",
  DISPLAY_TEXT: "Display text",
  TERMS_ACKNOWLEDGEMENT: "Terms acknowledgement",
};
const requiredMappings = [
  "STREET_ADDRESS",
  "CITY",
  "STATE",
  "ZIP_CODE",
  "PHONE",
  "CATEGORY",
  "HOURS_START_DAY",
  "HOURS_END_DAY",
  "HOURS_START_TIME",
  "HOURS_END_TIME",
  "TIME_ZONE",
];
export function publicationIssues(draft: SurveySnapshot): BuilderIssue[] {
  const issues: BuilderIssue[] = [];
  const add = (path: string, message: string) => issues.push({ path, message });
  if (!draft.introText.trim())
    add("introText", "Add introductory text before publishing.");
  if (!draft.closingMessage.trim())
    add("closingMessage", "Add a thank-you message before publishing.");
  if (!draft.termsText.trim())
    add("termsText", "Add terms and conditions before publishing.");
  const fields = draft.sections.flatMap((section) => section.fields);
  if (!draft.sections.length || !fields.length)
    add("sections", "Add at least one section and question.");
  const primary =
    fields.find((field) => field.displayMapping === "TITLE") ??
    fields.find((field) => field.displayMapping === "PROVIDER_NAME");
  if (!primary) add("mappings", "Map a resource title or provider name.");
  for (const mapping of requiredMappings)
    if (!fields.some((field) => field.displayMapping === mapping))
      add("mappings", `Map ${mappingLabels[mapping]} before publishing.`);
  for (const field of fields) {
    const path = `field:${field.fieldKey}`,
      mapping = field.displayMapping;
    if (
      (field === primary || (mapping && requiredMappings.includes(mapping))) &&
      (!field.required || field.allowsNA)
    )
      add(
        path,
        `${field.label}: this directory field must be required and cannot allow N/A.`,
      );
    if (
      choiceFieldTypes.has(field.fieldType) &&
      !field.options.some((option) => option.kind === "STANDARD")
    )
      add(path, `${field.label}: add at least one normal option.`);
    if (mapping === "CATEGORY" && (field.allowsOther || field.allowsNA))
      add(
        path,
        `${field.label}: use existing directory categories without Other or N/A.`,
      );
    if (mapping === "TIME_ZONE") {
      if (field.validationRules.format !== "iana-time-zone")
        add(path, `${field.label}: enable IANA time-zone validation.`);
      for (const option of field.options) {
        try {
          new Intl.DateTimeFormat("en", { timeZone: option.value });
        } catch {
          add(
            path,
            `${field.label}: ${option.value} is not a valid time zone.`,
          );
        }
      }
    }
    if (mapping === "ZIP_CODE" && field.validationRules.format !== "zip")
      add(path, `${field.label}: enable ZIP-code validation.`);
    if (
      mapping === "PHONE" &&
      field.fieldType !== "PHONE" &&
      field.validationRules.format !== "phone"
    )
      add(path, `${field.label}: enable phone validation.`);
    if (mapping === "HOURS_START_DAY" || mapping === "HOURS_END_DAY") {
      if (
        field.options.some(
          (option) =>
            option.kind !== "STANDARD" ||
            ![
              "monday",
              "tuesday",
              "wednesday",
              "thursday",
              "friday",
              "saturday",
              "sunday",
            ].includes(option.label.trim().toLowerCase()),
        )
      )
        add(
          path,
          `${field.label}: use full weekday labels without Other or N/A.`,
        );
    }
  }
  if (
    !fields.some(
      (field) => field.fieldType === "TERMS_ACKNOWLEDGEMENT" && field.required,
    )
  )
    add("termsText", "Add a required terms acknowledgement question.");
  return issues;
}

export class SurveyBuilderError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly issues: BuilderIssue[] = [],
  ) {
    super(message);
    this.name = "SurveyBuilderError";
  }
}
