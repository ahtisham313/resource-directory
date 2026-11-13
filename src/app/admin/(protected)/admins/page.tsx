import { requireAdminPage } from "@/modules/auth/page-access";
import { listAdmins } from "@/modules/management/admin-management";
import { isInvitationMailConfigured } from "@/modules/management/invitation-mail";
import { AdminManager } from "@/modules/management/components/admin-manager";

export const metadata = { title: "Admins" };

export default async function AdminsPage() {
  const admin = await requireAdminPage();
  if (admin.role !== "SUPER_ADMIN")
    return (
      <div className="space-y-3">
        <h1 className="text-3xl font-semibold">Administrators</h1>
        <p>
          Only super admins can manage administrator accounts and invitations.
        </p>
      </div>
    );
  return (
    <AdminManager
      data={await listAdmins()}
      currentId={admin.id}
      mailConfigured={isInvitationMailConfigured()}
    />
  );
}
