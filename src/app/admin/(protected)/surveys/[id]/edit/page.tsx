import { Suspense } from "react";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/modules/auth/page-access";
import { getSurveyEditor } from "@/modules/surveys/builder-service";
import { SurveyBuilderError } from "@/modules/surveys/builder-schema";
import { SurveyEditor } from "@/modules/surveys/components/survey-editor";
export const metadata = { title: "Survey editor" };
async function Editor({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  let initial;
  try {
    initial = await getSurveyEditor((await params).id);
  } catch (error) {
    if (error instanceof SurveyBuilderError && error.status === 404) notFound();
    throw error;
  }
  return <SurveyEditor key={initial.definition.surveyId} initial={initial} />;
}
export default function EditPage(props: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<p role="status">Loading survey editor…</p>}>
      <Editor {...props} />
    </Suspense>
  );
}
