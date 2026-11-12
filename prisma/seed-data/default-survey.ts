import {
  surveySnapshotSchema,
  type SurveyFieldDefinition,
} from "../../src/modules/surveys/survey-snapshot";

export const defaultSurveyId = "seed-practice-provider-survey";
export const defaultVersionId = "seed-practice-provider-version-1";

export const defaultCategories = [
  { slug: "urgent-care", name: "Urgent Care" },
  { slug: "primary-care", name: "Primary Care" },
  { slug: "specialists", name: "Specialists" },
  {
    slug: "behavioral-health-substance-use",
    name: "Behavioral Health & Substance Use",
  },
  { slug: "aging-senior-services", name: "Aging & Senior Services" },
];

const termsText =
  "I am authorised to provide this information and confirm that it is accurate to the best of my knowledge. The directory owner may review, verify, edit or exclude this information. Submission does not guarantee publication.";

type FieldInput = Pick<
  SurveyFieldDefinition,
  "fieldKey" | "label" | "fieldType" | "order"
> &
  Partial<SurveyFieldDefinition>;

function field(input: FieldInput): SurveyFieldDefinition {
  return {
    id: `${defaultSurveyId}-${input.fieldKey}`,
    helperText: null,
    placeholder: null,
    content: null,
    required: true,
    validationRules: {},
    displayMapping: null,
    allowsOther: false,
    allowsNA: false,
    options: [],
    ...input,
  };
}

function options(key: string, labels: readonly string[]) {
  return labels.map((label, order) => ({
    id: `${defaultSurveyId}-${key}-option-${order}`,
    value: label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, ""),
    label,
    order,
    kind: label.startsWith("Other")
      ? ("OTHER" as const)
      : label.startsWith("N/A")
        ? ("NA" as const)
        : ("STANDARD" as const),
  }));
}

const states = [
  ["AL", "Alabama"],
  ["AK", "Alaska"],
  ["AZ", "Arizona"],
  ["AR", "Arkansas"],
  ["CA", "California"],
  ["CO", "Colorado"],
  ["CT", "Connecticut"],
  ["DE", "Delaware"],
  ["DC", "District of Columbia"],
  ["FL", "Florida"],
  ["GA", "Georgia"],
  ["HI", "Hawaii"],
  ["ID", "Idaho"],
  ["IL", "Illinois"],
  ["IN", "Indiana"],
  ["IA", "Iowa"],
  ["KS", "Kansas"],
  ["KY", "Kentucky"],
  ["LA", "Louisiana"],
  ["ME", "Maine"],
  ["MD", "Maryland"],
  ["MA", "Massachusetts"],
  ["MI", "Michigan"],
  ["MN", "Minnesota"],
  ["MS", "Mississippi"],
  ["MO", "Missouri"],
  ["MT", "Montana"],
  ["NE", "Nebraska"],
  ["NV", "Nevada"],
  ["NH", "New Hampshire"],
  ["NJ", "New Jersey"],
  ["NM", "New Mexico"],
  ["NY", "New York"],
  ["NC", "North Carolina"],
  ["ND", "North Dakota"],
  ["OH", "Ohio"],
  ["OK", "Oklahoma"],
  ["OR", "Oregon"],
  ["PA", "Pennsylvania"],
  ["RI", "Rhode Island"],
  ["SC", "South Carolina"],
  ["SD", "South Dakota"],
  ["TN", "Tennessee"],
  ["TX", "Texas"],
  ["UT", "Utah"],
  ["VT", "Vermont"],
  ["VA", "Virginia"],
  ["WA", "Washington"],
  ["WV", "West Virginia"],
  ["WI", "Wisconsin"],
  ["WY", "Wyoming"],
] as const;

const days = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
const specialties = [
  "Allergy and Immunology",
  "Cardiology (Heart)",
  "Dermatology (Skin)",
  "Endocrinology (Diabetes and Hormones)",
  "Gastroenterology (Digestive Health)",
  "General Surgery",
  "Hematology (Blood Disorders)",
  "Infectious Disease",
  "Nephrology (Kidneys)",
  "Neurology",
  "OB/GYN (Obstetrics and Gynecology)",
  "Oncology (Cancer)",
  "Ophthalmology (Eye Care)",
  "Orthopedics (Bones and Joints)",
  "Otolaryngology / ENT (Ear, Nose and Throat)",
  "Pain Management",
  "Physical Medicine and Rehabilitation",
  "Pulmonology (Lungs)",
  "Rheumatology",
  "Sleep Medicine",
  "Sports Medicine",
  "Urology",
  "Other (please specify)",
];

export const defaultSurvey = surveySnapshotSchema.parse({
  schemaVersion: 1,
  surveyId: defaultSurveyId,
  title: "Practice and Provider Information",
  introText:
    "This directory collects current information about healthcare practices and services. Each provider at a location should complete their own survey.",
  closingMessage:
    "Thank you for submitting your information. It will be reviewed before publication.",
  deadlineText: "Submission deadline: to be confirmed.",
  contactName: "Directory Team",
  contactEmail: "directory@example.com",
  termsText,
  sections: [
    {
      id: `${defaultSurveyId}-section-1`,
      title: "Practice and Provider Information",
      order: 1,
      fields: [
        field({
          fieldKey: "practice-name",
          label: "Practice Name",
          fieldType: "SHORT_TEXT",
          order: 1,
          displayMapping: "TITLE",
          validationRules: { minLength: 1, maxLength: 200 },
        }),
        field({
          fieldKey: "provider-name",
          label: "Provider Name",
          fieldType: "SHORT_TEXT",
          order: 2,
          displayMapping: "PROVIDER_NAME",
          validationRules: { minLength: 1, maxLength: 200 },
        }),
        field({
          fieldKey: "provider-gender",
          label: "Provider Gender, for individual providers only",
          fieldType: "RADIO",
          order: 3,
          allowsOther: true,
          allowsNA: true,
          options: options("gender", [
            "Female",
            "Male",
            "Other (please specify)",
            "Prefer not to say",
            "N/A, Facility or organization (not an individual provider)",
          ]),
        }),
        field({
          fieldKey: "category",
          label: "Practice/Provider Category, select all that apply",
          fieldType: "MULTI_SELECT",
          order: 4,
          displayMapping: "CATEGORY",
          options: options(
            "category",
            defaultCategories.map((category) => category.name),
          ),
        }),
        field({
          fieldKey: "specialty",
          label: "Specialty, select all that apply",
          fieldType: "MULTI_SELECT",
          order: 5,
          required: false,
          displayMapping: "SPECIALTY",
          allowsOther: true,
          options: options("specialty", specialties),
        }),
        field({
          fieldKey: "street-address",
          label: "Street Address",
          fieldType: "SHORT_TEXT",
          order: 6,
          displayMapping: "STREET_ADDRESS",
          validationRules: { minLength: 1, maxLength: 300 },
        }),
        field({
          fieldKey: "city",
          label: "City",
          fieldType: "SHORT_TEXT",
          order: 7,
          displayMapping: "CITY",
          validationRules: { minLength: 1, maxLength: 120 },
        }),
        field({
          fieldKey: "state",
          label: "State",
          fieldType: "SINGLE_SELECT",
          order: 8,
          displayMapping: "STATE",
          options: states.map(([value, label], order) => ({
            id: `${defaultSurveyId}-state-${value}`,
            value,
            label,
            order,
            kind: "STANDARD",
          })),
        }),
        field({
          fieldKey: "zip-code",
          label: "ZIP Code",
          fieldType: "SHORT_TEXT",
          order: 9,
          displayMapping: "ZIP_CODE",
          validationRules: { format: "zip" },
        }),
        field({
          fieldKey: "phone",
          label: "Main Phone Number",
          fieldType: "PHONE",
          order: 10,
          displayMapping: "PHONE",
          validationRules: { format: "phone" },
        }),
        field({
          fieldKey: "website",
          label: "Website",
          fieldType: "URL",
          order: 11,
          displayMapping: "WEBSITE",
          allowsNA: true,
        }),
        field({
          fieldKey: "hours-start-day",
          label: "Office Hours Start Day",
          fieldType: "DAY_OF_WEEK",
          order: 12,
          displayMapping: "HOURS_START_DAY",
          options: options("start-day", days),
        }),
        field({
          fieldKey: "hours-end-day",
          label: "Office Hours End Day",
          fieldType: "DAY_OF_WEEK",
          order: 13,
          displayMapping: "HOURS_END_DAY",
          options: options("end-day", days),
        }),
        field({
          fieldKey: "hours-start-time",
          label: "Office Hours Start Time",
          fieldType: "TIME",
          order: 14,
          displayMapping: "HOURS_START_TIME",
          helperText:
            "Select a time with AM/PM; stored in 24-hour HH:mm format.",
        }),
        field({
          fieldKey: "hours-end-time",
          label: "Office Hours End Time",
          fieldType: "TIME",
          order: 15,
          displayMapping: "HOURS_END_TIME",
          helperText:
            "Select a time with AM/PM; stored in 24-hour HH:mm format.",
        }),
        field({
          fieldKey: "time-zone",
          label: "Time Zone",
          fieldType: "SINGLE_SELECT",
          order: 16,
          displayMapping: "TIME_ZONE",
          validationRules: { format: "iana-time-zone" },
          options: [
            "America/New_York",
            "America/Chicago",
            "America/Denver",
            "America/Phoenix",
            "America/Los_Angeles",
            "America/Anchorage",
            "Pacific/Honolulu",
            "America/Puerto_Rico",
            "Pacific/Guam",
          ].map((value, order) => ({
            id: `${defaultSurveyId}-time-zone-${order}`,
            value,
            label: value,
            order,
            kind: "STANDARD",
          })),
        }),
        field({
          fieldKey: "age-range",
          label: "Age/Age Range of Patients Served",
          fieldType: "MULTI_SELECT",
          order: 17,
          displayMapping: "AGE_RANGE",
          allowsOther: true,
          allowsNA: true,
          options: options("age", [
            "Children Under 5",
            "Children 5+",
            "Adolescents",
            "Adults",
            "Older Adults",
            "All Ages",
            "Other",
            "N/A",
          ]),
        }),
        field({
          fieldKey: "image",
          label: "Image",
          fieldType: "IMAGE_UPLOAD",
          order: 18,
          required: false,
          displayMapping: "IMAGE",
          validationRules: {
            maxBytes: 2097152,
            mimeTypes: ["image/png", "image/jpeg", "image/webp"],
          },
          helperText:
            "One image, up to 2 MB. A default image is used when none is supplied.",
        }),
      ],
    },
    {
      id: `${defaultSurveyId}-section-2`,
      title: "New Patients and Appointments",
      order: 2,
      fields: [
        field({
          fieldKey: "accepting-patients",
          label: "Are you currently accepting new patients?",
          fieldType: "SINGLE_SELECT",
          order: 19,
          allowsOther: true,
          options: options("accepting", ["Yes", "No", "Unsure", "Other"]),
        }),
        field({
          fieldKey: "new-patient-availability",
          label:
            "What is your typical availability for a new-patient appointment?",
          fieldType: "SINGLE_SELECT",
          order: 20,
          allowsNA: true,
          options: options("availability", [
            "Same week",
            "1 to 2 weeks",
            "2 to 4 weeks",
            "More than 1 month",
            "N/A",
          ]),
        }),
        field({
          fieldKey: "same-day",
          label: "Do you offer same-day appointments for established patients?",
          fieldType: "SINGLE_SELECT",
          order: 21,
          options: options("same-day", ["Yes", "No", "Sometimes"]),
        }),
        field({
          fieldKey: "online-scheduling",
          label: "Do you offer online appointment scheduling?",
          fieldType: "SINGLE_SELECT",
          order: 22,
          options: options("online", ["Yes", "No"]),
        }),
        field({
          fieldKey: "average-wait",
          label: "Average Waiting Time",
          fieldType: "SINGLE_SELECT",
          order: 23,
          required: false,
          displayMapping: "AVERAGE_WAIT",
          options: options("wait", [
            "Under 15 minutes",
            "15 to 30 minutes",
            "30 to 60 minutes",
            "Over 60 minutes",
          ]),
        }),
      ],
    },
    {
      id: `${defaultSurveyId}-section-3`,
      title: "Insurance",
      order: 3,
      fields: [
        field({
          fieldKey: "insurance",
          label: "Which insurance plans do you accept? Select all that apply.",
          fieldType: "MULTI_SELECT",
          order: 24,
          allowsOther: true,
          allowsNA: true,
          options: options("insurance", [
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
          ]),
        }),
      ],
    },
    {
      id: `${defaultSurveyId}-section-4`,
      title: "Languages",
      order: 4,
      fields: [
        field({
          fieldKey: "languages",
          label:
            "Which languages are available to patients at your practice? Select all that apply.",
          fieldType: "MULTI_SELECT",
          order: 25,
          allowsOther: true,
          allowsNA: true,
          options: options("languages", [
            "English",
            "Spanish",
            "Korean",
            "Chinese",
            "French",
            "Other",
            "N/A",
          ]),
        }),
      ],
    },
    {
      id: `${defaultSurveyId}-section-5`,
      title: "Services and Capabilities",
      order: 5,
      fields: [
        field({
          fieldKey: "services",
          label:
            "Which services or capabilities are available through your practice? Select all that apply.",
          fieldType: "MULTI_SELECT",
          order: 26,
          allowsOther: true,
          allowsNA: true,
          options: options("services", [
            "Women's Health",
            "Men's Health",
            "Chronic Disease Management",
            "X-ray on site",
            "Laboratory on site",
            "Geriatrics",
            "Pediatrics",
            "Adolescents",
            "Medicare Annual Wellness Visits",
            "Preventive Screenings",
            "Telehealth",
            "Care Coordination",
            "Other",
            "N/A",
          ]),
        }),
      ],
    },
    {
      id: `${defaultSurveyId}-section-6`,
      title: "Additional Information",
      order: 6,
      fields: [
        field({
          fieldKey: "additional-information",
          label:
            "Is there anything else about your practice, providers, or services that you would like us to know?",
          fieldType: "LONG_TEXT",
          order: 27,
          displayMapping: "DESCRIPTION",
          allowsNA: true,
          validationRules: { maxWords: 250 },
          helperText: "Maximum 250 words, or select N/A.",
        }),
      ],
    },
    {
      id: `${defaultSurveyId}-section-7`,
      title: "Terms and Conditions",
      order: 7,
      fields: [
        field({
          fieldKey: "terms-text",
          label: "Terms and conditions text",
          fieldType: "DISPLAY_TEXT",
          order: 28,
          required: false,
          content: termsText,
        }),
        field({
          fieldKey: "terms-agreement",
          label: "I acknowledge and agree to the terms and conditions above.",
          fieldType: "TERMS_ACKNOWLEDGEMENT",
          order: 29,
          helperText: "I Agree",
        }),
      ],
    },
  ],
});
