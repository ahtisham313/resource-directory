import { HeartPulse } from "lucide-react";

export function AdminBrand() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <HeartPulse className="size-5" aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-sm leading-snug font-semibold">Resource Directory</p>
        <p className="text-xs text-muted-foreground">Admin Portal</p>
      </div>
    </div>
  );
}
