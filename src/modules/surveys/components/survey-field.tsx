"use client";

import type { ReactNode } from "react";
import { SurveyImageInput } from "./survey-image-input";
import { countWords, displayFieldTypes } from "../survey-definition";
import type { SurveyAnswers, SurveyFieldDefinition } from "../survey-snapshot";

type Answer = SurveyAnswers[string];
type Props = {
  field: SurveyFieldDefinition;
  answer?: Answer;
  error?: string;
  disabled: boolean;
  uploadsAvailable: boolean;
  termsText?: string;
  onChange: (answer: Answer) => void;
  onFileChange: (file: File | undefined, error?: string) => void;
};
const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-base outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-60 aria-invalid:border-destructive";

export function SurveyField({
  field,
  answer,
  error,
  disabled,
  uploadsAvailable,
  termsText,
  onChange,
  onFileChange,
}: Props) {
  const key = field.fieldKey;
  const inputId = `input-${key}`;
  const helperId = `helper-${key}`;
  const errorId = `error-${key}`;
  const describedBy =
    [
      field.helperText && field.fieldType !== "TERMS_ACKNOWLEDGEMENT"
        ? helperId
        : "",
      error ? errorId : "",
    ]
      .filter(Boolean)
      .join(" ") || undefined;
  const label = (
    <>
      {field.order}. {field.label}
      {field.required && (
        <span className="ml-1 text-destructive" aria-hidden="true">
          *
        </span>
      )}
      {field.required && <span className="sr-only"> (required)</span>}
    </>
  );
  if (displayFieldTypes.has(field.fieldType))
    return (
      <div
        id={`field-${key}`}
        data-field-key={key}
        className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-7"
      >
        {field.fieldType === "SECTION_HEADING" ? (
          <h3 className="text-lg font-semibold">
            {field.content || field.label}
          </h3>
        ) : (
          <>
            <h3 className="mb-2 font-medium">{label}</h3>
            <p>{field.content || field.label}</p>
          </>
        )}
      </div>
    );

  const na = Boolean(answer?.notApplicable);
  const text =
    typeof answer?.value === "string" || typeof answer?.value === "number"
      ? String(answer.value)
      : "";
  const choices = new Set(
    Array.isArray(answer?.value)
      ? answer.value
      : typeof answer?.value === "string"
        ? [answer.value]
        : [],
  );
  const otherSelected = field.options.some(
    (option) => option.kind === "OTHER" && choices.has(option.value),
  );
  const grouped = ["RADIO", "MULTI_SELECT"].includes(field.fieldType);
  const common = {
    id: inputId,
    name: key,
    disabled: disabled || na,
    "aria-invalid": Boolean(error),
    "aria-describedby": describedBy,
    required: field.required && !na,
    className: inputClass,
  };
  let control: ReactNode;
  switch (field.fieldType) {
    case "IMAGE_UPLOAD":
      control = (
        <SurveyImageInput
          field={field}
          disabled={disabled}
          available={uploadsAvailable}
          describedBy={describedBy}
          error={error}
          onChange={onFileChange}
        />
      );
      break;
    case "TERMS_ACKNOWLEDGEMENT":
      control = (
        <div className="space-y-3">
          {termsText && (
            <p className="whitespace-pre-wrap rounded-lg bg-muted/50 p-4 text-sm leading-7">
              {termsText}
            </p>
          )}
          <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3">
            <input
              id={inputId}
              name={key}
              type="checkbox"
              className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
              checked={answer?.value === true}
              required={field.required}
              disabled={disabled}
              aria-invalid={Boolean(error)}
              aria-describedby={describedBy}
              onChange={(event) => onChange({ value: event.target.checked })}
            />
            <span className="text-sm leading-6">
              {field.helperText || field.label}
            </span>
          </label>
        </div>
      );
      break;
    case "MULTI_SELECT":
    case "RADIO":
      control = (
        <div className="grid gap-2 sm:grid-cols-2">
          {field.options.map((option) => (
            <label
              key={option.id}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm leading-6"
            >
              <input
                type={field.fieldType === "MULTI_SELECT" ? "checkbox" : "radio"}
                name={key}
                value={option.value}
                checked={choices.has(option.value)}
                disabled={disabled}
                className="mt-0.5 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
                aria-invalid={Boolean(error)}
                aria-describedby={describedBy}
                onChange={(event) => {
                  if (field.fieldType === "RADIO") {
                    onChange({ value: option.value });
                    return;
                  }
                  const selected = [...choices];
                  const next = !event.target.checked
                    ? selected.filter((value) => value !== option.value)
                    : option.kind === "NA"
                      ? [option.value]
                      : [
                          ...selected.filter(
                            (value) =>
                              !field.options.some(
                                (item) =>
                                  item.value === value && item.kind === "NA",
                              ),
                          ),
                          option.value,
                        ];
                  const keepsOther = field.options.some(
                    (item) =>
                      item.kind === "OTHER" && next.includes(item.value),
                  );
                  onChange({
                    value: next,
                    ...(keepsOther && answer?.otherText
                      ? { otherText: answer.otherText }
                      : {}),
                  });
                }}
              />
              <span className="min-w-0 break-words">{option.label}</span>
            </label>
          ))}
        </div>
      );
      break;
    case "SINGLE_SELECT":
    case "DAY_OF_WEEK":
      control = (
        <select
          {...common}
          value={text}
          onChange={(event) => onChange({ value: event.target.value })}
        >
          <option value="">Select an option</option>
          {field.options.map((option) => (
            <option key={option.id} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      );
      break;
    case "LONG_TEXT":
      control = (
        <div className="space-y-2">
          <textarea
            {...common}
            rows={5}
            placeholder={field.placeholder ?? undefined}
            maxLength={field.validationRules.maxLength ?? 20000}
            value={text}
            onChange={(event) => onChange({ value: event.target.value })}
          />
          {field.validationRules.maxWords !== undefined && (
            <p
              className={`text-sm ${countWords(text) > field.validationRules.maxWords ? "text-destructive" : "text-muted-foreground"}`}
              aria-live="polite"
            >
              {countWords(text)} / {field.validationRules.maxWords} words
            </p>
          )}
        </div>
      );
      break;
    default:
      control = (
        <input
          {...common}
          type={
            field.fieldType === "NUMBER"
              ? "number"
              : field.fieldType === "EMAIL"
                ? "email"
                : field.fieldType === "PHONE"
                  ? "tel"
                  : field.fieldType === "URL"
                    ? "url"
                    : field.fieldType === "TIME"
                      ? "time"
                      : "text"
          }
          step={field.fieldType === "NUMBER" ? "any" : undefined}
          min={field.validationRules.min}
          max={field.validationRules.max}
          minLength={field.validationRules.minLength}
          maxLength={field.validationRules.maxLength ?? 20000}
          placeholder={field.placeholder ?? undefined}
          value={text}
          onChange={(event) =>
            onChange({
              value:
                field.fieldType === "NUMBER"
                  ? event.target.value === ""
                    ? null
                    : Number(event.target.value)
                  : event.target.value,
            })
          }
        />
      );
  }
  const contents = (
    <>
      {field.helperText && field.fieldType !== "TERMS_ACKNOWLEDGEMENT" && (
        <p id={helperId} className="text-sm leading-6 text-muted-foreground">
          {field.helperText}
        </p>
      )}
      {control}
      {field.allowsNA &&
        !field.options.some((option) => option.kind === "NA") &&
        !["IMAGE_UPLOAD", "TERMS_ACKNOWLEDGEMENT"].includes(
          field.fieldType,
        ) && (
          <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
            <input
              type="checkbox"
              className="size-5 accent-primary focus-visible:outline-2 focus-visible:outline-ring"
              checked={na}
              disabled={disabled}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? { value: null, notApplicable: true }
                    : { value: field.fieldType === "NUMBER" ? null : "" },
                )
              }
            />
            Not applicable (N/A)
          </label>
        )}
      {otherSelected && (
        <div className="space-y-2">
          <label htmlFor={`other-${key}`} className="text-sm font-medium">
            Other, please specify <span aria-hidden="true">*</span>
          </label>
          <input
            id={`other-${key}`}
            type="text"
            required
            maxLength={2000}
            className={inputClass}
            disabled={disabled}
            value={answer?.otherText ?? ""}
            aria-invalid={Boolean(error)}
            aria-describedby={describedBy}
            onChange={(event) =>
              onChange({
                value: answer?.value ?? "",
                otherText: event.target.value,
              })
            }
          />
        </div>
      )}
      {error && (
        <p id={errorId} className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}
    </>
  );
  return grouped ? (
    <fieldset
      id={`field-${key}`}
      data-field-key={key}
      tabIndex={-1}
      className="min-w-0 space-y-3 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <legend className="mb-2 text-sm leading-6 font-medium">{label}</legend>
      {contents}
    </fieldset>
  ) : (
    <div
      id={`field-${key}`}
      data-field-key={key}
      tabIndex={-1}
      className="min-w-0 space-y-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <label htmlFor={inputId} className="block text-sm leading-6 font-medium">
        {label}
      </label>
      {contents}
    </div>
  );
}
