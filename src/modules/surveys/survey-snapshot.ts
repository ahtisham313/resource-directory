import { z } from "zod";

export const fieldTypes = [
  "SHORT_TEXT",
  "LONG_TEXT",
  "NUMBER",
  "EMAIL",
  "PHONE",
  "URL",
  "SINGLE_SELECT",
  "RADIO",
  "MULTI_SELECT",
  "TIME",
  "DAY_OF_WEEK",
  "IMAGE_UPLOAD",
  "SECTION_HEADING",
  "DISPLAY_TEXT",
  "TERMS_ACKNOWLEDGEMENT",
] as const;

export const displayMappings = [
  "TITLE",
  "PROVIDER_NAME",
  "CATEGORY",
  "SPECIALTY",
  "DESCRIPTION",
  "STREET_ADDRESS",
  "CITY",
  "STATE",
  "ZIP_CODE",
  "PHONE",
  "WEBSITE",
  "HOURS_START_DAY",
  "HOURS_END_DAY",
  "HOURS_START_TIME",
  "HOURS_END_TIME",
  "TIME_ZONE",
  "AGE_RANGE",
  "AVERAGE_WAIT",
  "IMAGE",
] as const;

export const fieldKeySchema = z
  .string()
  .regex(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/);
export const validationRulesSchema = z
  .object({
    minLength: z.number().int().nonnegative().optional(),
    maxLength: z.number().int().positive().optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    maxWords: z.number().int().positive().optional(),
    pattern: z.string().optional(),
    maxBytes: z.number().int().positive().optional(),
    mimeTypes: z.array(z.string()).optional(),
    format: z.enum(["zip", "phone", "iana-time-zone"]).optional(),
  })
  .strict();

export const surveyOptionSchema = z
  .object({
    id: z.string().min(1),
    value: z.string().min(1),
    label: z.string().min(1),
    order: z.number().int().nonnegative(),
    kind: z.enum(["STANDARD", "OTHER", "NA"]),
  })
  .strict();

export const surveyFieldSchema = z
  .object({
    id: z.string().min(1),
    fieldKey: fieldKeySchema,
    label: z.string().min(1),
    fieldType: z.enum(fieldTypes),
    helperText: z.string().nullable(),
    placeholder: z.string().nullable(),
    content: z.string().nullable(),
    required: z.boolean(),
    order: z.number().int().nonnegative(),
    validationRules: validationRulesSchema,
    displayMapping: z.enum(displayMappings).nullable(),
    allowsOther: z.boolean(),
    allowsNA: z.boolean(),
    options: z.array(surveyOptionSchema),
  })
  .strict();

const scalarMappings = new Set<string>(
  displayMappings.filter(
    (mapping) =>
      !["CATEGORY", "SPECIALTY", "DESCRIPTION", "AGE_RANGE"].includes(mapping),
  ),
);

export const surveySnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    surveyId: z.string().min(1),
    title: z.string().min(1),
    introText: z.string(),
    closingMessage: z.string(),
    termsText: z.string(),
    deadlineText: z.string().nullable(),
    contactName: z.string().nullable(),
    contactEmail: z.email().nullable(),
    sections: z
      .array(
        z
          .object({
            id: z.string().min(1),
            title: z.string().min(1),
            order: z.number().int().nonnegative(),
            fields: z.array(surveyFieldSchema),
          })
          .strict(),
      )
      .min(1),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const keys = new Set<string>();
    const ids = new Set<string>();
    const mappings = new Set<string>();
    const sectionOrders = new Set<number>();
    const problem = (message: string) =>
      context.addIssue({ code: "custom", message });
    for (const section of snapshot.sections) {
      if (ids.has(section.id) || sectionOrders.has(section.order))
        problem("Duplicate section ID or order.");
      ids.add(section.id);
      sectionOrders.add(section.order);
      const fieldOrders = new Set<number>();
      for (const field of section.fields) {
        if (
          ids.has(field.id) ||
          keys.has(field.fieldKey) ||
          fieldOrders.has(field.order)
        )
          problem("Duplicate field ID, key or order.");
        ids.add(field.id);
        keys.add(field.fieldKey);
        fieldOrders.add(field.order);
        const mapping = field.displayMapping;
        if (mapping && scalarMappings.has(mapping) && mappings.has(mapping))
          problem(`Mapping ${mapping} must be unique.`);
        if (mapping) mappings.add(mapping);
        if (
          mapping &&
          ["DISPLAY_TEXT", "SECTION_HEADING", "TERMS_ACKNOWLEDGEMENT"].includes(
            field.fieldType,
          )
        )
          problem("Display and terms fields cannot supply directory values.");
        if (
          mapping &&
          scalarMappings.has(mapping) &&
          ["MULTI_SELECT", "NUMBER"].includes(field.fieldType)
        )
          problem(`Mapping ${mapping} requires one text value.`);
        const optionValues = new Set<string>();
        const optionOrders = new Set<number>();
        for (const option of field.options) {
          if (
            ids.has(option.id) ||
            optionValues.has(option.value) ||
            optionOrders.has(option.order)
          )
            problem("Duplicate option ID, value or order.");
          ids.add(option.id);
          optionValues.add(option.value);
          optionOrders.add(option.order);
          if (option.kind === "OTHER" && !field.allowsOther)
            problem("Other option is not enabled.");
          if (option.kind === "NA" && !field.allowsNA)
            problem("N/A option is not enabled.");
        }
        if (
          ["SINGLE_SELECT", "RADIO", "MULTI_SELECT", "DAY_OF_WEEK"].includes(
            field.fieldType,
          ) &&
          !field.options.length
        )
          problem("Selection fields need options.");
        if (field.validationRules.pattern) {
          try {
            new RegExp(field.validationRules.pattern);
          } catch {
            problem("Invalid validation pattern.");
          }
        }
      }
    }
  });

export const surveyAnswerSchema = z
  .object({
    value: z.union([
      z.string(),
      z.number().finite(),
      z.boolean(),
      z.array(z.string()),
      z.null(),
    ]),
    otherText: z.string().max(2000).optional(),
    notApplicable: z.boolean().optional(),
  })
  .strict();
export const surveyAnswersSchema = z.record(fieldKeySchema, surveyAnswerSchema);

export type SurveySnapshot = z.infer<typeof surveySnapshotSchema>;
export type SurveyFieldDefinition = z.infer<typeof surveyFieldSchema>;
export type SurveyAnswers = z.infer<typeof surveyAnswersSchema>;
export type MappingKey = z.infer<typeof surveyFieldSchema>["displayMapping"];

// Preserve the Phase 2 entry point while sharing validation with the public form.
export { validateSurveyAnswers } from "./answer-validation";
