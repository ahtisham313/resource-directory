"use client";

import { Button } from "@/components/ui/button";

export default function Error({ retry }: { retry: () => void }) {
  return (
    <main className="mx-auto w-full max-w-2xl p-6 py-20">
      <h1 className="text-2xl font-semibold">
        The directory is temporarily unavailable
      </h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        We couldn’t load the requested information. Please try again.
      </p>
      <Button type="button" onClick={retry} className="mt-5 min-h-11">
        Try again
      </Button>
    </main>
  );
}
