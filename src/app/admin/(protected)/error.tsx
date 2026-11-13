"use client";
import { Button } from "@/components/ui/button";
export default function AdminError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="space-y-4 rounded-xl border bg-background p-6">
      <h2 className="text-xl font-semibold">Unable to load this admin page</h2>
      <p className="text-sm text-muted-foreground">
        The data could not be loaded. Please try again.
      </p>
      <Button onClick={retry} className="min-h-11">
        Try again
      </Button>
    </div>
  );
}
