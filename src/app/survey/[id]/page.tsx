import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { HeartPulse } from "lucide-react";
import { getPublishedSurvey } from "@/modules/surveys/published-survey";
import { SurveyServiceError } from "@/modules/surveys/survey-error";
import { PublicSurveyForm } from "@/modules/surveys/components/public-survey-form";
import { isImageStorageConfigured } from "@/lib/image-storage";

export const metadata = {
  title: "Provider survey | Resource Directory",
  description: "Submit practice and provider information for review.",
};

async function SurveyContent({ params }: { params: Promise<{ id: string }> }) {
  await connection();
  const { id } = await params;
  let published;
  try {
    published = await getPublishedSurvey(id);
  } catch (error) {
    if (error instanceof SurveyServiceError && error.status === 404) notFound();
    return (
      <div role="alert" className="rounded-xl border bg-background p-6">
        <h1 className="text-xl font-semibold">
          Survey temporarily unavailable
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Please try again later.
        </p>
      </div>
    );
  }
  const { snapshot, versionId } = published;
  return (
    <>
      <div className="mb-8">
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
                  className="break-all underline underline-offset-4"
                  href={`mailto:${snapshot.contactEmail}`}
                >
                  {snapshot.contactEmail}
                </a>
              </>
            )}
          </p>
        )}
      </div>
      <PublicSurveyForm
        snapshot={snapshot}
        versionId={versionId}
        uploadsAvailable={isImageStorageConfigured()}
      />
    </>
  );
}

export default function SurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return (
    <div className="min-h-dvh w-full bg-muted/30 [font-family:var(--font-geist-sans),sans-serif]">
      <header className="border-b bg-background">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-5 sm:px-6">
          <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HeartPulse className="size-5" aria-hidden="true" />
          </span>
          <div>
            <p className="text-sm font-semibold">Resource Directory</p>
            <p className="text-xs text-muted-foreground">
              Practice and provider survey
            </p>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl min-w-0 px-4 py-8 sm:px-6 sm:py-12">
        <Suspense
          fallback={
            <p role="status" className="text-sm text-muted-foreground">
              Loading survey…
            </p>
          }
        >
          <SurveyContent params={params} />
        </Suspense>
      </main>
    </div>
  );
}
