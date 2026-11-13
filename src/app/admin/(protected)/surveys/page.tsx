import { Suspense } from "react";
import { requireAdminPage } from "@/modules/auth/page-access";
import { listManagedSurveys } from "@/modules/surveys/builder-service";
import { SurveyManager } from "@/modules/surveys/components/survey-manager";
export const metadata = { title: "Surveys" };
async function Management() {
  await requireAdminPage();
  return <SurveyManager surveys={await listManagedSurveys()} />;
}
export default function SurveysPage() {
  return (
    <Suspense fallback={<p role="status">Loading surveys?</p>}>
      <Management />
    </Suspense>
  );
}
