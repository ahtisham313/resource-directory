import { requireAdminPage } from "@/modules/auth/page-access";

export default async function DashboardPage() {
  const admin = await requireAdminPage();
  return (
    <section className="max-w-3xl rounded-2xl border bg-background p-5 sm:p-8">
      <p className="mb-3 text-sm text-muted-foreground">
        Hello, {admin.name || admin.email}
      </p>
      <h1 className="text-2xl leading-tight font-semibold tracking-tight sm:text-3xl">
        Welcome to the Resource Directory Admin Portal.
      </h1>
      <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground">
        This is your workspace for managing surveys, resources, and
        administrators. Use the navigation to open each section.
      </p>
    </section>
  );
}
