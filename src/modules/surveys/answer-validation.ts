import { z } from "zod";
import {
  surveyAnswersSchema,
  type SurveySnapshot,
  type SurveyAnswers,
} from "./survey-snapshot";
import {
  choiceFieldTypes,
  countWords,
  displayFieldTypes,
} from "./survey-definition";

export class SurveyAnswerError extends Error {
  constructor(
    public readonly fieldErrors: Record<string, string>,
    reasons: string[],
  ) {
    super(reasons.join(" "));
    this.name = "SurveyAnswerError";
  }
}

export function createSurveyAnswerSchema(
  snapshot: SurveySnapshot,
  imagePresent = false,
) {
  const fields = snapshot.sections.flatMap((section) => section.fields);
  const allowedKeys = new Set(
    fields
      .filter((field) => !displayFieldTypes.has(field.fieldType))
      .map((field) => field.fieldKey),
  );
  return surveyAnswersSchema.superRefine((answers, context) => {
    const fail = (key: string, message: string, reason = message) =>
      context.addIssue({
        code: "custom",
        path: [key],
        message,
        params: { reason },
      });
    for (const key of Object.keys(answers)) {
      if (!allowedKeys.has(key))
        fail(key, "This answer is not part of the survey.");
    }
    for (const field of fields) {
      if (displayFieldTypes.has(field.fieldType)) continue;
      const key = field.fieldKey;
      const answer = answers[key];
      const value = answer?.value;
      const empty =
        value === undefined ||
        value === null ||
        (typeof value === "string" && !value.trim()) ||
        (Array.isArray(value) && value.length === 0);
      if (field.fieldType === "IMAGE_UPLOAD") {
        if (!empty || answer?.otherText || answer?.notApplicable)
          fail(key, "Select an image using the upload control.");
        if (field.required && !imagePresent)
          fail(key, "This field is required.", "Required image.");
        continue;
      }
      if (answer?.notApplicable) {
        if (
          !field.allowsNA ||
          !empty ||
          answer.otherText?.trim() ||
          field.fieldType === "TERMS_ACKNOWLEDGEMENT"
        )
          fail(key, "N/A cannot be combined with another answer.");
        continue;
      }
      if (field.fieldType === "TERMS_ACKNOWLEDGEMENT") {
        if ((field.required || !empty) && value !== true)
          fail(
            key,
            "You must agree to the terms before submitting.",
            "Terms must be accepted.",
          );
        if (answer?.otherText) fail(key, "Enter only the acknowledgement.");
        continue;
      }
      if (empty) {
        if (field.required)
          fail(key, "This field is required.", "Required answer.");
        if (answer?.otherText?.trim())
          fail(key, "Choose Other before entering an explanation.");
        continue;
      }
      const rules = field.validationRules;
      if (choiceFieldTypes.has(field.fieldType)) {
        if (
          field.fieldType === "MULTI_SELECT"
            ? !Array.isArray(value)
            : typeof value !== "string"
        ) {
          fail(key, "Choose a valid option.");
          continue;
        }
        const values = Array.isArray(value) ? value : [value];
        const selected = values.map((item) =>
          field.options.find((option) => option.value === item),
        );
        if (
          new Set(values).size !== values.length ||
          selected.some((option) => !option)
        )
          fail(key, "Choose only the available options.");
        if (
          selected.some((option) => option?.kind === "NA") &&
          values.length > 1
        )
          fail(key, "N/A cannot be combined with another choice.");
        const otherSelected = selected.some(
          (option) => option?.kind === "OTHER",
        );
        if (otherSelected && (!field.allowsOther || !answer.otherText?.trim()))
          fail(key, "Please specify your Other answer.");
        if (!otherSelected && answer?.otherText?.trim())
          fail(key, "Choose Other before entering an explanation.");
        if (rules.format === "iana-time-zone" && typeof value === "string") {
          try {
            new Intl.DateTimeFormat("en", { timeZone: value });
          } catch {
            fail(key, "Invalid time zone.");
          }
        }
        continue;
      }
      if (answer?.otherText?.trim())
        fail(key, "This field does not accept an Other answer.");
      if (field.fieldType === "NUMBER") {
        if (typeof value !== "number" || !Number.isFinite(value))
          fail(key, "Enter a valid number.");
        else {
          if (rules.min !== undefined && value < rules.min)
            fail(key, `Enter ${rules.min} or more.`);
          if (rules.max !== undefined && value > rules.max)
            fail(key, `Enter ${rules.max} or less.`);
        }
        continue;
      }
      if (typeof value !== "string") {
        fail(key, "Enter a text answer.");
        continue;
      }
      if (
        rules.minLength !== undefined &&
        value.trim().length < rules.minLength
      )
        fail(key, `Enter at least ${rules.minLength} characters.`);
      if (value.length > (rules.maxLength ?? 20000))
        fail(key, `Maximum ${rules.maxLength ?? 20000} characters allowed.`);
      if (rules.maxWords !== undefined && countWords(value) > rules.maxWords)
        fail(
          key,
          `Maximum ${rules.maxWords} words allowed.`,
          "Word limit exceeded.",
        );
      if (rules.pattern && !new RegExp(rules.pattern).test(value))
        fail(key, "Enter an answer in the required format.");
      if (
        field.fieldType === "EMAIL" &&
        !z.email().safeParse(value.trim()).success
      )
        fail(key, "Please enter a valid email address.");
      if (field.fieldType === "URL") {
        try {
          const url = new URL(value.trim());
          if (
            !["http:", "https:"].includes(url.protocol) ||
            url.username ||
            url.password
          )
            throw new Error("Invalid URL");
        } catch {
          fail(key, "Please enter a valid HTTP or HTTPS website URL.");
        }
      }
      if (
        field.fieldType === "TIME" &&
        !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)
      )
        fail(key, "Enter a valid time.");
      if (rules.format === "zip" && !/^\d{5}(-\d{4})?$/.test(value.trim()))
        fail(key, "Enter a valid ZIP code.");
      if (field.fieldType === "PHONE" || rules.format === "phone") {
        const digits = value.replace(/\D/g, "");
        if (
          !/^\+?[\d\s().-]+$/.test(value.trim()) ||
          digits.length < 7 ||
          digits.length > 15
        )
          fail(key, "Please enter a valid phone number.");
      }
      if (rules.format === "iana-time-zone") {
        try {
          new Intl.DateTimeFormat("en", { timeZone: value });
        } catch {
          fail(key, "Invalid time zone.");
        }
      }
    }
  });
}

export function validateSurveyAnswers(
  snapshot: SurveySnapshot,
  input: unknown,
  imagePresent = false,
): SurveyAnswers {
  const parsed = createSurveyAnswerSchema(snapshot, imagePresent).safeParse(
    input,
  );
  if (parsed.success) return parsed.data;
  const fieldErrors: Record<string, string> = Object.create(null);
  const reasons: string[] = [];
  for (const issue of parsed.error.issues) {
    const key = String(issue.path[0] ?? "_form");
    const message =
      issue.code === "custom"
        ? issue.message
        : "Enter a valid answer for this field.";
    fieldErrors[key] ??= message;
    reasons.push(
      issue.code === "custom" && typeof issue.params?.reason === "string"
        ? issue.params.reason
        : message,
    );
  }
  throw new SurveyAnswerError(fieldErrors, reasons);
}
