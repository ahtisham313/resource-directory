import type { SurveySnapshot } from "../survey-snapshot";

export function SurveyIntroduction({ snapshot }: { snapshot: SurveySnapshot }) {
  return (
    <div className="mb-8 min-w-0 break-words">
      <p className="mb-2 text-sm font-medium text-muted-foreground">
        PROVIDER INFORMATION
      </p>
      <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
        {snapshot.title}
      </h1>
      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-muted-foreground">
        {snapshot.introText}
      </p>
      {snapshot.deadlineText && (
        <p className="mt-4 text-sm leading-6">{snapshot.deadlineText}</p>
      )}
      {(snapshot.contactName || snapshot.contactEmail) && (
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Questions? {snapshot.contactName}
          {snapshot.contactEmail && (
            <>
              {" "}
              ·{" "}
              <a
                className="inline-flex min-h-11 max-w-full items-center break-all underline underline-offset-4"
                href={`mailto:${snapshot.contactEmail}`}
              >
                {snapshot.contactEmail}
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
