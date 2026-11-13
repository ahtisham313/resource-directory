"use client";

import type { SurveyAnswers, SurveySnapshot } from "../survey-snapshot";
import { SurveyField } from "./survey-field";

export function SurveyRenderer({
  snapshot,
  answers,
  errors,
  disabled = false,
  uploadsAvailable = true,
  onChange,
  onFileChange,
}: {
  snapshot: SurveySnapshot;
  answers: SurveyAnswers;
  errors: Record<string, string>;
  disabled?: boolean;
  uploadsAvailable?: boolean;
  onChange: (key: string, answer: SurveyAnswers[string]) => void;
  onFileChange: (file: File | undefined, error?: string) => void;
}) {
  const termsDisplayed = snapshot.sections.some((section) =>
    section.fields.some(
      (field) =>
        field.fieldType === "DISPLAY_TEXT" &&
        field.content === snapshot.termsText,
    ),
  );
  return (
    <div className="space-y-6">
      {snapshot.sections.map((section, index) => (
        <section
          key={section.id}
          aria-labelledby={`section-${section.id}`}
          className="min-w-0 rounded-2xl border bg-background p-4 shadow-sm sm:p-7"
        >
          <div className="mb-7 border-b pb-4">
            <p className="mb-1 text-xs font-medium tracking-wide text-muted-foreground">
              SECTION {index + 1} OF {snapshot.sections.length}
            </p>
            <h2
              id={`section-${section.id}`}
              className="text-xl leading-7 font-semibold tracking-tight"
            >
              {section.title}
            </h2>
          </div>
          <div className="space-y-7">
            {section.fields.map((field) => (
              <SurveyField
                key={field.id}
                field={field}
                answer={answers[field.fieldKey]}
                error={errors[field.fieldKey]}
                disabled={disabled}
                uploadsAvailable={uploadsAvailable}
                termsText={
                  field.fieldType === "TERMS_ACKNOWLEDGEMENT" && !termsDisplayed
                    ? snapshot.termsText
                    : undefined
                }
                onChange={(answer) => onChange(field.fieldKey, answer)}
                onFileChange={onFileChange}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
