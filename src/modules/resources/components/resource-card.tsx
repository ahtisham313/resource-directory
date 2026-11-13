import { MapPin, Phone, Globe, Clock3, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PublicResource } from "../directory-types";
import { ResourceImage } from "./resource-image";

export function ResourceCard({
  resource,
  view,
  locationEnabled,
  onReadMore,
}: {
  resource: PublicResource;
  view: "cards" | "list";
  locationEnabled: boolean;
  onReadMore: (button: HTMLButtonElement) => void;
}) {
  const telephone = resource.phone.replace(/[^\d+]/g, "");
  return (
    <article
      data-resource-id={resource.id}
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm",
        view === "list" && "md:flex-row",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-center border-b border-slate-100 bg-teal-50/50 p-5",
          view === "list" &&
            "md:w-52 md:shrink-0 md:border-r md:border-b-0 lg:w-64",
        )}
      >
        <ResourceImage
          src={resource.imageUrl}
          name={resource.name}
          className="h-40 rounded-lg"
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-medium",
              resource.openState === "Open"
                ? "bg-emerald-50 text-emerald-800"
                : "bg-slate-100 text-slate-600",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "size-1.5 rounded-full",
                resource.openState === "Open"
                  ? "bg-emerald-600"
                  : "bg-slate-400",
              )}
            />
            {resource.openState}
          </span>
          {locationEnabled && (
            <span className="font-medium text-teal-800">
              {resource.distanceMiles === null
                ? "Distance unavailable"
                : `${resource.distanceMiles.toFixed(1)} mi away`}
            </span>
          )}
        </div>
        <h2 className="mt-4 text-xl leading-7 font-semibold break-words tracking-tight text-slate-950">
          {resource.name}
        </h2>
        {resource.providerName && resource.providerName !== resource.name && (
          <p className="mt-1 text-sm break-words text-slate-500">
            {resource.providerName}
          </p>
        )}
        <div className="mt-3 flex flex-wrap gap-1.5" aria-label="Categories">
          {resource.categories.map((category) => (
            <span
              key={category}
              className="rounded-md bg-teal-50 px-2 py-1 text-xs leading-5 font-medium text-teal-800"
            >
              {category}
            </span>
          ))}
        </div>
        <p className="mt-4 line-clamp-3 text-sm leading-6 break-words text-slate-600">
          {resource.description || "No specialty or description provided."}
        </p>
        <dl
          className={cn(
            "mt-5 space-y-3 text-sm leading-6",
            view === "list" &&
              "lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-3 lg:space-y-0",
          )}
        >
          <div className="flex min-w-0 items-start gap-2.5">
            <MapPin
              className="mt-1 size-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="sr-only">Address</dt>
              <dd className="break-words text-slate-700">{resource.address}</dd>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-2.5">
            <Phone
              className="mt-1 size-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="sr-only">Phone</dt>
              <dd className="break-words">
                {telephone ? (
                  <a
                    href={`tel:${telephone}`}
                    className="rounded text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2"
                  >
                    {resource.phone}
                  </a>
                ) : (
                  "Phone unavailable"
                )}
              </dd>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-2.5">
            <Globe
              className="mt-1 size-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="sr-only">Website</dt>
              <dd className="break-words">
                {resource.website ? (
                  <a
                    href={resource.website}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded text-teal-800 underline-offset-4 hover:underline focus-visible:outline-2"
                  >
                    {new URL(resource.website).hostname}
                    <span className="sr-only"> (opens a new tab)</span>
                  </a>
                ) : (
                  "Website not provided"
                )}
              </dd>
            </div>
          </div>
          <div className="flex min-w-0 items-start gap-2.5">
            <Clock3
              className="mt-1 size-4 shrink-0 text-slate-400"
              aria-hidden="true"
            />
            <div className="min-w-0">
              <dt className="sr-only">Office hours</dt>
              <dd className="break-words text-slate-700">
                {resource.officeHours}
                <span className="block text-xs text-slate-500">
                  {resource.timeZone}
                </span>
              </dd>
            </div>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Ages served</dt>
            <dd className="break-words text-slate-700">
              {resource.ageRange.join(", ") || "Not provided"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Average waiting time</dt>
            <dd className="break-words text-slate-700">
              {resource.averageWait || "Not provided"}
            </dd>
          </div>
        </dl>
        <div className="mt-auto pt-6">
          <Button
            type="button"
            variant="outline"
            onClick={(event) => onReadMore(event.currentTarget)}
            className="min-h-11 w-full border-teal-200 text-teal-900 hover:bg-teal-50"
          >
            Read more <ArrowUpRight aria-hidden="true" />
            <span className="sr-only"> about {resource.name}</span>
          </Button>
        </div>
      </div>
    </article>
  );
}
