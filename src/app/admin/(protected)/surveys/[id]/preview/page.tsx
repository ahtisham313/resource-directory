import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/modules/auth/page-access";
import { getSurveyEditor } from "@/modules/surveys/builder-service";
import { SurveyBuilderError } from "@/modules/surveys/builder-schema";
import { SurveyPreview } from "@/modules/surveys/components/survey-preview";
export const metadata = { title: "Draft survey preview" };
async function Preview({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  let data;
  try {
    data = await getSurveyEditor((await params).id);
  } catch (error) {
    if (error instanceof SurveyBuilderError && error.status === 404) notFound();
    throw error;
  }
  return (
    <div className="space-y-6">
      <Link
        href={`/admin/surveys/${data.definition.surveyId}/edit`}
        className="inline-flex min-h-11 items-center text-sm underline underline-offset-4"
      >
        Back to editor
      </Link>
      <SurveyPreview definition={data.definition} />
    </div>
  );
}
export default function PreviewPage(props: {
  params: Promise<{ id: string }>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading draft preview…</p>}>
      <Preview {...props} />
    </Suspense>
  );
}
