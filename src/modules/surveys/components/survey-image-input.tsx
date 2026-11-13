"use client";

import Image from "next/image";
import { useEffect, useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  defaultProviderImage,
  imageMetadataError,
  imageMimeTypes,
} from "../image-rules";
import type { SurveyFieldDefinition } from "../survey-snapshot";

export function SurveyImageInput({
  field,
  disabled,
  available,
  describedBy,
  error,
  onChange,
}: {
  field: SurveyFieldDefinition;
  disabled: boolean;
  available: boolean;
  describedBy?: string;
  error?: string;
  onChange: (file: File | undefined, error?: string) => void;
}) {
  const [preview, setPreview] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );
  return (
    <div className="space-y-3">
      <Image
        src={preview ?? defaultProviderImage}
        alt={
          preview ? "Selected provider image preview" : "Default provider image"
        }
        width={160}
        height={120}
        unoptimized={Boolean(preview)}
        className="h-30 w-40 rounded-lg border object-cover"
      />
      <input
        ref={input}
        id={`input-${field.fieldKey}`}
        name={field.fieldKey}
        type="file"
        accept={imageMimeTypes
          .filter(
            (type) =>
              !field.validationRules.mimeTypes ||
              field.validationRules.mimeTypes.includes(type),
          )
          .join(",")}
        disabled={disabled || !available}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy}
        className="block min-h-11 w-full min-w-0 rounded-lg border p-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-muted file:px-3 file:py-2 focus-visible:outline-2 focus-visible:outline-ring disabled:opacity-60"
        onChange={(event) => {
          const file = event.target.files?.[0];
          const message = file ? imageMetadataError(file, field) : null;
          if (message) {
            event.target.value = "";
            setPreview(undefined);
            onChange(undefined, message);
            return;
          }
          setPreview(file ? URL.createObjectURL(file) : undefined);
          onChange(file);
        }}
      />
      {!available && (
        <p className="text-sm text-muted-foreground">
          Image uploads are currently unavailable. You can submit without an
          image.
        </p>
      )}
      {preview && (
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={disabled}
          onClick={() => {
            if (input.current) input.current.value = "";
            setPreview(undefined);
            onChange(undefined);
          }}
        >
          Remove image
        </Button>
      )}
    </div>
  );
}
