"use client";
import { Button } from "@/components/ui/button";
export default function Error({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border bg-background p-6">
      <h1 className="text-xl font-semibold">Surveys could not be loaded</h1>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">
        Please try again. Your saved drafts and published versions are
        unchanged.
      </p>
      <Button
        type="button"
        variant="outline"
        className="mt-4 min-h-11"
        onClick={retry}
      >
        Try again
      </Button>
    </div>
  );
}
