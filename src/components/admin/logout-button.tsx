"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);

  async function logout() {
    setPending(true);
    setFailed(false);
    try {
      await signOut({ callbackUrl: "/admin/login" });
    } catch {
      setFailed(true);
      setPending(false);
    }
  }

  return (
    <div className="shrink-0">
      <Button
        variant="outline"
        type="button"
        className="min-h-11 gap-2 px-3"
        disabled={pending}
        onClick={logout}
      >
        <LogOut aria-hidden="true" />
        {pending ? "Signing out…" : "Log out"}
      </Button>
      {failed && (
        <p role="alert" className="mt-2 max-w-40 text-xs text-destructive">
          Unable to log out. Please try again.
        </p>
      )}
    </div>
  );
}
