import {
  surveySnapshotSchema,
  validateSurveyAnswers,
  type SurveySnapshot,
  type SurveyAnswers,
  type MappingKey,
} from "@/modules/surveys/survey-snapshot";

function mappedValues(
  snapshot: SurveySnapshot,
  answers: SurveyAnswers,
  mapping: MappingKey,
): string[] {
  return snapshot.sections
    .flatMap((section) => section.fields)
    .filter((field) => field.displayMapping === mapping)
    .flatMap((field) => {
      const answer = answers[field.fieldKey];
      if (!answer || answer.notApplicable || answer.value === null) return [];
      const values = Array.isArray(answer.value)
        ? answer.value
        : [answer.value];
      return values.flatMap((value) => {
        const option = field.options.find((item) => item.value === value);
        if (option?.kind === "NA") return [];
        if (option?.kind === "OTHER")
          return answer.otherText?.trim() ? [answer.otherText.trim()] : [];
        if (mapping === "TIME_ZONE") return [String(value)];
        return [option?.label ?? String(value)];
      });
    });
}

export function projectResource(snapshotInput: unknown, answersInput: unknown) {
  const snapshot = surveySnapshotSchema.parse(snapshotInput);
  const answers = validateSurveyAnswers(snapshot, answersInput);
  const first = (mapping: MappingKey) =>
    mappedValues(snapshot, answers, mapping)[0] ?? null;
  const required = (mapping: MappingKey) => {
    const value = first(mapping);
    if (!value?.trim()) throw new Error(`Missing resource mapping: ${mapping}`);
    return value.trim();
  };
  const providerName = first("PROVIDER_NAME");
  const name = first("TITLE") ?? providerName;
  if (!name?.trim())
    throw new Error("A resource needs a mapped title or provider name.");
  const streetAddress = required("STREET_ADDRESS");
  const city = required("CITY");
  const state = required("STATE");
  const zipCode = required("ZIP_CODE");
  const categoryNames = [
    ...new Set(mappedValues(snapshot, answers, "CATEGORY")),
  ];
  if (!categoryNames.length)
    throw new Error("A resource needs at least one category.");
  const specialties = mappedValues(snapshot, answers, "SPECIALTY");

  // Apply this projection and currentAnswers in the same write when resources are edited.
  return {
    categoryNames,
    data: {
      name: name.trim(),
      providerName,
      description: [
        ...specialties,
        ...mappedValues(snapshot, answers, "DESCRIPTION"),
      ].join(". "),
      streetAddress,
      city,
      state,
      zipCode,
      address: `${streetAddress}, ${city}, ${state} ${zipCode}`,
      phone: required("PHONE"),
      website: first("WEBSITE"),
      officeHours: {
        startDay: required("HOURS_START_DAY"),
        endDay: required("HOURS_END_DAY"),
        startTime: required("HOURS_START_TIME"),
        endTime: required("HOURS_END_TIME"),
      },
      timeZone: required("TIME_ZONE"),
      ageRange: mappedValues(snapshot, answers, "AGE_RANGE"),
      averageWait: first("AVERAGE_WAIT"),
      imageKey: first("IMAGE"),
      currentAnswers: answers,
    },
  };
}
