import { requireAdminPage } from "@/modules/auth/page-access";
import { SectionPlaceholder } from "@/components/admin/section-placeholder";

export const metadata = { title: "Resources" };

export default async function ResourcesPage() {
  await requireAdminPage();
  return (
    <SectionPlaceholder
      title="Resources"
      description="Resource management will be available here in a later phase."
    />
  );
}
