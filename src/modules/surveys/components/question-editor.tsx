"use client";
import { Button } from "@/components/ui/button";
import { choiceFieldTypes, displayFieldTypes } from "../survey-definition";
import {
  fieldTypes,
  displayMappings,
  type SurveyFieldDefinition,
} from "../survey-snapshot";
import {
  fieldTypeLabels,
  mappingLabels,
  mappingTypes,
} from "../builder-schema";
import { dayOptions } from "../builder-draft";

export const builderInputClass =
  "min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";
type Props = {
  field: SurveyFieldDefinition;
  saved: boolean;
  disabled: boolean;
  sections: Array<{ id: string; title: string }>;
  sectionId: string;
  categories: Array<{ slug: string; name: string }>;
  first: boolean;
  last: boolean;
  onChange: (field: SurveyFieldDefinition) => void;
  onMove: (direction: number) => void;
  onMoveSection: (id: string) => void;
  onRemove: () => void;
};
export function QuestionEditor({
  field,
  saved,
  disabled,
  sections,
  sectionId,
  categories,
  first,
  last,
  onChange,
  onMove,
  onMoveSection,
  onRemove,
}: Props) {
  const choice = choiceFieldTypes.has(field.fieldType),
    display = displayFieldTypes.has(field.fieldType);
  const patch = (data: Partial<SurveyFieldDefinition>) =>
    onChange({ ...field, ...data });
  const prefix = `settings-${field.id}`;
  function typeChange(type: SurveyFieldDefinition["fieldType"]) {
    patch({
      fieldType: type,
      validationRules: {},
      options:
        type === "DAY_OF_WEEK"
          ? dayOptions()
          : choiceFieldTypes.has(type)
            ? [
                {
                  id: crypto.randomUUID(),
                  value: "option-1",
                  label: "Option 1",
                  order: 0,
                  kind: "STANDARD",
                },
              ]
            : [],
      allowsOther: false,
      allowsNA: false,
      required: displayFieldTypes.has(type) ? false : field.required,
      displayMapping:
        field.displayMapping &&
        mappingTypes[field.displayMapping].includes(type)
          ? field.displayMapping
          : null,
    });
  }
  function special(kind: "OTHER" | "NA", enabled: boolean) {
    const options = field.options.filter((option) => option.kind !== kind);
    if (enabled && choice) {
      const value = kind === "OTHER" ? "other" : "na";
      options.push({
        id: crypto.randomUUID(),
        value: options.some((option) => option.value === value)
          ? `${value}-${crypto.randomUUID().slice(0, 8)}`
          : value,
        label: kind === "OTHER" ? "Other" : "N/A",
        order: options.length,
        kind,
      });
    }
    patch({
      options,
      ...(kind === "OTHER" ? { allowsOther: enabled } : { allowsNA: enabled }),
    });
  }
  function rule(
    name: "min" | "max" | "minLength" | "maxLength" | "maxWords" | "maxBytes",
    value: string,
  ) {
    const rules = { ...field.validationRules };
    if (value === "") delete rules[name];
    else rules[name] = Number(value);
    patch({ validationRules: rules });
  }
  return (
    <div className="space-y-5 border-t p-4 sm:p-5">
      <div className="grid min-w-0 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={`${prefix}-label`} className="text-sm font-medium">
            Question label
          </label>
          <input
            id={`${prefix}-label`}
            className={builderInputClass}
            value={field.label}
            maxLength={1000}
            disabled={disabled}
            onChange={(event) => patch({ label: event.target.value })}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`${prefix}-type`} className="text-sm font-medium">
            Input type
          </label>
          <select
            id={`${prefix}-type`}
            className={builderInputClass}
            value={field.fieldType}
            disabled={disabled}
            onChange={(event) =>
              typeChange(
                event.target.value as SurveyFieldDefinition["fieldType"],
              )
            }
          >
            {fieldTypes.map((type) => (
              <option key={type} value={type}>
                {fieldTypeLabels[type]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor={`${prefix}-key`} className="text-sm font-medium">
            Stable field key
          </label>
          <input
            id={`${prefix}-key`}
            className={builderInputClass}
            value={field.fieldKey}
            maxLength={100}
            readOnly={saved}
            disabled={disabled}
            onChange={(event) => patch({ fieldKey: event.target.value })}
          />
          <p className="text-xs leading-6 text-muted-foreground">
            {saved
              ? "Saved keys stay fixed when labels change."
              : "Use lowercase words separated by hyphens. The key becomes fixed after saving."}
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor={`${prefix}-mapping`} className="text-sm font-medium">
            Directory display mapping
          </label>
          <select
            id={`${prefix}-mapping`}
            className={builderInputClass}
            value={field.displayMapping ?? ""}
            disabled={disabled}
            onChange={(event) => {
              const mapping = event.target
                .value as SurveyFieldDefinition["displayMapping"];
              const rules = { ...field.validationRules };
              if (mapping === "TIME_ZONE") rules.format = "iana-time-zone";
              if (mapping === "ZIP_CODE") rules.format = "zip";
              if (mapping === "PHONE" && field.fieldType !== "PHONE")
                rules.format = "phone";
              patch({
                displayMapping: mapping || null,
                validationRules: rules,
              });
            }}
          >
            <option value="">No directory mapping</option>
            {displayMappings
              .filter((mapping) =>
                mappingTypes[mapping].includes(field.fieldType),
              )
              .map((mapping) => (
                <option key={mapping} value={mapping}>
                  {mappingLabels[mapping]}
                </option>
              ))}
          </select>
        </div>
        <div className="space-y-2">
          <label htmlFor={`${prefix}-helper`} className="text-sm font-medium">
            Helper text
          </label>
          <input
            id={`${prefix}-helper`}
            className={builderInputClass}
            value={field.helperText ?? ""}
            disabled={disabled}
            onChange={(event) =>
              patch({ helperText: event.target.value || null })
            }
          />
        </div>
        {!display && (
          <div className="space-y-2">
            <label
              htmlFor={`${prefix}-placeholder`}
              className="text-sm font-medium"
            >
              Placeholder
            </label>
            <input
              id={`${prefix}-placeholder`}
              className={builderInputClass}
              value={field.placeholder ?? ""}
              maxLength={1000}
              disabled={disabled}
              onChange={(event) =>
                patch({ placeholder: event.target.value || null })
              }
            />
          </div>
        )}
      </div>
      {display && (
        <div className="space-y-2">
          <label htmlFor={`${prefix}-content`} className="text-sm font-medium">
            Displayed content
          </label>
          <textarea
            id={`${prefix}-content`}
            rows={4}
            className={builderInputClass}
            value={field.content ?? ""}
            disabled={disabled}
            onChange={(event) => patch({ content: event.target.value || null })}
          />
        </div>
      )}
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {!display && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={field.required}
              disabled={disabled}
              onChange={(event) => patch({ required: event.target.checked })}
            />
            Required
          </label>
        )}
        {choice && (
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-primary"
              checked={field.allowsOther}
              disabled={disabled}
              onChange={(event) => special("OTHER", event.target.checked)}
            />
            Allow Other
          </label>
        )}
        {!display &&
          !["TERMS_ACKNOWLEDGEMENT", "IMAGE_UPLOAD"].includes(
            field.fieldType,
          ) && (
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-primary"
                checked={field.allowsNA}
                disabled={disabled}
                onChange={(event) => special("NA", event.target.checked)}
              />
              Allow N/A
            </label>
          )}
      </div>
      {choice && (
        <fieldset className="min-w-0 space-y-3 rounded-lg border p-3 sm:p-4">
          <legend className="px-1 text-sm font-medium">Options</legend>
          <p className="text-xs leading-6 text-muted-foreground">
            Changing a label keeps its value. Value changes apply to future
            published versions.
          </p>
          {field.options.map((option, index) => (
            <div
              key={option.id}
              data-option-id={option.id}
              className="grid min-w-0 gap-2 rounded-lg bg-muted/30 p-3 sm:grid-cols-2"
            >
              <div className="min-w-0">
                <label
                  htmlFor={`${prefix}-${option.id}-label`}
                  className="text-xs text-muted-foreground"
                >
                  Label
                  {option.kind !== "STANDARD"
                    ? ` (${option.kind === "OTHER" ? "Other" : "N/A"})`
                    : ""}
                </label>
                <input
                  id={`${prefix}-${option.id}-label`}
                  className={builderInputClass}
                  value={option.label}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      options: field.options.map((item) =>
                        item.id === option.id
                          ? { ...item, label: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </div>
              <div className="min-w-0">
                <label
                  htmlFor={`${prefix}-${option.id}-value`}
                  className="text-xs text-muted-foreground"
                >
                  Value
                </label>
                <input
                  id={`${prefix}-${option.id}-value`}
                  className={builderInputClass}
                  value={option.value}
                  disabled={disabled}
                  onChange={(event) =>
                    patch({
                      options: field.options.map((item) =>
                        item.id === option.id
                          ? { ...item, value: event.target.value }
                          : item,
                      ),
                    })
                  }
                />
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  aria-label={`Move option ${option.label} up`}
                  disabled={disabled || index === 0}
                  onClick={() => {
                    const options = [...field.options];
                    [options[index - 1], options[index]] = [
                      options[index],
                      options[index - 1],
                    ];
                    patch({ options });
                  }}
                >
                  Up
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  aria-label={`Move option ${option.label} down`}
                  disabled={disabled || index === field.options.length - 1}
                  onClick={() => {
                    const options = [...field.options];
                    [options[index + 1], options[index]] = [
                      options[index],
                      options[index + 1],
                    ];
                    patch({ options });
                  }}
                >
                  Down
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() =>
                    patch({
                      options: field.options.filter(
                        (item) => item.id !== option.id,
                      ),
                      ...(option.kind === "OTHER"
                        ? { allowsOther: false }
                        : option.kind === "NA"
                          ? { allowsNA: false }
                          : {}),
                    })
                  }
                >
                  Remove option
                </Button>
              </div>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11"
              disabled={disabled}
              onClick={() =>
                patch({
                  options: [
                    ...field.options,
                    {
                      id: crypto.randomUUID(),
                      value: `option-${crypto.randomUUID().slice(0, 8)}`,
                      label: "New option",
                      order: field.options.length,
                      kind: "STANDARD",
                    },
                  ],
                })
              }
            >
              Add option
            </Button>
            {field.displayMapping === "CATEGORY" && (
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={disabled}
                onClick={() =>
                  patch({
                    allowsNA: false,
                    allowsOther: false,
                    options: categories.map((category, order) => ({
                      id:
                        field.options.find(
                          (option) => option.value === category.slug,
                        )?.id ?? crypto.randomUUID(),
                      value: category.slug,
                      label: category.name,
                      order,
                      kind: "STANDARD",
                    })),
                  })
                }
              >
                Use directory categories
              </Button>
            )}
          </div>
        </fieldset>
      )}
      {!display && (
        <details className="rounded-lg border p-4">
          <summary className="min-h-8 cursor-pointer text-sm font-medium">
            Validation settings
          </summary>
          <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            {field.fieldType === "NUMBER"
              ? (["min", "max"] as const).map((name) => (
                  <div key={name} className="space-y-2">
                    <label htmlFor={`${prefix}-${name}`} className="text-sm">
                      {name === "min" ? "Minimum number" : "Maximum number"}
                    </label>
                    <input
                      id={`${prefix}-${name}`}
                      type="number"
                      step="any"
                      className={builderInputClass}
                      value={field.validationRules[name] ?? ""}
                      disabled={disabled}
                      onChange={(event) => rule(name, event.target.value)}
                    />
                  </div>
                ))
              : !choice &&
                !["IMAGE_UPLOAD", "TERMS_ACKNOWLEDGEMENT"].includes(
                  field.fieldType,
                ) &&
                (
                  [
                    "minLength",
                    "maxLength",
                    ...(field.fieldType === "LONG_TEXT"
                      ? ["maxWords" as const]
                      : []),
                  ] as const
                ).map((name) => (
                  <div key={name} className="space-y-2">
                    <label htmlFor={`${prefix}-${name}`} className="text-sm">
                      {name === "minLength"
                        ? "Minimum characters"
                        : name === "maxLength"
                          ? "Maximum characters"
                          : "Maximum words"}
                    </label>
                    <input
                      id={`${prefix}-${name}`}
                      type="number"
                      min={name === "minLength" ? 0 : 1}
                      max={20000}
                      className={builderInputClass}
                      value={field.validationRules[name] ?? ""}
                      disabled={disabled}
                      onChange={(event) => rule(name, event.target.value)}
                    />
                  </div>
                ))}
            {["SHORT_TEXT", "PHONE", "SINGLE_SELECT", "RADIO"].includes(
              field.fieldType,
            ) && (
              <div className="space-y-2">
                <label htmlFor={`${prefix}-format`} className="text-sm">
                  Additional format
                </label>
                <select
                  id={`${prefix}-format`}
                  className={builderInputClass}
                  value={field.validationRules.format ?? ""}
                  disabled={disabled}
                  onChange={(event) => {
                    const rules = { ...field.validationRules };
                    if (event.target.value)
                      rules.format = event.target.value as
                        "zip" | "phone" | "iana-time-zone";
                    else delete rules.format;
                    patch({ validationRules: rules });
                  }}
                >
                  <option value="">None</option>
                  {field.fieldType === "SHORT_TEXT" && (
                    <option value="zip">US ZIP code</option>
                  )}
                  {["SHORT_TEXT", "PHONE"].includes(field.fieldType) && (
                    <option value="phone">Phone number</option>
                  )}
                  {field.fieldType !== "PHONE" && (
                    <option value="iana-time-zone">IANA time zone</option>
                  )}
                </select>
              </div>
            )}
            {!choice &&
              !["NUMBER", "IMAGE_UPLOAD", "TERMS_ACKNOWLEDGEMENT"].includes(
                field.fieldType,
              ) && (
                <div className="space-y-2">
                  <label htmlFor={`${prefix}-pattern`} className="text-sm">
                    Pattern (optional)
                  </label>
                  <input
                    id={`${prefix}-pattern`}
                    maxLength={200}
                    className={builderInputClass}
                    value={field.validationRules.pattern ?? ""}
                    disabled={disabled}
                    onChange={(event) => {
                      const rules = { ...field.validationRules };
                      if (event.target.value)
                        rules.pattern = event.target.value;
                      else delete rules.pattern;
                      patch({ validationRules: rules });
                    }}
                  />
                </div>
              )}
            {field.fieldType === "IMAGE_UPLOAD" && (
              <>
                <div className="space-y-2">
                  <label htmlFor={`${prefix}-maxBytes`} className="text-sm">
                    Maximum image bytes (up to 2 MB)
                  </label>
                  <input
                    id={`${prefix}-maxBytes`}
                    type="number"
                    min={1}
                    max={2097152}
                    className={builderInputClass}
                    value={field.validationRules.maxBytes ?? ""}
                    disabled={disabled}
                    onChange={(event) => rule("maxBytes", event.target.value)}
                  />
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-sm">Allowed image types</legend>
                  {["image/png", "image/jpeg", "image/webp"].map((type) => (
                    <label
                      key={type}
                      className="flex min-h-11 items-center gap-2 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={(
                          field.validationRules.mimeTypes ?? [
                            "image/png",
                            "image/jpeg",
                            "image/webp",
                          ]
                        ).includes(type)}
                        disabled={disabled}
                        onChange={(event) => {
                          const types = field.validationRules.mimeTypes ?? [
                            "image/png",
                            "image/jpeg",
                            "image/webp",
                          ];
                          patch({
                            validationRules: {
                              ...field.validationRules,
                              mimeTypes: event.target.checked
                                ? [...types, type]
                                : types.filter((item) => item !== type),
                            },
                          });
                        }}
                      />
                      {type.replace("image/", "").toUpperCase()}
                    </label>
                  ))}
                </fieldset>
              </>
            )}
          </div>
        </details>
      )}
      <div className="flex flex-wrap gap-2 border-t pt-4">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || first}
          onClick={() => onMove(-1)}
        >
          Move question up
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled || last}
          onClick={() => onMove(1)}
        >
          Move question down
        </Button>
        <Button
          type="button"
          variant="destructive"
          className="min-h-11"
          disabled={disabled}
          onClick={onRemove}
        >
          Remove question
        </Button>
      </div>
      {sections.length > 1 && (
        <div className="space-y-2">
          <label htmlFor={`${prefix}-section`} className="text-sm font-medium">
            Move to section
          </label>
          <select
            id={`${prefix}-section`}
            className={builderInputClass}
            value={sectionId}
            disabled={disabled}
            onChange={(event) => onMoveSection(event.target.value)}
          >
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
