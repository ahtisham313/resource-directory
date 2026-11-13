"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { ManagedSurvey } from "../builder-service";
import { BuilderConfirm } from "./builder-confirm";
import {
  builderRequest,
  BuilderRequestError,
  createdSurveySchema,
} from "./builder-client-api";

export function SurveyManager({ surveys }: { surveys: ManagedSurvey[] }) {
  const router = useRouter();
  const busy = useRef(false);
  const [action, setAction] = useState<{
    kind: "create" | "publish" | "unpublish" | "duplicate" | "delete";
    survey?: ManagedSurvey;
  } | null>(null);
  const [title, setTitle] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  async function confirm() {
    if (!action || busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const id = action.survey?.id;
      const path =
        action.kind === "create"
          ? "/api/admin/surveys"
          : `/api/admin/surveys/${id}${action.kind === "delete" ? "" : `/${action.kind}`}`;
      const result = await builderRequest(
        path,
        action.kind === "delete" ? "DELETE" : "POST",
        action.kind === "create"
          ? { title }
          : { revision: action.survey?.revision },
      );
      if (action.kind === "create" || action.kind === "duplicate") {
        const created = createdSurveySchema.parse(result);
        router.push(`/admin/surveys/${created.id}/edit`);
      } else {
        setMessage(
          action.kind === "delete"
            ? "Survey removed from management. Any published history and responses have been preserved."
            : action.kind === "publish"
              ? "A new survey version is published."
              : "Survey unpublished. New submissions are disabled.",
        );
        router.refresh();
      }
      setAction(null);
    } catch (error) {
      setError(
        error instanceof BuilderRequestError
          ? [error.message, ...error.issues.map((issue) => issue.message)].join(
              " ",
            )
          : "Unable to complete this action. Please try again.",
      );
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  function open(
    kind: NonNullable<typeof action>["kind"],
    survey?: ManagedSurvey,
  ) {
    setError("");
    setTitle("");
    setAction({ kind, survey });
  }
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Surveys</h1>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            Build drafts, preview questions, and publish new versions.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-11"
          onClick={() => open("create")}
        >
          Create Survey
        </Button>
      </div>
      <Link
        href="/admin/responses"
        className="inline-flex min-h-11 items-center text-sm font-medium underline underline-offset-4"
      >
        Survey Responses
      </Link>
      {message && (
        <p
          role="status"
          className="rounded-lg border bg-background p-4 text-sm leading-7"
        >
          {message}
        </p>
      )}
      {!surveys.length && (
        <p className="rounded-xl border bg-background p-6 text-sm text-muted-foreground">
          No surveys yet. Create your first draft to get started.
        </p>
      )}
      <div className="grid gap-4">
        {surveys.map((survey) => (
          <article
            key={survey.id}
            data-survey-id={survey.id}
            className="min-w-0 rounded-xl border bg-background p-4 sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <h2 className="min-w-0 text-lg font-semibold break-words">
                {survey.title}
              </h2>
              <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium">
                {survey.status === "PUBLISHED"
                  ? "Published"
                  : survey.status === "UNPUBLISHED"
                    ? "Unpublished"
                    : "Draft"}
              </span>
            </div>
            <p className="mt-3 text-xs leading-6 text-muted-foreground">
              {survey.publishedVersion
                ? `Latest published version ${survey.publishedVersion}`
                : "Not published"}{" "}
              · {survey.responseCount} responses · Updated{" "}
              {new Intl.DateTimeFormat("en", {
                dateStyle: "medium",
                timeZone: "UTC",
              }).format(new Date(survey.revision))}{" "}
              UTC
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href={`/admin/surveys/${survey.id}/edit`}
                className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-medium focus-visible:outline-2"
              >
                Edit
              </Link>
              <Link
                href={`/admin/surveys/${survey.id}/preview`}
                className="inline-flex min-h-11 items-center rounded-lg border px-4 text-sm focus-visible:outline-2"
              >
                Preview
              </Link>
              {(
                [
                  "duplicate",
                  survey.status === "PUBLISHED" ? "unpublish" : "publish",
                  "delete",
                ] as const
              ).map((kind) => (
                <Button
                  key={kind}
                  type="button"
                  variant={kind === "delete" ? "destructive" : "outline"}
                  className="min-h-11"
                  onClick={() => open(kind, survey)}
                >
                  {kind === "duplicate"
                    ? "Duplicate"
                    : kind === "unpublish"
                      ? "Unpublish"
                      : kind === "publish"
                        ? "Publish"
                        : "Delete"}
                </Button>
              ))}
            </div>
          </article>
        ))}
      </div>
      {action && (
        <BuilderConfirm
          title={
            action.kind === "create"
              ? "Create survey"
              : `${action.kind[0].toUpperCase() + action.kind.slice(1)} survey?`
          }
          description={
            action.kind === "create"
              ? "Start with an empty draft and add your sections and questions in the editor."
              : action.kind === "delete"
                ? "This removes the survey from management and public submissions. Published history and responses will be archived and retained. A draft with no history will be permanently deleted."
                : action.kind === "publish"
                  ? "Publish the saved draft as a new immutable version. New submissions will use it."
                  : action.kind === "unpublish"
                    ? "Stop accepting new submissions. Existing responses and directory resources will remain available."
                    : "Create an independent draft copy without responses or version history."
          }
          pending={pending}
          destructive={action.kind === "delete"}
          confirmLabel={action.kind === "create" ? "Create draft" : "Confirm"}
          onConfirm={() => void confirm()}
          onClose={() => setAction(null)}
        >
          {action.kind === "create" && (
            <div className="mt-4 space-y-2">
              <label htmlFor="new-survey-title" className="text-sm font-medium">
                Survey title
              </label>
              <input
                id="new-survey-title"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={200}
                disabled={pending}
                className="min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 text-sm focus-visible:outline-2"
              />
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm leading-7 text-destructive">
              {error}
            </p>
          )}
        </BuilderConfirm>
      )}
    </div>
  );
}
