import { describe, expect, it } from "vitest";
import { defaultSurvey } from "../prisma/seed-data/default-survey";
import { sampleResources } from "../prisma/seed-data/sample-resources";
import {
  fieldTypes,
  displayMappings,
  surveySnapshotSchema,
  validateSurveyAnswers,
} from "../src/modules/surveys/survey-snapshot";
import { FieldType, DisplayMapping } from "../src/generated/prisma/enums";
import { projectResource } from "../src/modules/resources/project-resource";

describe("Appendix A survey", () => {
  const fields = defaultSurvey.sections.flatMap((section) => section.fields);
  it("preserves all sections, fields, required flags and option lists", () => {
    expect(defaultSurvey.sections.map((section) => section.title)).toEqual([
      "Practice and Provider Information",
      "New Patients and Appointments",
      "Insurance",
      "Languages",
      "Services and Capabilities",
      "Additional Information",
      "Terms and Conditions",
    ]);
    expect(fields).toHaveLength(29);
    expect(
      fields.filter((field) => !field.required).map((field) => field.fieldKey),
    ).toEqual(["specialty", "image", "average-wait", "terms-text"]);
    expect(fields.map((field) => field.order)).toEqual(
      Array.from({ length: 29 }, (_, index) => index + 1),
    );
    expect(
      fields.find((field) => field.fieldKey === "specialty")?.options,
    ).toHaveLength(23);
    expect(
      fields
        .find((field) => field.fieldKey === "insurance")
        ?.options.map((option) => option.label),
    ).toEqual([
      "Aetna",
      "Blue Cross Blue Shield",
      "CareFirst BlueCross BlueShield",
      "Cigna",
      "Humana",
      "Kaiser Permanente",
      "Medicare",
      "Medicaid",
      "UnitedHealthcare",
      "TRICARE",
      "Other",
      "N/A",
    ]);
    expect(
      fields
        .find((field) => field.fieldKey === "languages")
        ?.options.map((option) => option.label),
    ).toEqual([
      "English",
      "Spanish",
      "Korean",
      "Chinese",
      "French",
      "Other",
      "N/A",
    ]);
    expect(
      fields.find((field) => field.fieldKey === "services")?.options,
    ).toHaveLength(14);
    expect(
      fields.find((field) => field.fieldKey === "state")?.options,
    ).toHaveLength(51);
    expect(
      fields.find((field) => field.fieldKey === "image")?.validationRules,
    ).toEqual({
      maxBytes: 2097152,
      mimeTypes: ["image/png", "image/jpeg", "image/webp"],
    });
  });

  it("keeps shared contracts aligned with the database enums", () => {
    expect([...fieldTypes].sort()).toEqual(Object.values(FieldType).sort());
    expect([...displayMappings].sort()).toEqual(
      Object.values(DisplayMapping).sort(),
    );
  });

  it("rejects duplicate stable keys, orders and scalar mappings", () => {
    const snapshot = structuredClone(defaultSurvey);
    snapshot.sections[0].fields[1].fieldKey =
      snapshot.sections[0].fields[0].fieldKey;
    expect(surveySnapshotSchema.safeParse(snapshot).success).toBe(false);
    const mapped = structuredClone(defaultSurvey);
    mapped.sections[0].fields[1].displayMapping = "TITLE";
    expect(surveySnapshotSchema.safeParse(mapped).success).toBe(false);
    const ordered = structuredClone(defaultSurvey);
    ordered.sections[0].fields[1].order = ordered.sections[0].fields[0].order;
    expect(surveySnapshotSchema.safeParse(ordered).success).toBe(false);
  });

  it("validates every fictional response", () => {
    for (const sample of sampleResources)
      expect(() =>
        validateSurveyAnswers(defaultSurvey, sample.answers),
      ).not.toThrow();
  });

  it("enforces consent, required values, Other, exclusive N/A and word limits", () => {
    const answers = structuredClone(sampleResources[0].answers);
    answers["terms-agreement"] = { value: false };
    expect(() => validateSurveyAnswers(defaultSurvey, answers)).toThrow(
      "Terms",
    );
    answers["terms-agreement"] = { value: true };
    answers["practice-name"] = { value: "" };
    expect(() => validateSurveyAnswers(defaultSurvey, answers)).toThrow(
      "Required",
    );
    answers["practice-name"] = { value: "Example" };
    answers.specialty = { value: ["other-please-specify"] };
    expect(() => validateSurveyAnswers(defaultSurvey, answers)).toThrow(
      "Other",
    );
    answers.specialty = {
      value: ["other-please-specify"],
      otherText: "Example specialty",
    };
    answers["age-range"] = { value: ["n-a", "adults"] };
    expect(() => validateSurveyAnswers(defaultSurvey, answers)).toThrow("N/A");
    answers["age-range"] = { value: ["adults"] };
    answers["additional-information"] = { value: "word ".repeat(251) };
    expect(() => validateSurveyAnswers(defaultSurvey, answers)).toThrow(
      "Word limit",
    );
  });
});

describe("resource projection", () => {
  it("keeps IANA time-zone values when option labels are edited", () => {
    const snapshot = structuredClone(defaultSurvey);
    const zone = snapshot.sections[0].fields.find(
      (field) => field.fieldKey === "time-zone",
    );
    if (!zone) throw new Error("Time-zone field missing.");
    const selected = zone.options.find(
      (option) => option.value === "America/New_York",
    );
    if (!selected) throw new Error("Time-zone option missing.");
    selected.label = "Eastern Time";
    expect(
      projectResource(snapshot, sampleResources[0].answers).data.timeZone,
    ).toBe("America/New_York");
    selected.value = "Invalid/TimeZone";
    const answers = structuredClone(sampleResources[0].answers);
    answers["time-zone"] = { value: selected.value };
    expect(() => projectResource(snapshot, answers)).toThrow(
      "Invalid time zone",
    );
  });
  it("projects searchable columns, multiple categories and descriptions", () => {
    const answers = structuredClone(sampleResources[0].answers);
    answers.category = { value: ["primary-care", "urgent-care"] };
    const projection = projectResource(defaultSurvey, answers);
    expect(projection.categoryNames).toEqual(["Primary Care", "Urgent Care"]);
    expect(projection.data.name).toBe("Demo Alder Primary Care");
    expect(projection.data.address).toBe(
      "100 Example Lane, Arlington, Virginia 22201",
    );
    expect(projection.data.timeZone).toBe("America/New_York");
    expect(projection.data.description).toContain("Sports Medicine");
    expect(projection.data.currentAnswers).toEqual(answers);
  });

  it("uses mappings rather than seeded keys or editable labels", () => {
    const snapshot = structuredClone(defaultSurvey);
    const answers = structuredClone(sampleResources[0].answers);
    snapshot.sections[0].fields[0].label = "Renamed title question";
    snapshot.sections[0].fields[0].fieldKey = "different-title-key";
    answers["different-title-key"] = answers["practice-name"];
    delete answers["practice-name"];
    expect(projectResource(snapshot, answers).data.name).toBe(
      "Demo Alder Primary Care",
    );
  });

  it("preserves new questions and resolves N/A without altering original inputs", () => {
    const snapshot = structuredClone(defaultSurvey);
    const answers = structuredClone(sampleResources[0].answers);
    const original = structuredClone(answers);
    snapshot.sections[5].fields.push({
      ...snapshot.sections[5].fields[0],
      id: "extra-question",
      fieldKey: "extra-question",
      label: "Extra detail",
      order: 30,
      displayMapping: null,
    });
    answers["extra-question"] = { value: "A later custom field" };
    answers.website = { value: null, notApplicable: true };
    const projected = projectResource(snapshot, answers);
    expect(projected.data.website).toBeNull();
    expect(projected.data.currentAnswers["extra-question"].value).toBe(
      "A later custom field",
    );
    expect(original.website.value).toBe("https://example.com/directory/demo-1");
  });

  it("fails rather than publishing an incomplete mapped address", () => {
    const snapshot = structuredClone(defaultSurvey);
    snapshot.sections[0].fields.find(
      (field) => field.fieldKey === "city",
    )!.displayMapping = null;
    expect(() => projectResource(snapshot, sampleResources[0].answers)).toThrow(
      "CITY",
    );
  });
});
