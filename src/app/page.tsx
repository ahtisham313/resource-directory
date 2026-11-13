import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { HeartPulse, ArrowUpRight } from "lucide-react";
import {
  getDirectoryOptions,
  queryDirectory,
} from "@/modules/resources/directory-query";
import { DirectoryClient } from "@/modules/resources/components/directory-client";
import { directoryUrl } from "@/modules/resources/directory-types";

export const metadata = {
  title: "Healthcare Resource Directory",
  description:
    "Find healthcare practices, providers, and services. Search by name, category, or address and explore care near you.",
};

async function Directory({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const params = await searchParams;
  const [initial, options] = await Promise.all([
    queryDirectory(params),
    getDirectoryOptions(),
  ]);
  return (
    <>
      {options.surveyPath && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-teal-100 bg-teal-50/60 px-4 py-3 text-sm text-teal-900">
          <p>Help people find your practice.</p>
          <Link
            href={options.surveyPath}
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 rounded font-medium underline underline-offset-4 focus-visible:outline-2"
          >
            Submit provider information
            <ArrowUpRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      )}
      <DirectoryClient
        key={directoryUrl(initial.filters)}
        initial={initial}
        options={options}
      />
    </>
  );
}

export default function Home(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <div className="min-h-dvh flex-1 bg-slate-50/70 text-slate-900">
      <a
        href="#directory-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-lg focus:bg-white focus:p-3 focus:ring-2"
      >
        Skip to directory
      </a>
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-5 sm:px-7 lg:px-8">
          <Link
            href="/"
            prefetch={false}
            className="flex min-w-0 items-center gap-3 rounded focus-visible:outline-2"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-teal-800 text-white">
              <HeartPulse className="size-6" aria-hidden="true" />
            </span>
            <span className="text-sm font-semibold tracking-tight sm:text-base">
              Resource Directory
              <span className="mt-0.5 block text-xs font-normal tracking-normal text-slate-500">
                Healthcare & community services
              </span>
            </span>
          </Link>
          <nav aria-label="Public navigation">
            <Link
              href="/admin/login"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-lg px-2 text-sm text-slate-500 hover:text-teal-800 focus-visible:outline-2"
            >
              Admin sign in
            </Link>
          </nav>
        </div>
      </header>
      <main
        id="directory-main"
        className="mx-auto max-w-7xl px-4 pt-10 pb-12 sm:px-7 sm:pt-14 lg:px-8"
      >
        <div className="mb-8 max-w-2xl">
          <p className="mb-3 text-xs font-semibold tracking-widest text-teal-800 uppercase">
            Your care, your community
          </p>
          <h1 className="text-3xl leading-tight font-semibold tracking-tight sm:text-4xl">
            Find the care you’re looking for.
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-500">
            Explore healthcare practices, providers, and services. Find the
            information you need to take your next step.
          </p>
        </div>
        <Suspense
          fallback={
            <div
              role="status"
              className="rounded-2xl border bg-white p-8 text-sm text-slate-500"
            >
              Loading the healthcare directory…
            </div>
          }
        >
          <Directory {...props} />
        </Suspense>
      </main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-7 text-xs leading-6 text-slate-500 sm:px-7 lg:px-8">
          Resource Directory · Healthcare & community services
        </div>
      </footer>
    </div>
  );
}
