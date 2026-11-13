import { requireAdminPage } from "@/modules/auth/page-access";
import Link from "next/link";

export const metadata = { title: "Survey" };

export default async function SurveysPage() {
  await requireAdminPage();
  return (
    <section className="max-w-3xl rounded-2xl border bg-background p-5 sm:p-8">
      <h1 className="text-2xl font-semibold">Survey</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        Review submitted practice and provider information.
      </p>
      <Link
        href="/admin/responses"
        className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground focus-visible:outline-2 focus-visible:outline-ring"
      >
        Survey Responses
      </Link>
    </section>
  );
}
