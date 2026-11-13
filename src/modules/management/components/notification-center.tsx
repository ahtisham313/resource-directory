"use client";
import { useEffect, useRef, useState } from "react";
import { Bell, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { managementRequest } from "../client-request";
const replySchema = z.object({
  unread: z.number(),
  rows: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      message: z.string(),
      readAt: z.string().nullable(),
      createdAt: z.string(),
    }),
  ),
  nextCursor: z.string().nullable(),
});
type Reply = z.infer<typeof replySchema>;
export function NotificationCenter() {
  const [data, setData] = useState<Reply>({
      unread: 0,
      rows: [],
      nextCursor: null,
    }),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null),
    button = useRef<HTMLButtonElement>(null);
  async function load(cursor?: string) {
    setPending(true);
    setError("");
    try {
      const response = await fetch(
        `/api/admin/notifications${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
        { cache: "no-store" },
      );
      if (!response.ok) throw new Error("Unable to load notifications.");
      const next = replySchema.parse(await response.json());
      setData((previous) => ({
        ...next,
        rows: cursor ? [...previous.rows, ...next.rows] : next.rows,
      }));
    } catch {
      setError("Unable to load notifications. Please try again.");
    } finally {
      setPending(false);
    }
  }
  useEffect(() => {
    let ignore = false;
    void fetch("/api/admin/notifications", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) return;
        const next = replySchema.parse(await response.json());
        if (!ignore) setData(next);
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  async function markRead(id: string) {
    setPending(true);
    setError("");
    try {
      await managementRequest(`/api/admin/notifications/${id}`, "PATCH", {});
      setData((previous) => ({
        ...previous,
        unread: Math.max(0, previous.unread - 1),
        rows: previous.rows.map((row) =>
          row.id === id ? { ...row, readAt: new Date().toISOString() } : row,
        ),
      }));
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to mark notification as read.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <Button
        ref={button}
        variant="outline"
        size="icon"
        className="relative size-11 shrink-0"
        aria-label={`Notifications${data.unread ? `, ${data.unread} unread` : ""}`}
        aria-haspopup="dialog"
        onClick={() => {
          dialog.current?.showModal();
          void load();
        }}
      >
        <Bell aria-hidden="true" />
        {data.unread > 0 && (
          <span className="absolute -top-2 -right-2 rounded-full bg-primary px-1.5 text-xs leading-5 text-primary-foreground">
            {data.unread > 99 ? "99+" : data.unread}
          </span>
        )}
      </Button>
      <dialog
        ref={dialog}
        aria-labelledby="notifications-title"
        onClose={() => button.current?.focus()}
        className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40 sm:p-7"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="notifications-title" className="text-xl font-semibold">
            Notifications
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="size-11"
            aria-label="Close notifications"
            onClick={() => dialog.current?.close()}
          >
            <X />
          </Button>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {data.unread} unread
        </p>
        {error && (
          <div role="alert" className="mt-4 text-sm text-destructive">
            <p>{error}</p>
            <Button
              variant="outline"
              className="mt-2 min-h-11"
              disabled={pending}
              onClick={() => void load()}
            >
              Try again
            </Button>
          </div>
        )}
        {pending && (
          <p role="status" className="mt-4 text-sm">
            Loading…
          </p>
        )}
        {!data.rows.length && !pending && !error && (
          <p className="py-8 text-sm text-muted-foreground">
            No notifications yet.
          </p>
        )}
        <ul className="mt-4 divide-y">
          {data.rows.map((row) => (
            <li key={row.id} className="space-y-2 py-4">
              <p className="font-medium wrap-break-word">
                {row.title}
                {!row.readAt && (
                  <span className="ml-2 text-xs text-primary">Unread</span>
                )}
              </p>
              <p className="text-sm leading-6 wrap-break-word">{row.message}</p>
              <time
                dateTime={row.createdAt}
                className="block text-xs text-muted-foreground"
              >
                {new Date(row.createdAt).toLocaleString()}
              </time>
              {!row.readAt && (
                <Button
                  variant="outline"
                  className="min-h-11"
                  disabled={pending}
                  onClick={() => void markRead(row.id)}
                >
                  Mark as read
                </Button>
              )}
            </li>
          ))}
        </ul>
        {data.nextCursor && (
          <Button
            variant="outline"
            className="min-h-11 w-full"
            disabled={pending}
            onClick={() => void load(data.nextCursor ?? undefined)}
          >
            Load older notifications
          </Button>
        )}
      </dialog>
    </>
  );
}
