"use client";
import { useEffect, useRef, useState, type MouseEvent } from "react";
import Link from "next/link";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import type { SurveyEditorData } from "../builder-service";
import {
  draftDefinitionSchema,
  publicationIssues,
  fieldTypeLabels,
  mappingLabels,
  builderIssueLabel,
  type SurveyDraft,
  type BuilderIssue,
} from "../builder-schema";
import { normalizeDraft, newQuestion } from "../builder-draft";
import { builderRequest, BuilderRequestError } from "./builder-client-api";
import { BuilderConfirm } from "./builder-confirm";
import { QuestionEditor, builderInputClass } from "./question-editor";
import { SurveyPreview } from "./survey-preview";

const savedSchema = z.object({
  definition: draftDefinitionSchema,
  revision: z.string(),
  status: z.enum(["DRAFT", "PUBLISHED", "UNPUBLISHED"]),
  publishedVersion: z.number().nullable(),
});
export function SurveyEditor({ initial }: { initial: SurveyEditorData }) {
  const [draft, setDraft] = useState(initial.definition);
  const [saved, setSaved] = useState(initial.definition);
  const [revision, setRevision] = useState(initial.revision);
  const [status, setStatus] = useState(initial.status);
  const [version, setVersion] = useState(initial.publishedVersion);
  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [issues, setIssues] = useState<BuilderIssue[]>([]);
  const [confirm, setConfirm] = useState<{
    title: string;
    description: string;
    run: () => void;
    publish?: boolean;
  } | null>(null);
  const [newField, setNewField] = useState<string | null>(null);
  const busy = useRef(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const dirtyRef = useRef(dirty);
  useEffect(() => {
    dirtyRef.current = dirty;
  }, [dirty]);
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (dirtyRef.current) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    const linkClick = (event: globalThis.MouseEvent) => {
      if (
        !dirtyRef.current ||
        event.defaultPrevented ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link =
        event.target instanceof Element
          ? event.target.closest<HTMLAnchorElement>("a[href]")
          : null;
      if (
        link &&
        new URL(link.href, window.location.href).href !==
          window.location.href &&
        link.target !== "_blank" &&
        (link.pathname !== window.location.pathname ||
          link.search !== window.location.search) &&
        !window.confirm(
          "Leave this editor? Unsaved draft changes will be lost.",
        )
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", linkClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", linkClick, true);
    };
  }, []);
  function change(update: (draft: SurveyDraft) => void) {
    setDraft((previous) => {
      const next = structuredClone(previous);
      update(next);
      return normalizeDraft(next);
    });
    setMessage("");
  }
  async function save() {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    setIssues([]);
    try {
      const next = savedSchema.parse(
        await builderRequest(`/api/admin/surveys/${draft.surveyId}`, "PUT", {
          revision,
          definition: draft,
        }),
      );
      setDraft(next.definition);
      setSaved(next.definition);
      setRevision(next.revision);
      setStatus(next.status);
      setVersion(next.publishedVersion);
      setMessage("Draft saved. The live survey has not changed.");
    } catch (error) {
      setError(
        error instanceof BuilderRequestError
          ? error.message
          : "Unable to save this draft. Please try again.",
      );
      if (error instanceof BuilderRequestError) setIssues(error.issues);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  async function publish() {
    if (busy.current || dirty) return;
    busy.current = true;
    setPending(true);
    setError("");
    setIssues([]);
    try {
      const next = z
        .object({ revision: z.string(), versionNumber: z.number() })
        .parse(
          await builderRequest(
            `/api/admin/surveys/${draft.surveyId}/publish`,
            "POST",
            { revision },
          ),
        );
      setRevision(next.revision);
      setStatus("PUBLISHED");
      setVersion(next.versionNumber);
      setMessage(
        `Version ${next.versionNumber} is published. New submissions will use it.`,
      );
      setConfirm(null);
    } catch (error) {
      setError(
        error instanceof BuilderRequestError
          ? error.message
          : "Unable to publish this draft. Please try again.",
      );
      if (error instanceof BuilderRequestError) setIssues(error.issues);
      setConfirm(null);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  const savedKeys = new Set(
    saved.sections.flatMap((section) =>
      section.fields.map((field) => field.id),
    ),
  );
  const publishIssues = publicationIssues(draft);
  function removeSection(id: string) {
    change((next) => {
      next.sections = next.sections.filter((section) => section.id !== id);
    });
    setConfirm(null);
  }
  function reorderSection(id: string, direction: number) {
    change((next) => {
      const index = next.sections.findIndex((section) => section.id === id);
      [next.sections[index], next.sections[index + direction]] = [
        next.sections[index + direction],
        next.sections[index],
      ];
    });
  }
  function preventPreviewNavigation(event: MouseEvent<HTMLButtonElement>) {
    event.currentTarget.focus();
    setTab("preview");
  }
  return (
    <div className="space-y-6" data-builder-survey={draft.surveyId}>
      <Link
        href="/admin/surveys"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Back to surveys
      </Link>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold break-words">Survey editor</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            {status === "PUBLISHED"
              ? `Published · version ${version}`
              : status === "UNPUBLISHED"
                ? `Unpublished${version ? ` · latest version ${version}` : ""}`
                : "Draft · not published"}
          </p>
          <p role="status" className="mt-1 text-xs text-muted-foreground">
            {dirty ? "Unsaved changes" : "All draft changes saved"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-11"
            disabled={pending}
            onClick={() => void save()}
          >
            {pending ? "Saving…" : "Save Draft"}
          </Button>
          <Button
            type="button"
            className="min-h-11"
            disabled={pending || dirty}
            onClick={() =>
              setConfirm({
                title: "Publish this draft?",
                description:
                  "A new immutable version will be created. Existing responses and resources keep their original version.",
                run: () => void publish(),
                publish: true,
              })
            }
          >
            Publish
          </Button>
        </div>
      </div>
      <p className="text-sm leading-7 text-muted-foreground">
        Editing this draft does not change the public form. Save your changes
        before publishing a new version.
      </p>
      {message && (
        <p
          role="status"
          className="rounded-lg border bg-background p-4 text-sm leading-7"
        >
          {message}
        </p>
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm leading-7"
        >
          <p>{error}</p>
          {issues.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {issues.map((issue, index) => (
                <li key={index}>
                  <span className="font-medium">
                    {builderIssueLabel(draft, issue.path)}
                  </span>
                  : {issue.message}
                </li>
              ))}
            </ul>
          )}
          {error.includes("another session") && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => {
                if (
                  !dirty ||
                  window.confirm("Reload and discard your unsaved changes?")
                )
                  window.location.reload();
              }}
            >
              Reload saved draft
            </Button>
          )}
        </div>
      )}
      <div
        role="group"
        aria-label="Survey editor view"
        className="flex flex-wrap gap-2"
      >
        <Button
          type="button"
          variant={tab === "edit" ? "default" : "outline"}
          className="min-h-11"
          aria-pressed={tab === "edit"}
          onClick={() => setTab("edit")}
        >
          Edit draft
        </Button>
        <Button
          type="button"
          variant={tab === "preview" ? "default" : "outline"}
          className="min-h-11"
          aria-pressed={tab === "preview"}
          onClick={preventPreviewNavigation}
        >
          Live preview
        </Button>
        {status === "PUBLISHED" && (
          <Link
            href={`/survey/${draft.surveyId}`}
            target="_blank"
            className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm focus-visible:outline-2"
          >
            Open published form
            <span className="sr-only"> (opens a new tab)</span>
          </Link>
        )}
      </div>
      {tab === "preview" ? (
        <SurveyPreview definition={draft} />
      ) : (
        <>
          <section
            className="space-y-5 rounded-xl border bg-background p-4 sm:p-6"
            aria-labelledby="survey-information"
          >
            <h2 id="survey-information" className="text-lg font-semibold">
              Survey information
            </h2>
            <div className="space-y-2">
              <label htmlFor="builder-title" className="text-sm font-medium">
                Survey title
              </label>
              <input
                id="builder-title"
                className={builderInputClass}
                value={draft.title}
                maxLength={200}
                disabled={pending}
                onChange={(event) =>
                  change((next) => {
                    next.title = event.target.value;
                  })
                }
              />
            </div>
            {(
              [
                ["introText", "Introduction"],
                ["closingMessage", "Thank-you / closing message"],
                ["termsText", "Terms and conditions"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="space-y-2">
                <label
                  htmlFor={`builder-${key}`}
                  className="text-sm font-medium"
                >
                  {label}
                </label>
                <textarea
                  id={`builder-${key}`}
                  rows={4}
                  maxLength={20000}
                  className={builderInputClass}
                  value={draft[key]}
                  disabled={pending}
                  onChange={(event) =>
                    change((next) => {
                      if (key === "termsText")
                        for (const field of next.sections.flatMap(
                          (section) => section.fields,
                        ))
                          if (
                            field.fieldType === "DISPLAY_TEXT" &&
                            field.content === next.termsText
                          )
                            field.content = event.target.value;
                      next[key] = event.target.value;
                    })
                  }
                />
              </div>
            ))}
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {(
                [
                  ["deadlineText", "Deadline text"],
                  ["contactName", "Contact name"],
                  ["contactEmail", "Contact email"],
                ] as const
              ).map(([key, label]) => (
                <div key={key} className="space-y-2">
                  <label
                    htmlFor={`builder-${key}`}
                    className="text-sm font-medium"
                  >
                    {label}
                  </label>
                  <input
                    id={`builder-${key}`}
                    type={key === "contactEmail" ? "email" : "text"}
                    className={builderInputClass}
                    value={draft[key] ?? ""}
                    disabled={pending}
                    onChange={(event) =>
                      change((next) => {
                        next[key] = event.target.value || null;
                      })
                    }
                  />
                </div>
              ))}
            </div>
          </section>
          <section
            className="space-y-4"
            aria-labelledby="sections-and-questions"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 id="sections-and-questions" className="text-lg font-semibold">
                Sections and questions
              </h2>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                disabled={pending}
                onClick={() =>
                  change((next) => {
                    next.sections.push({
                      id: crypto.randomUUID(),
                      title: "New section",
                      order: next.sections.length + 1,
                      fields: [],
                    });
                  })
                }
              >
                Add section
              </Button>
            </div>
            {draft.sections.map((section, si) => (
              <section
                key={section.id}
                data-builder-section={section.id}
                className="min-w-0 space-y-4 rounded-xl border bg-background p-4 sm:p-6"
              >
                <div className="space-y-2">
                  <label
                    htmlFor={`section-title-${section.id}`}
                    className="text-sm font-medium"
                  >
                    Section {si + 1} title
                  </label>
                  <input
                    id={`section-title-${section.id}`}
                    className={builderInputClass}
                    value={section.title}
                    maxLength={200}
                    disabled={pending}
                    onChange={(event) =>
                      change((next) => {
                        next.sections.find(
                          (item) => item.id === section.id,
                        )!.title = event.target.value;
                      })
                    }
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={pending || si === 0}
                    onClick={() => reorderSection(section.id, -1)}
                  >
                    Move section up
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    disabled={pending || si === draft.sections.length - 1}
                    onClick={() => reorderSection(section.id, 1)}
                  >
                    Move section down
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="min-h-11"
                    disabled={pending}
                    onClick={() =>
                      setConfirm({
                        title: "Remove this section?",
                        description: section.fields.length
                          ? `This removes ${section.fields.length} question(s) from the draft. Published versions and existing answers stay unchanged.`
                          : "Remove this empty section from the draft?",
                        run: () => removeSection(section.id),
                      })
                    }
                  >
                    Remove section
                  </Button>
                </div>
                {section.fields.map((field, fi) => (
                  <details
                    key={field.id}
                    id={`builder-field-${field.fieldKey}`}
                    data-builder-field={field.id}
                    open={newField === field.id}
                    className="min-w-0 rounded-xl border"
                  >
                    <summary className="cursor-pointer rounded-xl p-4 text-sm leading-7 focus-visible:outline-2">
                      <span className="font-medium break-words">
                        {field.order}. {field.label || "Untitled question"}
                      </span>
                      <span className="mt-1 block text-xs text-muted-foreground">
                        {fieldTypeLabels[field.fieldType]}
                        {field.required ? " · Required" : " · Optional"}
                        {field.displayMapping
                          ? ` · ${mappingLabels[field.displayMapping]}`
                          : ""}
                      </span>
                    </summary>
                    <QuestionEditor
                      field={field}
                      saved={savedKeys.has(field.id)}
                      disabled={pending}
                      sectionId={section.id}
                      sections={draft.sections}
                      categories={initial.categories}
                      first={fi === 0}
                      last={fi === section.fields.length - 1}
                      onChange={(updated) =>
                        change((next) => {
                          const target = next.sections
                            .flatMap((section) => section.fields)
                            .find((item) => item.id === field.id);
                          if (target) Object.assign(target, updated);
                        })
                      }
                      onMove={(direction) =>
                        change((next) => {
                          const fields = next.sections.find(
                            (item) => item.id === section.id,
                          )!.fields;
                          const index = fields.findIndex(
                            (item) => item.id === field.id,
                          );
                          [fields[index], fields[index + direction]] = [
                            fields[index + direction],
                            fields[index],
                          ];
                        })
                      }
                      onMoveSection={(id) =>
                        change((next) => {
                          const source = next.sections.find(
                            (item) => item.id === section.id,
                          )!;
                          const index = source.fields.findIndex(
                            (item) => item.id === field.id,
                          );
                          const [moved] = source.fields.splice(index, 1);
                          next.sections
                            .find((item) => item.id === id)!
                            .fields.push(moved);
                        })
                      }
                      onRemove={() =>
                        setConfirm({
                          title: "Remove question?",
                          description: `Remove “${field.label}” from the draft? Older published versions and answers remain unchanged.`,
                          run: () => {
                            change((next) => {
                              for (const section of next.sections)
                                section.fields = section.fields.filter(
                                  (item) => item.id !== field.id,
                                );
                            });
                            setConfirm(null);
                          },
                        })
                      }
                    />
                  </details>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => {
                    const field = newQuestion();
                    setNewField(field.id);
                    change((next) => {
                      next.sections
                        .find((item) => item.id === section.id)!
                        .fields.push(field);
                    });
                  }}
                >
                  Add question
                </Button>
              </section>
            ))}
          </section>
          <details className="rounded-xl border bg-background p-4 sm:p-6">
            <summary className="min-h-8 cursor-pointer text-sm font-semibold">
              Publication checks ·{" "}
              {publishIssues.length
                ? `${publishIssues.length} item(s) to complete`
                : "Required mappings are present"}
            </summary>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Directory mappings connect answers to resource fields. Required
              address, contact, category, time-zone, and opening-hours mappings
              must be complete before publishing.
            </p>
            {publishIssues.length > 0 && (
              <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-7">
                {publishIssues.map((issue, index) => (
                  <li key={index}>{issue.message}</li>
                ))}
              </ul>
            )}
          </details>
        </>
      )}
      {confirm && (
        <BuilderConfirm
          title={confirm.title}
          description={confirm.description}
          pending={pending}
          destructive={!confirm.publish}
          confirmLabel={confirm.publish ? "Publish version" : "Remove"}
          onConfirm={confirm.run}
          onClose={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
