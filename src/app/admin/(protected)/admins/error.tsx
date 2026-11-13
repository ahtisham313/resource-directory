"use client";
import { Button } from "@/components/ui/button";
export default function AdminsError({ retry }: { retry: () => void }) {
  return (
    <div role="alert" className="space-y-4 rounded-xl border bg-background p-6">
      <h2 className="text-xl font-semibold">Unable to load administrators</h2>
      <p>Please try again.</p>
      <Button onClick={retry}>Try again</Button>
    </div>
  );
}
