"use client";
import { Button } from "@/components/ui/button";
export default function ResponsesError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="rounded-xl border bg-background p-6">
      <h2 className="text-xl font-semibold">Unable to load responses</h2>
      <p className="mt-3 text-sm text-muted-foreground">Please try again.</p>
      <Button className="mt-4 min-h-11" onClick={retry}>
        Try again
      </Button>
    </div>
  );
}
