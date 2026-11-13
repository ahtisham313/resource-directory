"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

export function BuilderConfirm({
  title,
  description,
  children,
  pending,
  confirmLabel = "Confirm",
  destructive = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  children?: ReactNode;
  pending: boolean;
  confirmLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  return (
    <dialog
      ref={dialog}
      aria-labelledby="builder-dialog-title"
      aria-describedby="builder-dialog-description"
      onClose={onClose}
      onCancel={(event) => {
        if (pending) event.preventDefault();
      }}
      className="fixed inset-0 m-auto max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl border bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40 sm:p-7"
    >
      <h2 id="builder-dialog-title" className="text-xl font-semibold">
        {title}
      </h2>
      <p
        id="builder-dialog-description"
        className="mt-3 text-sm leading-7 text-muted-foreground"
      >
        {description}
      </p>
      {children}
      <div className="mt-6 flex flex-wrap justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-11"
          disabled={pending}
          onClick={() => dialog.current?.close()}
        >
          Cancel
        </Button>
        <Button
          type="button"
          variant={destructive ? "destructive" : "default"}
          className="min-h-11"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Saving…" : confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
