import type { Metadata } from "next";
import { HeartPulse, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "You're offline | Resource Directory",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border bg-background p-6 text-center sm:p-10">
        <p className="flex items-center justify-center gap-2 text-sm font-semibold">
          <HeartPulse className="size-5" aria-hidden="true" />
          Resource Directory
        </p>
        <WifiOff
          className="mx-auto mt-8 size-10 text-muted-foreground"
          aria-hidden="true"
        />
        <h1 className="mt-5 text-3xl font-semibold tracking-tight">
          You&apos;re offline
        </h1>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">
          Check your internet connection and try again. An internet connection
          is needed to load current resources or send a survey.
        </p>
        <form action="/" method="get" className="mt-7">
          <Button type="submit" className="min-h-11 px-5">
            Try again
          </Button>
        </form>
      </div>
    </main>
  );
}
