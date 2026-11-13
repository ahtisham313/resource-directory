"use client";

import Image from "next/image";
import { useState } from "react";
import { defaultProviderImage } from "@/modules/surveys/image-rules";

export function ResourceImage({
  src,
  name,
  className = "",
}: {
  src: string;
  name: string;
  className?: string;
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const source = failedSource === src ? defaultProviderImage : src;
  return (
    <Image
      src={source}
      alt={
        source === defaultProviderImage
          ? "Default healthcare provider image"
          : name
      }
      width={640}
      height={420}
      unoptimized
      className={`w-full object-contain ${className}`}
      onError={() => setFailedSource(src)}
    />
  );
}
