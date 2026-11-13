"use client";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { acceptSchema } from "../management-types";
import { managementRequest } from "../client-request";
export function AcceptInvitationForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [confirmPassword, setConfirmPassword] = useState("");
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState(""),
    [success, setSuccess] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (pending) return;
    const parsed = acceptSchema.safeParse({ name, password, confirmPassword });
    if (!parsed.success) {
      setMessage(parsed.error.issues[0]?.message ?? "Check your details.");
      return;
    }
    setPending(true);
    setMessage("");
    try {
      await managementRequest(`/api/invitations/${token}`, "POST", parsed.data);
      setPassword("");
      setConfirmPassword("");
      setSuccess(true);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to accept invitation.",
      );
    } finally {
      setPending(false);
    }
  }
  if (success)
    return (
      <div role="status" className="space-y-4">
        <p>Your administrator account is ready.</p>
        <Link
          href="/admin/login"
          className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-primary-foreground"
        >
          Sign in
        </Link>
      </div>
    );
  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <label className="block text-sm font-medium">
        Invited email
        <input
          type="email"
          value={email}
          readOnly
          className="mt-2 min-h-11 w-full rounded-lg border bg-muted px-3"
        />
      </label>
      {[
        {
          label: "Name",
          value: name,
          set: setName,
          type: "text",
          autoComplete: "name",
          max: 120,
        },
        {
          label: "Password",
          value: password,
          set: setPassword,
          type: "password",
          autoComplete: "new-password",
          max: 72,
        },
        {
          label: "Confirm password",
          value: confirmPassword,
          set: setConfirmPassword,
          type: "password",
          autoComplete: "new-password",
          max: 72,
        },
      ].map((field) => (
        <label key={field.label} className="block text-sm font-medium">
          {field.label}
          <input
            type={field.type}
            autoComplete={field.autoComplete}
            value={field.value}
            onChange={(event) => field.set(event.target.value)}
            maxLength={field.max}
            disabled={pending}
            required
            className="mt-2 min-h-11 w-full rounded-lg border px-3"
          />
        </label>
      ))}
      <p className="text-sm text-muted-foreground">
        Use at least 12 characters and at most 72 UTF-8 bytes for your password.
      </p>
      {message && (
        <p role="alert" className="text-sm text-destructive">
          {message}
        </p>
      )}
      <Button type="submit" className="min-h-11 w-full" disabled={pending}>
        {pending ? "Creating account…" : "Accept invitation"}
      </Button>
    </form>
  );
}
