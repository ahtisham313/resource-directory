"use client";

import { useState, type FormEvent } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LoaderCircle, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { credentialsSchema } from "@/modules/auth/auth-types";

type FieldErrors = Partial<Record<"email" | "password", string>>;

export function LoginForm() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setMessage("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const parsed = credentialsSchema.safeParse({
      email: data.get("email"),
      password: data.get("password"),
    });
    if (!parsed.success) {
      const errors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if ((field === "email" || field === "password") && !errors[field])
          errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }
    setFieldErrors({});
    setPending(true);
    try {
      const result = await signIn("credentials", {
        ...parsed.data,
        redirect: false,
        callbackUrl: "/admin",
      });
      if (result?.status === 429) {
        setMessage(
          "Too many sign-in attempts. Please wait a minute and try again.",
        );
        return;
      }
      if (!result?.ok || result.error) {
        setMessage("Invalid email or password.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setMessage("Unable to sign in. Please try again.");
    } finally {
      const password = form.elements.namedItem("password");
      if (password instanceof HTMLInputElement) password.value = "";
      setPending(false);
    }
  }

  const inputClass =
    "min-h-11 w-full rounded-lg border border-input bg-background px-3 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 aria-invalid:border-destructive disabled:opacity-60";

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-5"
      aria-busy={pending}
    >
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          maxLength={254}
          placeholder="you@example.com"
          disabled={pending}
          className={inputClass}
          aria-invalid={Boolean(fieldErrors.email)}
          aria-describedby={fieldErrors.email ? "email-error" : undefined}
        />
        {fieldErrors.email && (
          <p id="email-error" className="text-sm text-destructive" role="alert">
            {fieldErrors.email}
          </p>
        )}
      </div>
      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium">
          Password
        </label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            maxLength={72}
            disabled={pending}
            className={`${inputClass} pr-12`}
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? "password-error" : undefined
            }
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute top-0 right-0 size-11"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            onClick={() => setShowPassword((value) => !value)}
            disabled={pending}
          >
            {showPassword ? (
              <EyeOff aria-hidden="true" />
            ) : (
              <Eye aria-hidden="true" />
            )}
          </Button>
        </div>
        {fieldErrors.password && (
          <p
            id="password-error"
            className="text-sm text-destructive"
            role="alert"
          >
            {fieldErrors.password}
          </p>
        )}
      </div>
      <div aria-live="polite" aria-atomic="true">
        {message && (
          <p
            role="alert"
            className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {message}
          </p>
        )}
      </div>
      <Button
        type="submit"
        disabled={pending}
        className="min-h-11 w-full gap-2 text-sm"
      >
        {pending ? (
          <LoaderCircle className="animate-spin" aria-hidden="true" />
        ) : null}
        {pending ? "Signing in…" : "Sign In"}
        {!pending && <ArrowRight aria-hidden="true" />}
      </Button>
    </form>
  );
}
