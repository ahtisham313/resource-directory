"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent,
} from "react";
import {
  Search,
  LocateFixed,
  LayoutGrid,
  List,
  LoaderCircle,
  ArrowLeft,
  ArrowRight,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { trackCategorySelection } from "@/modules/analytics/public-tracking";
import {
  directoryFiltersSchema,
  directoryResultSchema,
  directoryUrl,
  visitorCoordinatesSchema,
  type DirectoryResult,
  type DirectoryOptions,
  type DirectoryFilters,
  type VisitorCoordinates,
} from "../directory-types";
import { ResourceCard } from "./resource-card";
import { ResourceDetailsDialog } from "./resource-details-dialog";

const controlClass =
  "min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-teal-600";

export function DirectoryClient({
  initial,
  options,
}: {
  initial: DirectoryResult;
  options: DirectoryOptions;
}) {
  const [result, setResult] = useState(initial);
  const [filters, setFilters] = useState(initial.filters);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [locationMessage, setLocationMessage] = useState("");
  const [locating, setLocating] = useState(false);
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [selected, setSelected] = useState<{ id: string; name: string } | null>(
    null,
  );
  const coordinates = useRef<VisitorCoordinates | null>(null);
  const currentFilters = useRef(initial.filters);
  const request = useRef<AbortController | null>(null);
  const geoRequest = useRef(0);
  const opener = useRef<HTMLButtonElement | null>(null);

  const load = useCallback(
    async (
      next: DirectoryFilters,
      position: VisitorCoordinates | null,
      writeHistory = true,
    ) => {
      if (!position && ["nearest", "farthest"].includes(next.sort))
        next = { ...next, sort: "daily" };
      request.current?.abort();
      const controller = new AbortController();
      request.current = controller;
      currentFilters.current = next;
      setFilters(next);
      setLoading(true);
      setError("");
      if (writeHistory) window.history.pushState(null, "", directoryUrl(next));
      try {
        const query = new URLSearchParams({
          search: next.search,
          category: next.category,
          sort: next.sort,
          page: String(next.page),
          view: next.view,
        });
        const headers: Record<string, string> = {};
        if (position) {
          headers["x-directory-latitude"] = String(position.latitude);
          headers["x-directory-longitude"] = String(position.longitude);
        }
        const response = await fetch(`/api/resources?${query}`, {
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Directory request failed");
        const data = directoryResultSchema.parse(await response.json());
        if (controller.signal.aborted) return;
        // A view toggle made while the request was loading must not be overwritten.
        const settled = { ...data.filters, view: currentFilters.current.view };
        currentFilters.current = settled;
        setFilters(settled);
        setResult({ ...data, filters: settled });
        window.history.replaceState(null, "", directoryUrl(settled));
      } catch {
        if (!controller.signal.aborted)
          setError("The directory could not be loaded. Please try again.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    const back = () => {
      void load(
        directoryFiltersSchema.parse(
          Object.fromEntries(new URLSearchParams(window.location.search)),
        ),
        coordinates.current,
        false,
      );
    };
    const refresh = () => {
      if (document.visibilityState === "visible")
        void load(currentFilters.current, coordinates.current, false);
    };
    window.addEventListener("popstate", back);
    document.addEventListener("visibilitychange", refresh);
    const timer = window.setInterval(refresh, 60000);
    return () => {
      window.removeEventListener("popstate", back);
      document.removeEventListener("visibilitychange", refresh);
      window.clearInterval(timer);
      request.current?.abort();
      geoRequest.current = -1;
    };
  }, [load]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void load(
      {
        ...filters,
        search: String(data.get("search") ?? "").trim(),
        category: String(data.get("category") ?? ""),
        sort: directoryFiltersSchema.shape.sort.parse(data.get("sort")),
        page: 1,
      },
      coordinates.current,
    );
  }
  function changeView(view: DirectoryFilters["view"]) {
    const next = { ...currentFilters.current, view };
    currentFilters.current = next;
    setFilters(next);
    window.history.replaceState(null, "", directoryUrl(next));
  }
  function myLocation() {
    const ticket = ++geoRequest.current;
    if (!navigator.geolocation) {
      if (coordinates.current) clearLocation();
      setLocationMessage(
        "This browser does not support location. You can still browse all resources.",
      );
      return;
    }
    setLocating(true);
    setLocationMessage("Waiting for location permission…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (ticket !== geoRequest.current) return;
        const parsed = visitorCoordinatesSchema.safeParse({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        setLocating(false);
        if (!parsed.success) {
          if (coordinates.current) clearLocation();
          setLocationMessage(
            "Your location could not be determined. Please try again.",
          );
          return;
        }
        coordinates.current = parsed.data;
        setLocationEnabled(true);
        setLocationMessage("Location enabled. Distances are shown in miles.");
        void load(
          { ...currentFilters.current, sort: "nearest", page: 1 },
          coordinates.current,
        );
      },
      (failure) => {
        if (ticket !== geoRequest.current) return;
        setLocating(false);
        if (coordinates.current) clearLocation();
        setLocationMessage(
          failure.code === 1
            ? "Location access was denied. You can still search and browse all resources."
            : failure.code === 3
              ? "Finding your location timed out. Please try again."
              : "Your location could not be determined. Please try again.",
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }
  function clearLocation() {
    geoRequest.current++;
    coordinates.current = null;
    setLocating(false);
    setLocationEnabled(false);
    setLocationMessage("Location turned off.");
    void load(
      {
        ...currentFilters.current,
        sort: ["nearest", "farthest"].includes(currentFilters.current.sort)
          ? "daily"
          : currentFilters.current.sort,
        page: 1,
      },
      null,
    );
  }
  function pageClick(event: MouseEvent<HTMLAnchorElement>, page: number) {
    if (
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey ||
      event.button !== 0
    )
      return;
    event.preventDefault();
    void load({ ...currentFilters.current, page }, coordinates.current);
    document
      .getElementById("directory-results")
      ?.scrollIntoView({ block: "start" });
  }

  return (
    <>
      <section
        aria-label="Find a healthcare resource"
        className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"
      >
        <form
          key={`${filters.search}:${filters.category}:${filters.sort}`}
          action="/"
          method="get"
          onSubmit={submit}
          className="grid min-w-0 gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.65fr)_minmax(0,0.55fr)_auto] lg:items-end"
        >
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="directory-search"
              className="text-sm font-medium text-slate-700"
            >
              Search resources
            </label>
            <div className="relative">
              <Search
                className="absolute top-3.5 left-3 size-4 text-slate-400"
                aria-hidden="true"
              />
              <input
                id="directory-search"
                name="search"
                defaultValue={filters.search}
                maxLength={100}
                placeholder="Name, category, or address"
                className={`${controlClass} pl-9`}
              />
            </div>
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="directory-category"
              className="text-sm font-medium text-slate-700"
            >
              Category
            </label>
            <select
              id="directory-category"
              name="category"
              defaultValue={filters.category}
              onChange={(event) => {
                const category = options.categories.find(
                  (category) => category.slug === event.currentTarget.value,
                );
                const changed =
                  category && category.slug !== currentFilters.current.category;
                event.currentTarget.form?.requestSubmit();
                if (changed) trackCategorySelection(category);
              }}
              className={controlClass}
            >
              <option value="">All Categories</option>
              {options.categories.map((category) => (
                <option key={category.slug} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-0 space-y-2">
            <label
              htmlFor="directory-sort"
              className="text-sm font-medium text-slate-700"
            >
              Sort by
            </label>
            <select
              id="directory-sort"
              name="sort"
              defaultValue={filters.sort}
              onChange={(event) => event.currentTarget.form?.requestSubmit()}
              className={controlClass}
            >
              <option value="daily">Daily Random</option>
              <option value="az">Name: A–Z</option>
              <option value="za">Name: Z–A</option>
              <option value="nearest" disabled={!locationEnabled}>
                Nearest first
              </option>
              <option value="farthest" disabled={!locationEnabled}>
                Farthest first
              </option>
            </select>
          </div>
          {filters.view === "list" && (
            <input type="hidden" name="view" value="list" />
          )}
          <Button
            type="submit"
            className="min-h-11 bg-teal-800 px-5 text-white hover:bg-teal-900"
          >
            <Search aria-hidden="true" />
            Search
          </Button>
        </form>
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-11 border-slate-200 text-slate-700"
              disabled={locating}
              onClick={myLocation}
            >
              {locating ? (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              ) : (
                <LocateFixed aria-hidden="true" />
              )}
              {locating ? "Locating…" : "My Location"}
            </Button>
            {(locationEnabled || locating) && (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 text-slate-600"
                onClick={clearLocation}
              >
                <X aria-hidden="true" />
                Turn off location
              </Button>
            )}
          </div>
          <div
            role="group"
            aria-label="Directory view"
            className="flex gap-1 rounded-lg border border-slate-200 p-1"
          >
            <Button
              type="button"
              variant="ghost"
              aria-pressed={filters.view === "cards"}
              onClick={() => changeView("cards")}
              className={cn(
                "min-h-11 text-slate-500",
                filters.view === "cards" && "bg-teal-50 text-teal-900",
              )}
            >
              <LayoutGrid aria-hidden="true" />
              Cards
            </Button>
            <Button
              type="button"
              variant="ghost"
              aria-pressed={filters.view === "list"}
              onClick={() => changeView("list")}
              className={cn(
                "min-h-11 text-slate-500",
                filters.view === "list" && "bg-teal-50 text-teal-900",
              )}
            >
              <List aria-hidden="true" />
              List
            </Button>
          </div>
        </div>
        {locationMessage && (
          <p role="status" className="mt-3 text-sm leading-6 text-slate-600">
            {locationMessage}
          </p>
        )}
      </section>
      <section
        id="directory-results"
        aria-label="Healthcare resources"
        aria-busy={loading}
        className="mt-8 scroll-mt-5"
      >
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p role="status" className="text-sm text-slate-600">
            {loading
              ? "Loading resources…"
              : `${result.total} ${result.total === 1 ? "resource" : "resources"} found`}
          </p>
          <p className="text-xs text-slate-400">
            {filters.sort === "daily"
              ? "A fresh order each day · UTC"
              : "Healthcare Resource Directory"}
          </p>
        </div>
        {error ? (
          <div role="alert" className="rounded-2xl border bg-white p-6">
            <p className="text-sm leading-7">{error}</p>
            <Button
              type="button"
              variant="outline"
              className="mt-4 min-h-11"
              onClick={() =>
                void load(currentFilters.current, coordinates.current, false)
              }
            >
              Try again
            </Button>
          </div>
        ) : result.resources.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center">
            <SlidersHorizontal
              className="mx-auto mb-4 size-7 text-teal-700"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold">No resources found</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-7 text-slate-500">
              Try another name, category, or address, or clear your filters to
              browse all available resources.
            </p>
            <Button
              type="button"
              variant="outline"
              className="mt-5 min-h-11"
              onClick={() =>
                void load(
                  { ...filters, search: "", category: "", page: 1 },
                  coordinates.current,
                )
              }
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <div
            className={cn(
              "grid gap-5",
              filters.view === "cards" && "md:grid-cols-2 xl:grid-cols-3",
              loading && "opacity-60",
            )}
          >
            {result.resources.map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                view={filters.view}
                locationEnabled={result.locationEnabled}
                onReadMore={(button) => {
                  opener.current = button;
                  setSelected({ id: resource.id, name: resource.name });
                }}
              />
            ))}
          </div>
        )}
        <nav
          aria-label="Directory pages"
          className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-200 pt-5 text-sm"
        >
          <p className="text-slate-500">
            Page {result.filters.page} of {result.pages}
          </p>
          <div className="flex flex-wrap gap-2">
            {result.filters.page > 1 && (
              <a
                href={directoryUrl({
                  ...filters,
                  page: result.filters.page - 1,
                })}
                onClick={(event) => pageClick(event, result.filters.page - 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 text-slate-700 focus-visible:outline-2"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                Previous
              </a>
            )}
            {result.filters.page < result.pages && (
              <a
                href={directoryUrl({
                  ...filters,
                  page: result.filters.page + 1,
                })}
                onClick={(event) => pageClick(event, result.filters.page + 1)}
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border bg-white px-4 text-slate-700 focus-visible:outline-2"
              >
                Next
                <ArrowRight className="size-4" aria-hidden="true" />
              </a>
            )}
          </div>
        </nav>
      </section>
      {selected && (
        <ResourceDetailsDialog
          key={selected.id}
          id={selected.id}
          name={selected.name}
          onClose={() => {
            setSelected(null);
            opener.current?.focus();
          }}
        />
      )}
    </>
  );
}
