import { getDb } from "@/lib/db";
import { readPrivateImage } from "@/lib/image-storage";
import { managementApi } from "@/modules/management/management-api";
import {
  checkId,
  ManagementError,
} from "@/modules/management/management-types";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return managementApi(async () => {
    const { id } = await params;
    checkId(id);
    const row = await getDb().resource.findUnique({
      where: { id },
      select: { imageKey: true },
    });
    if (!row?.imageKey) throw new ManagementError(404, "Image not found.");
    try {
      const image = await readPrivateImage(row.imageKey);
      return new Response(new Uint8Array(image.bytes), {
        headers: {
          "Content-Type": image.contentType,
          "X-Content-Type-Options": "nosniff",
          "Content-Security-Policy": "default-src 'none'; sandbox",
          "Content-Disposition": "inline",
        },
      });
    } catch {
      throw new ManagementError(503, "The resource image is unavailable.");
    }
  });
}
