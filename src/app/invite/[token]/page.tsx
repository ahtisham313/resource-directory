import { Suspense } from "react";
import Link from "next/link";
import { connection } from "next/server";
import { getInvitation } from "@/modules/management/invitation-service";
import { ManagementError } from "@/modules/management/management-types";
import { AcceptInvitationForm } from "@/modules/management/components/accept-invitation-form";
export const metadata = {
  title: "Accept invitation",
  robots: { index: false, follow: false },
  referrer: "no-referrer" as const,
};
async function Invitation({ params }: { params: Promise<{ token: string }> }) {
  await connection();
  const { token } = await params;
  let invitation,
    message = "";
  try {
    invitation = await getInvitation(token);
  } catch (error) {
    message =
      error instanceof ManagementError
        ? error.message
        : "The invitation could not be loaded. Please try again later.";
  }
  if (!invitation)
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm leading-7">
          {message}
        </p>
        <Link
          href="/admin/login"
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          Admin sign in
        </Link>
      </div>
    );
  return <AcceptInvitationForm token={token} email={invitation.email} />;
}
export default function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-muted/30 p-4 sm:p-8">
      <div className="w-full max-w-md space-y-6 rounded-2xl border bg-background p-5 shadow-sm sm:p-8">
        <div>
          <p className="text-sm text-muted-foreground">Resource Directory</p>
          <h1 className="mt-2 text-2xl font-semibold">Join the admin team</h1>
        </div>
        <Suspense fallback={<p role="status">Loading invitation…</p>}>
          <Invitation params={params} />
        </Suspense>
      </div>
    </main>
  );
}
