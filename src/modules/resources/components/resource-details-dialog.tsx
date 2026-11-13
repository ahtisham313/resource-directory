"use client";

import { useEffect, useRef, useState } from "react";
import { X, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { resourceDetailSchema, type ResourceDetail } from "../directory-types";
import { ResourceImage } from "./resource-image";

export function ResourceDetailsDialog({
  id,
  name,
  onClose,
}: {
  id: string;
  name: string;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [details, setDetails] = useState<ResourceDetail | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    dialog.current?.showModal();
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/resources/${encodeURIComponent(id)}`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok)
          throw new Error(
            response.status === 404
              ? "This resource is no longer available."
              : "Provider details could not be loaded. Please try again.",
          );
        const result = resourceDetailSchema.parse(await response.json());
        if (!controller.signal.aborted) setDetails(result);
      } catch (error) {
        if (!controller.signal.aborted)
          setError(
            error instanceof Error
              ? error.message
              : "Provider details could not be loaded.",
          );
      }
    }
    void load();
    return () => controller.abort();
  }, [id, retry]);
  return (
    <dialog
      ref={dialog}
      onClose={onClose}
      aria-labelledby="resource-detail-title"
      aria-describedby="resource-detail-intro"
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-0 text-slate-900 shadow-2xl backdrop:bg-slate-950/50"
    >
      <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b bg-white px-4 py-5 sm:px-7">
        <div className="min-w-0">
          <h2
            id="resource-detail-title"
            className="text-xl font-semibold break-words"
          >
            {details?.resource.name ?? name}
          </h2>
          <p id="resource-detail-intro" className="mt-1 text-sm text-slate-500">
            Provider information
          </p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="size-11 shrink-0"
          aria-label="Close provider details"
          onClick={() => dialog.current?.close()}
        >
          <X aria-hidden="true" />
        </Button>
      </div>
      <div className="space-y-6 p-4 sm:p-7">
        {error ? (
          <div role="alert">
            <p className="text-sm leading-7">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11"
              onClick={() => {
                setError("");
                setRetry((value) => value + 1);
              }}
            >
              Try again
            </Button>
          </div>
        ) : !details ? (
          <p role="status" className="flex items-center gap-3 py-8 text-sm">
            <LoaderCircle className="size-5 animate-spin" aria-hidden="true" />
            Loading provider details…
          </p>
        ) : (
          <>
            <div className="rounded-xl bg-teal-50/60 p-4 text-sm leading-7">
              <p className="font-medium">
                {details.resource.categories.join(" · ")}
              </p>
              <p className="mt-1 break-words">{details.resource.address}</p>
              <p className="mt-1">
                {details.resource.openState} · {details.resource.officeHours}
              </p>
              <p className="text-xs text-slate-500">
                {details.resource.timeZone}
              </p>
            </div>
            {details.sections.map((section, index) => (
              <section
                key={index}
                aria-labelledby={`public-section-${index}`}
                className="min-w-0 rounded-xl border p-4 sm:p-5"
              >
                <h3
                  id={`public-section-${index}`}
                  className="border-b pb-3 text-base font-semibold"
                >
                  {section.title}
                </h3>
                <dl className="mt-4 space-y-5">
                  {section.fields.map((field) => (
                    <div key={field.key} data-public-answer={field.key}>
                      <dt className="text-sm font-medium">{field.label}</dt>
                      <dd className="mt-1.5 text-sm leading-7 whitespace-pre-wrap break-words text-slate-600">
                        {field.content && (
                          <p className="mb-2">{field.content}</p>
                        )}
                        {field.image ? (
                          <ResourceImage
                            src={details.resource.imageUrl}
                            name={details.resource.name}
                            className="max-h-72 max-w-md rounded-lg border bg-slate-50"
                          />
                        ) : field.url ? (
                          <a
                            href={field.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-teal-800 underline underline-offset-4 focus-visible:outline-2"
                          >
                            {field.text}
                            <span className="sr-only"> (opens a new tab)</span>
                          </a>
                        ) : (
                          field.text
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </>
        )}
      </div>
    </dialog>
  );
}
