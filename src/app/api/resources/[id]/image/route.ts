import { getDb } from "@/lib/db";
import { readPrivateImage } from "@/lib/image-storage";
import { surveyIdSchema } from "@/modules/surveys/survey-definition";
import { directoryApi } from "@/modules/resources/directory-api";
import { DirectoryError } from "@/modules/resources/directory-types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return directoryApi(async () => {
    const { id } = await params;
    if (!surveyIdSchema.safeParse(id).success)
      throw new DirectoryError(404, "Image not found.");
    const resource = await getDb().resource.findFirst({
      where: { id, active: true },
      select: { imageKey: true },
    });
    if (!resource?.imageKey) throw new DirectoryError(404, "Image not found.");
    let image;
    try {
      image = await readPrivateImage(resource.imageKey);
    } catch {
      throw new DirectoryError(503, "Provider image is unavailable.");
    }
    if (
      !(await getDb().resource.findFirst({
        where: { id, active: true, imageKey: resource.imageKey },
        select: { id: true },
      }))
    )
      throw new DirectoryError(404, "Image not found.");
    return new Response(new Uint8Array(image.bytes), {
      headers: {
        "Content-Type": image.contentType,
        "Content-Disposition": "inline",
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  });
}
