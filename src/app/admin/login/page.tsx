import { Suspense } from "react";
import { AdminBrand } from "@/components/admin/admin-brand";
import { LoginForm } from "@/components/admin/login-form";
import { redirectSignedInAdmin } from "@/modules/auth/page-access";

export const metadata = { title: "Admin sign in" };

async function LoginContent() {
  await redirectSignedInAdmin();
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-muted/30 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-8">
          <AdminBrand />
        </div>
        <section
          className="rounded-2xl border bg-background p-5 shadow-sm sm:p-8"
          aria-labelledby="login-title"
        >
          <h1
            id="login-title"
            className="text-2xl font-semibold tracking-tight"
          >
            Admin Portal
          </h1>
          <p className="mt-2 mb-7 text-sm leading-6 text-muted-foreground">
            Sign in to manage the Resource Directory.
          </p>
          <LoginForm />
        </section>
        <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
          Access is limited to authorized administrators.
        </p>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <p className="p-6 text-sm text-muted-foreground" role="status">
          Loading sign in…
        </p>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
