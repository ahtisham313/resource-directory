import { describe, expect, it } from "vitest";
import { defaultSurvey } from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import {
  parseSurveyDefinition,
  countWords,
} from "../src/modules/surveys/survey-definition";
import {
  SurveyAnswerError,
  validateSurveyAnswers,
} from "../src/modules/surveys/answer-validation";
import { displaySurveyAnswer } from "../src/modules/surveys/answer-display";
import type {
  SurveyFieldDefinition,
  SurveyAnswers,
} from "../src/modules/surveys/survey-snapshot";

function invalid(
  answers: unknown,
  snapshot = defaultSurvey,
): Record<string, string> {
  try {
    validateSurveyAnswers(snapshot, answers);
    throw new Error("Expected rejection");
  } catch (error) {
    if (!(error instanceof SurveyAnswerError)) throw error;
    return error.fieldErrors;
  }
}
const base = sampleResources[0].answers;

describe("published survey definition", () => {
  it("reads all seven sections and 29 items in stored order without mutating the snapshot", () => {
    const input = structuredClone(defaultSurvey);
    input.sections.reverse();
    input.sections[0].fields.reverse();
    const parsed = parseSurveyDefinition(input, defaultSurvey.surveyId);
    expect(parsed.sections).toHaveLength(7);
    expect(
      parsed.sections
        .flatMap((section) => section.fields)
        .map((field) => field.order),
    ).toEqual(Array.from({ length: 29 }, (_, index) => index + 1));
    expect(input.sections[0].order).toBe(7);
  });
  it("rejects unknown field types, foreign survey identities, and multiple image fields", () => {
    const unknown: unknown = {
      ...defaultSurvey,
      sections: [
        {
          ...defaultSurvey.sections[0],
          fields: [
            {
              ...defaultSurvey.sections[0].fields[0],
              fieldType: "UNSUPPORTED",
            },
          ],
        },
      ],
    };
    expect(() => parseSurveyDefinition(unknown)).toThrow();
    expect(() =>
      parseSurveyDefinition(defaultSurvey, "another-survey"),
    ).toThrow();
    const duplicate = structuredClone(defaultSurvey);
    const image = duplicate.sections[0].fields.find(
      (field) => field.fieldType === "IMAGE_UPLOAD",
    )!;
    duplicate.sections[0].fields.push({
      ...image,
      id: "second-image",
      fieldKey: "second-image",
      order: 30,
      displayMapping: null,
    });
    expect(() => parseSurveyDefinition(duplicate)).toThrow("one image");
    const noConsent = structuredClone(defaultSurvey);
    noConsent.sections[6].fields = noConsent.sections[6].fields.filter(
      (field) => field.fieldType !== "TERMS_ACKNOWLEDGEMENT",
    );
    expect(() => parseSurveyDefinition(noConsent)).toThrow("acknowledgement");
  });
});

describe("definition-driven answers", () => {
  it("accepts valid default answers and omitted optional questions", () => {
    const answers = structuredClone(base);
    delete answers.specialty;
    delete answers["average-wait"];
    expect(validateSurveyAnswers(defaultSurvey, answers)).toEqual(answers);
  });
  it("rejects whitespace required values, false consent, unknown keys and answers to display items", () => {
    expect(
      invalid({ ...base, "practice-name": { value: "  " } })["practice-name"],
    ).toContain("required");
    expect(
      invalid({ ...base, "terms-agreement": { value: false } })[
        "terms-agreement"
      ],
    ).toContain("agree");
    expect(
      invalid({ ...base, unexpected: { value: "text" } }).unexpected,
    ).toBeTruthy();
    expect(
      invalid({ ...base, "terms-text": { value: "forged terms" } })[
        "terms-text"
      ],
    ).toBeTruthy();
  });
  it.each([
    "javascript:alert(1)",
    "file:///private",
    "https://user:password@example.com",
    "invalid",
  ])("rejects invalid website %s", (value) => {
    expect(invalid({ ...base, website: { value } }).website).toContain("URL");
  });
  it("validates multi-select types, options, duplicates, Other text and unrelated explanations", () => {
    for (const value of [
      "primary-care",
      ["invented"],
      ["primary-care", "primary-care"],
    ])
      expect(invalid({ ...base, category: { value } }).category).toBeTruthy();
    expect(
      invalid({ ...base, specialty: { value: ["other-please-specify"] } })
        .specialty,
    ).toContain("Other");
    expect(() =>
      validateSurveyAnswers(defaultSurvey, {
        ...base,
        specialty: {
          value: ["other-please-specify"],
          otherText: "Custom specialty",
        },
      }),
    ).not.toThrow();
    expect(
      invalid({
        ...base,
        category: { value: ["primary-care"], otherText: "unexpected" },
      }).category,
    ).toBeTruthy();
  });
  it("accepts allowed N/A, requires exclusive N/A choices, and never permits N/A consent", () => {
    expect(() =>
      validateSurveyAnswers(defaultSurvey, {
        ...base,
        website: { value: null, notApplicable: true },
        insurance: { value: ["n-a"] },
      }),
    ).not.toThrow();
    expect(
      invalid({ ...base, insurance: { value: ["n-a", "medicare"] } }).insurance,
    ).toContain("N/A");
    expect(
      invalid({
        ...base,
        website: { value: "https://example.com", notApplicable: true },
      }).website,
    ).toBeTruthy();
    expect(
      invalid({
        ...base,
        "terms-agreement": { value: null, notApplicable: true },
      })["terms-agreement"],
    ).toBeTruthy();
  });
  it("counts words rather than characters and accepts exactly 250 words", () => {
    expect(countWords("  one\n two\tthree  ")).toBe(3);
    expect(() =>
      validateSurveyAnswers(defaultSurvey, {
        ...base,
        "additional-information": { value: "longword ".repeat(250) },
      }),
    ).not.toThrow();
    expect(
      invalid({
        ...base,
        "additional-information": { value: "a ".repeat(251) },
      })["additional-information"],
    ).toBe("Maximum 250 words allowed.");
  });
  it("enforces time, ZIP and international phone rules", () => {
    expect(
      invalid({ ...base, "hours-start-time": { value: "25:00" } })[
        "hours-start-time"
      ],
    ).toBeTruthy();
    expect(
      invalid({ ...base, "zip-code": { value: "abc" } })["zip-code"],
    ).toBeTruthy();
    expect(
      invalid({ ...base, phone: { value: "-------" } }).phone,
    ).toBeTruthy();
    expect(() =>
      validateSurveyAnswers(defaultSurvey, {
        ...base,
        phone: { value: "+44 (20) 7946 0958" },
      }),
    ).not.toThrow();
  });
  it("uses newly defined email, number and text constraints without seeded-key checks", () => {
    const snapshot = structuredClone(defaultSurvey);
    const template = snapshot.sections[0].fields[0];
    const extra: SurveyFieldDefinition[] = [
      {
        ...template,
        id: "custom-email",
        fieldKey: "contact-email",
        fieldType: "EMAIL",
        order: 30,
        displayMapping: null,
        validationRules: {},
      },
      {
        ...template,
        id: "custom-number",
        fieldKey: "room-count",
        fieldType: "NUMBER",
        order: 31,
        displayMapping: null,
        validationRules: { min: 1, max: 5 },
      },
      {
        ...template,
        id: "custom-text",
        fieldKey: "custom-text",
        fieldType: "SHORT_TEXT",
        order: 32,
        displayMapping: null,
        validationRules: { minLength: 2, maxLength: 5, pattern: "^[A-Z]+$" },
      },
    ];
    snapshot.sections[0].fields.push(...extra);
    const answers: SurveyAnswers = {
      ...base,
      "contact-email": { value: "bad" },
      "room-count": { value: 6 },
      "custom-text": { value: "lowercase" },
    };
    const errors = invalid(answers, snapshot);
    expect(Object.keys(errors)).toEqual(
      expect.arrayContaining(["contact-email", "room-count", "custom-text"]),
    );
    expect(() =>
      validateSurveyAnswers(snapshot, {
        ...answers,
        "contact-email": { value: "provider@example.com" },
        "room-count": { value: 2.5 },
        "custom-text": { value: "VALID" },
      }),
    ).not.toThrow();
  });
  it("does not accept a client-supplied image key", () => {
    expect(
      invalid({ ...base, image: { value: "someone-elses-image.png" } }).image,
    ).toBeTruthy();
  });
  it("prepares safe read-only values from option labels and explanations", () => {
    const specialty = defaultSurvey.sections[0].fields.find(
      (field) => field.fieldKey === "specialty",
    )!;
    expect(
      displaySurveyAnswer(specialty, {
        value: ["other-please-specify"],
        otherText: "Custom practice",
      }),
    ).toBe("Custom practice");
    expect(
      displaySurveyAnswer(specialty, { value: null, notApplicable: true }),
    ).toBe("N/A");
    expect(displaySurveyAnswer(specialty, undefined)).toBe("Not provided");
  });
});
