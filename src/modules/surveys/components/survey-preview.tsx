"use client";
import { draftDefinitionSchema, builderIssueLabel } from "../builder-schema";
import type { SurveySnapshot } from "../survey-snapshot";
import { PublicSurveyForm } from "./public-survey-form";
import { SurveyIntroduction } from "./survey-introduction";

export function SurveyPreview({ definition }: { definition: SurveySnapshot }) {
  const result = draftDefinitionSchema.safeParse(definition);
  if (!result.success)
    return (
      <div role="alert" className="rounded-xl border p-5">
        <h2 className="font-semibold">Check the draft before previewing</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm">
          {result.error.issues.map((issue, index) => (
            <li key={index}>
              {builderIssueLabel(definition, issue.path.join("."))}:{" "}
              {issue.message}
            </li>
          ))}
        </ul>
      </div>
    );
  return (
    <div className="mx-auto w-full max-w-3xl min-w-0">
      <p className="mb-6 rounded-lg border bg-muted/50 p-4 text-sm leading-6">
        Draft preview. You can try the fields and check validation. No answers
        or files are sent to the server.
      </p>
      <SurveyIntroduction snapshot={result.data} />
      <PublicSurveyForm
        snapshot={result.data}
        versionId="preview"
        uploadsAvailable
        preview
      />
    </div>
  );
}
