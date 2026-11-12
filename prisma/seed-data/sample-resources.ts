import type { SurveyAnswers } from "../../src/modules/surveys/survey-snapshot";
import { defaultCategories } from "./default-survey";

const names = [
  "Demo Alder Primary Care",
  "Demo Birch Urgent Care",
  "Demo Cedar Specialists",
  "Demo Elm Behavioral Health",
  "Demo Fir Senior Services",
  "Demo Grove Family Care",
  "Demo Hazel Walk-in Care",
  "Demo Iris Specialty Clinic",
  "Demo Juniper Counseling",
  "Demo Laurel Senior Care",
];

export const sampleResources = names.map((name, index) => {
  const category = defaultCategories[[1, 0, 2, 3, 4][index % 5]];
  const categoryValue = category.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const answers: SurveyAnswers = {
    "practice-name": { value: name },
    "provider-name": { value: `Provider Example ${index + 1}` },
    "provider-gender": { value: "prefer-not-to-say" },
    category: { value: [categoryValue] },
    specialty: { value: ["sports-medicine"] },
    "street-address": { value: `${100 + index} Example Lane` },
    city: { value: "Arlington" },
    state: { value: "VA" },
    "zip-code": { value: "22201" },
    phone: { value: `+1-202-555-01${String(index).padStart(2, "0")}` },
    website: { value: `https://example.com/directory/demo-${index + 1}` },
    "hours-start-day": { value: "monday" },
    "hours-end-day": { value: "friday" },
    "hours-start-time": { value: "09:00" },
    "hours-end-time": { value: "17:00" },
    "time-zone": { value: "America/New_York" },
    "age-range": { value: ["all-ages"] },
    "accepting-patients": { value: "yes" },
    "new-patient-availability": { value: "1-to-2-weeks" },
    "same-day": { value: "sometimes" },
    "online-scheduling": { value: "yes" },
    "average-wait": { value: "15-to-30-minutes" },
    insurance: { value: ["medicare", "medicaid"] },
    languages: { value: ["english", "spanish"] },
    services: { value: ["telehealth", "care-coordination"] },
    "additional-information": {
      value:
        "Fictional demonstration listing for directory development. This is not a real healthcare provider.",
    },
    "terms-agreement": { value: true },
  };
  return {
    id: `seed-resource-${index + 1}`,
    responseId: `seed-response-${index + 1}`,
    latitude: 38.88 + index * 0.002,
    longitude: -77.1 - index * 0.002,
    active: index !== 9,
    answers,
  };
});
