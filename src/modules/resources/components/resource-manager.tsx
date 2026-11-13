"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BuilderConfirm } from "@/modules/surveys/components/builder-confirm";
import { managementRequest } from "@/modules/management/client-request";
import type { listManagedResources } from "../resource-management";
type Data = Awaited<ReturnType<typeof listManagedResources>>;
export function ResourceManager({ data }: { data: Data }) {
  const router = useRouter();
  const [target, setTarget] = useState<{
    row: Data["rows"][number];
    action: "visibility" | "delete";
  }>();
  const [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function confirm() {
    if (!target || pending) return;
    setPending(true);
    setError("");
    try {
      await managementRequest(
        `/api/admin/resources/${target.row.id}`,
        "PATCH",
        {
          action: target.action,
          revision: target.row.revision,
          ...(target.action === "visibility"
            ? { active: !target.row.active }
            : {}),
        },
      );
      setTarget(undefined);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to update this resource.",
      );
    } finally {
      setPending(false);
    }
  }
  function pageHref(page: number) {
    const query = new URLSearchParams({
      q: data.q,
      category: data.category,
      page: String(page),
    });
    return `/admin/resources?${query}`;
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Resources</h1>
        <p className="mt-2 text-muted-foreground">
          Manage approved listings, including inactive resources.
        </p>
      </div>
      <form
        className="flex flex-wrap items-end gap-3"
        action="/admin/resources"
      >
        <label className="min-w-0 flex-1 basis-60 text-sm font-medium">
          Search
          <input
            name="q"
            defaultValue={data.q}
            maxLength={200}
            placeholder="Name, provider, or address"
            className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3"
          />
        </label>
        <label className="min-w-0 flex-1 basis-52 text-sm font-medium">
          Category
          <select
            name="category"
            defaultValue={data.category}
            className="mt-2 min-h-11 w-full rounded-lg border bg-background px-3"
          >
            <option value="">All categories</option>
            {data.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <Button type="submit" className="min-h-11">
          Search
        </Button>
        <Link
          href="/admin/resources"
          className="inline-flex min-h-11 items-center px-2 text-sm underline"
        >
          Clear
        </Link>
      </form>
      {!target && error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {data.total} resources · Page {data.page} of {data.pages}
      </p>
      {data.rows.length ? (
        <div className="max-w-full overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-220 text-left text-sm">
            <caption className="sr-only">Approved resources</caption>
            <thead className="border-b bg-muted/50">
              <tr>
                {[
                  "Name",
                  "Categories",
                  "Address / Phone",
                  "Status",
                  "Created",
                  "Actions",
                ].map((label) => (
                  <th key={label} className="p-4 font-medium">
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="max-w-56 p-4 font-medium wrap-break-word">
                    {row.name}
                  </td>
                  <td className="max-w-48 p-4">{row.categories.join(", ")}</td>
                  <td className="max-w-64 p-4">
                    <p>{row.address}</p>
                    <p className="mt-2 text-muted-foreground">{row.phone}</p>
                  </td>
                  <td className="p-4">{row.active ? "Active" : "Inactive"}</td>
                  <td className="p-4 whitespace-nowrap">
                    {row.createdAt.slice(0, 10)}
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/admin/resources/${row.id}/edit`}
                        className="inline-flex min-h-11 items-center rounded-md border px-3"
                      >
                        Edit / Details
                      </Link>
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() => {
                          setError("");
                          setTarget({ row, action: "visibility" });
                        }}
                      >
                        {row.active ? "Deactivate" : "Activate"}
                      </Button>
                      <Button
                        variant="destructive"
                        className="min-h-11"
                        onClick={() => {
                          setError("");
                          setTarget({ row, action: "delete" });
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border bg-background p-8 text-center">
          No resources match these filters.
        </div>
      )}
      <nav
        aria-label="Resource pages"
        className="flex flex-wrap items-center justify-between gap-3"
      >
        {data.page > 1 ? (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border px-4"
            href={pageHref(data.page - 1)}
          >
            Previous
          </Link>
        ) : (
          <span />
        )}
        {data.page < data.pages && (
          <Link
            className="inline-flex min-h-11 items-center rounded-lg border px-4"
            href={pageHref(data.page + 1)}
          >
            Next
          </Link>
        )}
      </nav>
      {target && (
        <BuilderConfirm
          title={
            target.action === "delete"
              ? "Delete resource?"
              : target.row.active
                ? "Deactivate resource?"
                : "Activate resource?"
          }
          description={
            target.action === "delete"
              ? `Delete “${target.row.name}” permanently? Its original submission will be kept.`
              : `${target.row.active ? "Hide" : "Publish"} “${target.row.name}” in the public directory?`
          }
          pending={pending}
          destructive={target.action === "delete"}
          confirmLabel={
            target.action === "delete"
              ? "Delete resource"
              : target.row.active
                ? "Deactivate"
                : "Activate"
          }
          onConfirm={confirm}
          onClose={() => {
            if (!pending) setTarget(undefined);
          }}
        >
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </BuilderConfirm>
      )}
    </div>
  );
}
