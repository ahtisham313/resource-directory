import { requireAdminPage } from "@/modules/auth/page-access";
import { listManagedResources } from "@/modules/resources/resource-management";
import { ResourceManager } from "@/modules/resources/components/resource-manager";

export const metadata = { title: "Resources" };

export default async function ResourcesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdminPage();
  const input = await searchParams;
  return (
    <ResourceManager
      data={await listManagedResources({
        q: typeof input.q === "string" ? input.q : undefined,
        category:
          typeof input.category === "string" ? input.category : undefined,
        page: typeof input.page === "string" ? input.page : undefined,
      })}
    />
  );
}
