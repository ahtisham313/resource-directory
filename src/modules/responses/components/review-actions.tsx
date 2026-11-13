"use client";

import { useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";

const replySchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]).optional(),
  alreadyReviewed: z.boolean().optional(),
  error: z.string().optional(),
  code: z.string().optional(),
});
const inputClass =
  "min-h-11 w-full min-w-0 rounded-lg border bg-background px-3 py-2 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60";

export function ReviewActions({
  id,
  status,
}: {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const form = useRef<HTMLFormElement>(null);
  const approveButton = useRef<HTMLButtonElement>(null);
  const rejectButton = useRef<HTMLButtonElement>(null);
  const busy = useRef(false);
  const [decision, setDecision] = useState<"approve" | "reject">("approve");
  const [pending, setPending] = useState(false);
  const [manual, setManual] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  function open(next: "approve" | "reject") {
    setDecision(next);
    setError("");
    setManual(false);
    form.current?.reset();
    dialog.current?.showModal();
  }
  async function review(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current) return;
    const data = new FormData(event.currentTarget);
    const body = {
      note: String(data.get("note") ?? ""),
      ...(decision === "approve" && manual
        ? {
            coordinates: {
              latitude: Number(data.get("latitude")),
              longitude: Number(data.get("longitude")),
            },
          }
        : {}),
    };
    busy.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/responses/${encodeURIComponent(id)}/${decision}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const result = replySchema.safeParse(await response.json());
      if (!result.success) throw new Error("Unexpected review response");
      if (!response.ok) {
        setError(
          result.data.error ??
            "Unable to save this decision. Please try again.",
        );
        if (result.data.code === "COORDINATES_REQUIRED") setManual(true);
        return;
      }
      if (!result.data.status) throw new Error("Missing decision");
      setSuccess(
        result.data.alreadyReviewed
          ? "This decision was already recorded."
          : result.data.status === "APPROVED"
            ? "Response approved. An active resource has been created."
            : "Response rejected. No resource was created.",
      );
      dialog.current?.close();
      router.refresh();
    } catch {
      setError("Unable to save this decision. Please try again.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return (
    <>
      {success && (
        <p
          role="status"
          className="rounded-lg border bg-background p-4 text-sm leading-6"
        >
          {success}
        </p>
      )}
      {status === "PENDING" && (
        <section
          aria-label="Review decision"
          className="rounded-xl border bg-background p-4 sm:p-6"
        >
          <h2 className="text-lg font-semibold">Review submission</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Check the original answers below before recording a decision.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Button
              ref={approveButton}
              type="button"
              className="min-h-11 px-5"
              disabled={pending}
              onClick={() => open("approve")}
            >
              Approve
            </Button>
            <Button
              ref={rejectButton}
              type="button"
              variant="destructive"
              className="min-h-11 px-5"
              disabled={pending}
              onClick={() => open("reject")}
            >
              Reject
            </Button>
          </div>
        </section>
      )}
      <dialog
        ref={dialog}
        aria-labelledby="review-dialog-title"
        aria-describedby="review-dialog-description"
        onCancel={(event) => {
          if (busy.current) event.preventDefault();
        }}
        onClose={() => {
          (decision === "approve"
            ? approveButton
            : rejectButton
          ).current?.focus();
        }}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40 sm:p-7"
      >
        <h2 id="review-dialog-title" className="text-xl font-semibold">
          {decision === "approve" ? "Approve response" : "Reject response"}
        </h2>
        <p
          id="review-dialog-description"
          className="mt-2 text-sm leading-6 text-muted-foreground"
        >
          {decision === "approve"
            ? "Approval creates an active resource and keeps the original submission unchanged."
            : "Rejection records your decision without creating a resource."}
        </p>
        <form
          ref={form}
          onSubmit={review}
          aria-busy={pending}
          className="mt-5 space-y-5"
        >
          <div className="space-y-2">
            <label htmlFor="review-note" className="text-sm font-medium">
              Review note (optional)
            </label>
            <textarea
              id="review-note"
              name="note"
              maxLength={2000}
              rows={4}
              disabled={pending}
              className={inputClass}
            />
          </div>
          {decision === "approve" && (
            <div className="space-y-3">
              <label className="flex min-h-11 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={manual}
                  disabled={pending}
                  onChange={(event) => setManual(event.target.checked)}
                  className="size-5 accent-primary focus-visible:outline-2"
                />
                Enter coordinates manually
              </label>
              <p className="text-xs leading-6 text-muted-foreground">
                Otherwise, reuse verified coordinates for the same address or
                try an automatic lookup.
              </p>
              {manual && (
                <fieldset className="grid min-w-0 gap-3 sm:grid-cols-2">
                  <legend className="sr-only">Provider coordinates</legend>
                  <div className="space-y-2">
                    <label
                      htmlFor="review-latitude"
                      className="text-sm font-medium"
                    >
                      Latitude
                    </label>
                    <input
                      id="review-latitude"
                      name="latitude"
                      type="number"
                      step="any"
                      min={-90}
                      max={90}
                      required
                      disabled={pending}
                      className={inputClass}
                    />
                  </div>
                  <div className="space-y-2">
                    <label
                      htmlFor="review-longitude"
                      className="text-sm font-medium"
                    >
                      Longitude
                    </label>
                    <input
                      id="review-longitude"
                      name="longitude"
                      type="number"
                      step="any"
                      min={-180}
                      max={180}
                      required
                      disabled={pending}
                      className={inputClass}
                    />
                  </div>
                </fieldset>
              )}
            </div>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm leading-6 text-destructive"
            >
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              className="min-h-11"
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant={decision === "approve" ? "default" : "destructive"}
              disabled={pending}
              className="min-h-11"
            >
              {pending && (
                <LoaderCircle className="animate-spin" aria-hidden="true" />
              )}
              {pending
                ? "Saving…"
                : decision === "approve"
                  ? "Confirm approval"
                  : "Confirm rejection"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
