import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/modules/auth/page-access";
import { getResponseDetails } from "@/modules/responses/response-data";
import { ReviewError } from "@/modules/responses/review-types";
import { ResponseStatus } from "@/modules/responses/components/response-status";
import { ResponseAnswers } from "@/modules/responses/components/response-answers";
import { reviewDate } from "@/modules/responses/components/response-list";
import { isImageStorageConfigured } from "@/lib/image-storage";
import { ReviewActions } from "@/modules/responses/components/review-actions";

export const metadata = { title: "Response details" };
async function ResponseContent({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  const { id } = await params;
  let response;
  try {
    response = await getResponseDetails(id);
  } catch (error) {
    if (error instanceof ReviewError && error.status === 404) notFound();
    if (error instanceof ReviewError)
      return (
        <div role="alert" className="rounded-xl border bg-background p-6">
          <h1 className="text-xl font-semibold">Unable to read submission</h1>
          <p className="mt-3 text-sm leading-7">{error.message}</p>
        </div>
      );
    throw error;
  }
  return (
    <div className="space-y-6">
      <Link
        href="/admin/responses"
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Back to Survey Responses
      </Link>
      <div className="rounded-xl border bg-background p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold break-words">
              {response.title}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {response.snapshot.title} · Version{" "}
              {response.surveyVersion.versionNumber}
            </p>
          </div>
          <ResponseStatus status={response.status} />
        </div>
        <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">Submitted</dt>
            <dd className="mt-1">{reviewDate(response.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reviewed by</dt>
            <dd className="mt-1">
              {response.reviewer?.name ||
                response.reviewer?.email ||
                "Not reviewed"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Reviewed</dt>
            <dd className="mt-1">{reviewDate(response.reviewedAt)}</dd>
          </div>
          {response.resource && (
            <div>
              <dt className="text-muted-foreground">Resource</dt>
              <dd className="mt-1">
                {response.resource.active ? "Active" : "Inactive"}
                {response.resource.latitude !== null &&
                response.resource.longitude !== null
                  ? ` · ${response.resource.latitude}, ${response.resource.longitude}`
                  : ""}
              </dd>
            </div>
          )}
        </dl>
        {response.reviewNote && (
          <div className="mt-5 border-t pt-4">
            <h2 className="text-sm font-medium">Review note</h2>
            <p className="mt-2 text-sm leading-7 whitespace-pre-wrap break-words">
              {response.reviewNote}
            </p>
          </div>
        )}
      </div>
      <ReviewActions id={response.id} status={response.status} />
      <ResponseAnswers
        id={response.id}
        snapshot={response.snapshot}
        answers={response.answers}
        hasImage={Boolean(response.uploadedImageKey)}
        imagesAvailable={isImageStorageConfigured()}
      />
    </div>
  );
}
export default function ResponsePage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading submission…</p>}>
      <ResponseContent {...props} />
    </Suspense>
  );
}
