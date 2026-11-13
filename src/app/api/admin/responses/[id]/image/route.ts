import { readPrivateImage } from "@/lib/image-storage";
import { reviewApi } from "@/modules/responses/review-api";
import { getResponseDetails } from "@/modules/responses/response-data";
import { ReviewError } from "@/modules/responses/review-types";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return reviewApi(async () => {
    const response = await getResponseDetails((await params).id);
    if (!response.uploadedImageKey)
      throw new ReviewError(404, "This response has no uploaded image.");
    try {
      const image = await readPrivateImage(response.uploadedImageKey);
      return new Response(new Uint8Array(image.bytes), {
        headers: {
          "Content-Type": image.contentType,
          "X-Content-Type-Options": "nosniff",
          "Content-Disposition": "inline",
          "Content-Security-Policy": "default-src 'none'; sandbox",
        },
      });
    } catch {
      throw new ReviewError(503, "The submitted image is unavailable.");
    }
  });
}
