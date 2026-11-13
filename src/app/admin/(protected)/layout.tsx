import { Suspense, type ReactNode } from "react";
import { AdminShell } from "@/components/admin/admin-shell";
import { requireAdminPage } from "@/modules/auth/page-access";

async function ProtectedContent({ children }: { children: ReactNode }) {
  const admin = await requireAdminPage();
  return <AdminShell admin={admin}>{children}</AdminShell>;
}

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-muted-foreground" role="status">
          Loading admin portal…
        </p>
      }
    >
      <ProtectedContent>{children}</ProtectedContent>
    </Suspense>
  );
}
