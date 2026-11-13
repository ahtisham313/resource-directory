import { requireAdminPage } from "@/modules/auth/page-access";
import { SectionPlaceholder } from "@/components/admin/section-placeholder";

export const metadata = { title: "Admins" };

export default async function AdminsPage() {
  await requireAdminPage();
  return (
    <SectionPlaceholder
      title="Admins"
      description="Administrator management will be available here in a later phase."
    />
  );
}
