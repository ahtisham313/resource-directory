"use client";
import Image from "next/image";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { SurveyRenderer } from "@/modules/surveys/components/survey-renderer";
import {
  SurveyAnswerError,
  validateSurveyAnswers,
} from "@/modules/surveys/answer-validation";
import { getImageField } from "@/modules/surveys/survey-definition";
import { defaultProviderImage } from "@/modules/surveys/image-rules";
import {
  managementRequest,
  ManagementRequestError,
} from "@/modules/management/client-request";
import type { getResourceEditor } from "../resource-management";
type Data = Awaited<ReturnType<typeof getResourceEditor>>;
export function ResourceEditor({
  data,
  uploadsAvailable,
}: {
  data: Data;
  uploadsAvailable: boolean;
}) {
  const router = useRouter();
  const [answers, setAnswers] = useState(data.answers),
    [file, setFile] = useState<File>();
  const [fileError, setFileError] = useState("");
  const [removeImage, setRemoveImage] = useState(false),
    [manual, setManual] = useState(false);
  const [latitude, setLatitude] = useState(String(data.latitude ?? "")),
    [longitude, setLongitude] = useState(String(data.longitude ?? ""));
  const [errors, setErrors] = useState<Record<string, string>>({}),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const snapshot = {
    ...data.snapshot,
    sections: data.snapshot.sections
      .map((section) => ({
        ...section,
        fields: section.fields.filter(
          (field) =>
            ![
              "TERMS_ACKNOWLEDGEMENT",
              "DISPLAY_TEXT",
              "SECTION_HEADING",
            ].includes(field.fieldType),
        ),
      }))
      .filter((section) => section.fields.length),
  };
  async function save(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    setMessage("");
    try {
      validateSurveyAnswers(
        data.snapshot,
        answers,
        Boolean(file || (data.hasImage && !removeImage)),
      );
    } catch (error) {
      setErrors(error instanceof SurveyAnswerError ? error.fieldErrors : {});
      setMessage("Check the highlighted answers.");
      return;
    }
    if (fileError) {
      setMessage(fileError);
      return;
    }
    if (manual && (!latitude.trim() || !longitude.trim())) {
      setMessage("Enter both latitude and longitude.");
      return;
    }
    const form = new FormData();
    form.set(
      "data",
      JSON.stringify({
        answers,
        revision: data.revision,
        removeImage,
        ...(manual
          ? {
              coordinates: {
                latitude: Number(latitude),
                longitude: Number(longitude),
              },
            }
          : {}),
      }),
    );
    if (file) form.set("image", file);
    setPending(true);
    setErrors({});
    try {
      await managementRequest(`/api/admin/resources/${data.id}`, "PUT", form);
      router.push("/admin/resources");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
      if (error instanceof ManagementRequestError) setErrors(error.fieldErrors);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="space-y-6">
      <Link
        href="/admin/resources"
        className="inline-flex min-h-11 items-center text-sm underline"
      >
        Back to resources
      </Link>
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Edit resource</h1>
        <p className="mt-2 wrap-break-word text-muted-foreground">
          {data.name}
        </p>
        <p className="mt-3 text-sm text-muted-foreground">
          Changes update the public listing. The original submission and
          acknowledgement are kept.
        </p>
      </div>
      <form onSubmit={save} noValidate className="space-y-6">
        {data.hasImage && (
          <section className="space-y-3 rounded-xl border bg-background p-5">
            <h2 className="font-semibold">Current image</h2>
            <Image
              src={`/api/admin/resources/${data.id}/image`}
              alt="Current resource image"
              width={200}
              height={150}
              unoptimized
              className="h-36 w-48 rounded-lg object-cover"
              onError={(event) => {
                event.currentTarget.onerror = null;
                event.currentTarget.src = defaultProviderImage;
              }}
            />
            <label className="flex min-h-11 items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={removeImage}
                disabled={pending}
                onChange={(event) => setRemoveImage(event.target.checked)}
              />
              Remove current image (use default)
            </label>
            <p className="text-sm text-muted-foreground">
              Keep this image by leaving the upload empty. Selecting a file
              replaces it.
            </p>
          </section>
        )}
        <SurveyRenderer
          snapshot={snapshot}
          answers={answers}
          errors={errors}
          disabled={pending}
          uploadsAvailable={uploadsAvailable}
          onChange={(key, answer) => {
            setAnswers((previous) => ({ ...previous, [key]: answer }));
            setErrors((previous) => ({ ...previous, [key]: "" }));
          }}
          onFileChange={(next, error) => {
            setFile(next);
            setFileError(error ?? "");
            const key = getImageField(data.snapshot)?.fieldKey;
            if (key)
              setErrors((previous) => ({ ...previous, [key]: error ?? "" }));
          }}
        />
        <section className="space-y-4 rounded-xl border bg-background p-5">
          <h2 className="font-semibold">Location coordinates</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Unchanged addresses keep their coordinates. Changed addresses use an
            existing match or the configured geocoder. If no match is available,
            enter verified coordinates.
          </p>
          <label className="flex min-h-11 items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={manual}
              disabled={pending}
              onChange={(event) => setManual(event.target.checked)}
            />
            Enter coordinates manually
          </label>
          {manual && (
            <div className="grid min-w-0 gap-4 sm:grid-cols-2">
              {[
                {
                  label: "Latitude",
                  value: latitude,
                  set: setLatitude,
                  min: -90,
                  max: 90,
                },
                {
                  label: "Longitude",
                  value: longitude,
                  set: setLongitude,
                  min: -180,
                  max: 180,
                },
              ].map((item) => (
                <label key={item.label} className="min-w-0 text-sm">
                  {item.label}
                  <input
                    type="number"
                    step="any"
                    min={item.min}
                    max={item.max}
                    value={item.value}
                    onChange={(event) => item.set(event.target.value)}
                    disabled={pending}
                    className="mt-2 min-h-11 w-full rounded-lg border px-3"
                  />
                </label>
              ))}
            </div>
          )}
        </section>
        {message && (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        )}
        <Button type="submit" disabled={pending} className="min-h-11">
          {pending ? "Saving…" : "Save resource"}
        </Button>
      </form>
    </div>
  );
}
