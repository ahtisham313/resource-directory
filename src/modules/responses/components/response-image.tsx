"use client";
import Image from "next/image";
import { useState } from "react";
import { defaultProviderImage } from "@/modules/surveys/image-rules";

export function ResponseImage({
  id,
  hasImage,
  available,
}: {
  id: string;
  hasImage: boolean;
  available: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const showPrivateImage = hasImage && available && !failed;
  return (
    <div className="space-y-2">
      <Image
        src={
          showPrivateImage
            ? `/api/admin/responses/${id}/image`
            : defaultProviderImage
        }
        unoptimized
        width={480}
        height={360}
        alt={
          showPrivateImage
            ? "Submitted provider image"
            : "Default provider image"
        }
        className="h-auto max-h-80 w-full max-w-md rounded-lg border object-contain"
        onError={() => setFailed(true)}
      />
      {hasImage && !showPrivateImage && (
        <p className="text-sm text-muted-foreground">
          The submitted image is unavailable. Showing the default image.
        </p>
      )}
    </div>
  );
}
