"use client";

import { useRef, useState, type FormEvent } from "react";
import { z } from "zod";
import { CircleCheck, LoaderCircle, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SurveyAnswerError, validateSurveyAnswers } from "../answer-validation";
import { getImageField } from "../survey-definition";
import type { SurveyAnswers, SurveySnapshot } from "../survey-snapshot";
import { SurveyRenderer } from "./survey-renderer";

const replySchema = z.object({
  status: z.literal("PENDING").optional(),
  message: z.string().optional(),
  error: z.string().optional(),
  fieldErrors: z.record(z.string(), z.string()).optional(),
});

export function PublicSurveyForm({
  snapshot,
  versionId,
  uploadsAvailable,
  preview = false,
}: {
  snapshot: SurveySnapshot;
  versionId: string;
  uploadsAvailable: boolean;
  preview?: boolean;
}) {
  const [answers, setAnswers] = useState<SurveyAnswers>({});
  const [file, setFile] = useState<File>();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const form = useRef<HTMLFormElement>(null);
  const imageKey = getImageField(snapshot)?.fieldKey;
  const labels = Object.fromEntries(
    snapshot.sections
      .flatMap((section) => section.fields)
      .map((field) => [field.fieldKey, field.label]),
  );

  function fieldErrors(): Record<string, string> {
    try {
      validateSurveyAnswers(snapshot, answers, Boolean(file));
      return {};
    } catch (error) {
      return error instanceof SurveyAnswerError
        ? error.fieldErrors
        : { _form: "Please check your answers." };
    }
  }
  function focusError(nextErrors: Record<string, string>) {
    const key = Object.keys(nextErrors).find((key) => labels[key]);
    if (key) document.getElementById(`field-${key}`)?.focus();
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    if (preview) setMessage("");
    const nextErrors = fieldErrors();
    if (imageKey && errors[imageKey]) nextErrors[imageKey] = errors[imageKey];
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      focusError(nextErrors);
      return;
    }
    if (preview) {
      setMessage(
        "Preview answers are valid. No response or image was sent to the server.",
      );
      return;
    }
    busy.current = true;
    setPending(true);
    setMessage("");
    setOutdated(false);
    const body = new FormData();
    body.set("versionId", versionId);
    body.set("answers", JSON.stringify(answers));
    body.set(
      "contactFax",
      String(new FormData(event.currentTarget).get("contactFax") ?? ""),
    );
    if (file) body.set("image", file);
    try {
      const response = await fetch(
        `/api/surveys/${encodeURIComponent(snapshot.surveyId)}/responses`,
        { method: "POST", body },
      );
      const parsed = replySchema.safeParse(await response.json());
      if (!parsed.success) throw new Error("Unexpected response");
      if (!response.ok) {
        setErrors(parsed.data.fieldErrors ?? {});
        setMessage(
          parsed.data.error ?? "Unable to submit the survey. Please try again.",
        );
        setOutdated(response.status === 409);
        focusError(parsed.data.fieldErrors ?? {});
        return;
      }
      if (response.status !== 201 || parsed.data.status !== "PENDING")
        throw new Error("Unexpected submission status");
      setSuccess(
        parsed.data.message ||
          snapshot.closingMessage ||
          "Thank you for submitting your information.",
      );
      setAnswers({});
      setFile(undefined);
      window.scrollTo({ top: 0, behavior: "instant" });
    } catch {
      setMessage(
        "Unable to submit the survey. Your answers are still here. Please try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  if (success !== null)
    return (
      <section
        role="status"
        className="rounded-2xl border bg-background p-5 shadow-sm sm:p-8"
      >
        <CircleCheck className="mb-4 size-10 text-primary" aria-hidden="true" />
        <h1 className="text-2xl font-semibold">Thank you</h1>
        <p className="mt-3 whitespace-pre-wrap text-sm leading-7">{success}</p>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">
          Your response has been received and is pending review.
        </p>
      </section>
    );
  return (
    <form
      ref={form}
      onSubmit={submit}
      noValidate
      aria-busy={pending}
      className="space-y-6"
      onBlur={(event) => {
        const key =
          event.target.closest<HTMLElement>("[data-field-key]")?.dataset
            .fieldKey;
        if (!key || key === imageKey) return;
        const next = fieldErrors()[key];
        setErrors((previous) => {
          const updated = { ...previous };
          if (next) updated[key] = next;
          else delete updated[key];
          return updated;
        });
      }}
    >
      <div
        aria-hidden="true"
        className="absolute -left-[10000px] h-px w-px overflow-hidden"
      >
        <label htmlFor="contact-fax">Contact fax</label>
        <input
          id="contact-fax"
          name="contactFax"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>
      <p className="text-sm text-muted-foreground">
        Fields marked <span className="text-destructive">*</span> are required.
      </p>
      {Object.keys(errors).length > 0 && (
        <div
          role="alert"
          className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"
        >
          <p className="font-medium">Please check these answers:</p>
          <ul className="mt-2 list-inside list-disc space-y-1">
            {Object.entries(errors).map(([key, error]) => (
              <li key={key}>
                {labels[key] ? (
                  <a
                    href={`#field-${key}`}
                    className="underline underline-offset-2"
                  >
                    {labels[key]}: {error}
                  </a>
                ) : (
                  error
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      <SurveyRenderer
        snapshot={snapshot}
        answers={answers}
        errors={errors}
        disabled={pending}
        uploadsAvailable={uploadsAvailable}
        onChange={(key, answer) => {
          if (preview) setMessage("");
          setAnswers((previous) => ({ ...previous, [key]: answer }));
          setErrors((previous) => {
            const next = { ...previous };
            delete next[key];
            return next;
          });
        }}
        onFileChange={(selected, error) => {
          if (preview) setMessage("");
          setFile(selected);
          if (imageKey)
            setErrors((previous) => {
              const next = { ...previous };
              if (error) next[imageKey] = error;
              else delete next[imageKey];
              return next;
            });
        }}
      />
      {message && (
        <div
          role={preview ? "status" : "alert"}
          className={
            preview
              ? "rounded-xl border bg-background p-4 text-sm leading-6"
              : "rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm leading-6"
          }
        >
          {message}
          {outdated && (
            <Button
              type="button"
              variant="outline"
              className="mt-3 min-h-11"
              onClick={() => window.location.reload()}
            >
              Reload survey
            </Button>
          )}
        </div>
      )}
      <div className="rounded-2xl border bg-background p-4 sm:p-6">
        <Button
          type="submit"
          disabled={pending}
          className="min-h-11 w-full gap-2 sm:w-auto sm:px-6"
        >
          {pending ? (
            <LoaderCircle className="animate-spin" aria-hidden="true" />
          ) : (
            <Send aria-hidden="true" />
          )}
          {pending
            ? "Submitting…"
            : preview
              ? "Check preview answers"
              : "Submit information"}
        </Button>
        <p className="mt-3 text-xs leading-6 text-muted-foreground">
          {preview
            ? "Preview only. Submitting and uploading are disabled."
            : "Submissions are reviewed before they appear in the directory."}
        </p>
      </div>
    </form>
  );
}
