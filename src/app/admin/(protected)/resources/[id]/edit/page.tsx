import { notFound } from "next/navigation";
import { requireAdminPage } from "@/modules/auth/page-access";
import { ManagementError } from "@/modules/management/management-types";
import { getResourceEditor } from "@/modules/resources/resource-management";
import { ResourceEditor } from "@/modules/resources/components/resource-editor";
import { isImageStorageConfigured } from "@/lib/image-storage";
export const metadata = { title: "Edit resource" };
export default async function EditResourcePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdminPage();
  let data;
  try {
    data = await getResourceEditor((await params).id);
  } catch (error) {
    if (error instanceof ManagementError && error.status === 404) notFound();
    throw error;
  }
  return (
    <ResourceEditor data={data} uploadsAvailable={isImageStorageConfigured()} />
  );
}
