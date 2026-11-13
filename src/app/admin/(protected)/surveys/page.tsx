import { requireAdminPage } from "@/modules/auth/page-access";
import { SectionPlaceholder } from "@/components/admin/section-placeholder";

export const metadata = { title: "Survey" };

export default async function SurveysPage() {
  await requireAdminPage();
  return (
    <SectionPlaceholder
      title="Survey"
      description="Survey management will be available here in a later phase."
    />
  );
}
