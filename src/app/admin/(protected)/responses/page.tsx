import { Suspense } from "react";
import Link from "next/link";
import { requireAdminPage } from "@/modules/auth/page-access";
import { listResponses } from "@/modules/responses/response-data";
import { ReviewError } from "@/modules/responses/review-types";
import { ResponseList } from "@/modules/responses/components/response-list";

export const metadata = { title: "Survey Responses" };
async function ResponsesContent({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const params = await searchParams;
  let result;
  try {
    result = await listResponses({
      q: typeof params.q === "string" ? params.q : undefined,
      status: typeof params.status === "string" ? params.status : undefined,
      page: typeof params.page === "string" ? params.page : undefined,
    });
  } catch (error) {
    if (error instanceof ReviewError)
      return (
        <div role="alert" className="rounded-xl border bg-background p-6">
          <h1 className="text-xl font-semibold">Unable to show responses</h1>
          <p className="mt-3 text-sm">{error.message}</p>
          <Link
            href="/admin/responses"
            className="mt-4 inline-flex min-h-11 items-center underline"
          >
            Clear filters
          </Link>
        </div>
      );
    throw error;
  }
  return <ResponseList result={result} />;
}
export default function ResponsesPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <Suspense fallback={<p role="status">Loading responses…</p>}>
      <ResponsesContent {...props} />
    </Suspense>
  );
}
