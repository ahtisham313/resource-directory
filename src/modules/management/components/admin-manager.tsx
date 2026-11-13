"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { BuilderConfirm } from "@/modules/surveys/components/builder-confirm";
import { managementRequest } from "../client-request";
import type { listAdmins } from "../admin-management";
type Data = Awaited<ReturnType<typeof listAdmins>>;
type Row = Data["rows"][number];
export function AdminManager({
  data,
  currentId,
  mailConfigured,
}: {
  data: Data;
  currentId: string;
  mailConfigured: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"edit" | "delete" | "invite" | "cancel">(),
    [target, setTarget] = useState<Row>(),
    [invitationId, setInvitationId] = useState("");
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [role, setRole] = useState<"ADMIN" | "SUPER_ADMIN">("ADMIN"),
    [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [pending, setPending] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  function open(action: "edit" | "delete", row: Row) {
    setTarget(row);
    setName(row.name);
    setRole(row.role);
    setStatus(row.status);
    setError("");
    setMode(action);
  }
  async function confirm() {
    if (pending) return;
    setPending(true);
    setError("");
    setNotice("");
    try {
      if (mode === "invite") {
        await managementRequest("/api/admin/invitations", "POST", {
          email,
          role,
        });
        setNotice("Invitation sent. The link expires in 24 hours.");
      } else if (mode === "cancel")
        await managementRequest(
          `/api/admin/invitations/${invitationId}`,
          "DELETE",
          {},
        );
      else if (target)
        await managementRequest(
          `/api/admin/admins/${target.id}`,
          mode === "delete" ? "DELETE" : "PATCH",
          mode === "delete"
            ? { revision: target.revision }
            : { name, role, status, revision: target.revision },
        );
      setMode(undefined);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Unable to save these changes.",
      );
    } finally {
      setPending(false);
    }
  }
  const inputClass =
    "mt-2 min-h-11 w-full rounded-lg border bg-background px-3";
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Administrators
          </h1>
          <p className="mt-2 text-muted-foreground">
            Manage accounts and send invitations.
          </p>
        </div>
        <Button
          className="min-h-11"
          onClick={() => {
            setEmail("");
            setRole("ADMIN");
            setError("");
            setMode("invite");
          }}
        >
          Invite admin
        </Button>
      </div>
      {!mailConfigured && (
        <p className="rounded-lg border bg-background p-4 text-sm leading-6 text-muted-foreground">
          Invitation email needs SMTP settings in the server environment.
          Account editing and resource management are available.
        </p>
      )}
      {notice && (
        <p role="status" className="rounded-lg border p-4 text-sm">
          {notice}
        </p>
      )}
      {data.rows.length ? (
        <div className="max-w-full overflow-x-auto rounded-xl border bg-background">
          <table className="w-full min-w-190 text-left text-sm">
            <caption className="sr-only">Administrator accounts</caption>
            <thead className="border-b bg-muted/50">
              <tr>
                {["Name", "Email", "Role", "Status", "Joined", "Actions"].map(
                  (label) => (
                    <th key={label} className="p-4 font-medium">
                      {label}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row) => (
                <tr key={row.id} className="border-b last:border-0">
                  <td className="max-w-48 p-4 wrap-break-word">
                    {row.name}
                    {row.id === currentId && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        You
                      </span>
                    )}
                  </td>
                  <td className="max-w-64 p-4 wrap-break-word">{row.email}</td>
                  <td className="p-4 whitespace-nowrap">
                    {row.role === "SUPER_ADMIN" ? "Super admin" : "Admin"}
                  </td>
                  <td className="p-4">
                    {row.status === "ACTIVE" ? "Active" : "Inactive"}
                  </td>
                  <td className="p-4 whitespace-nowrap">
                    {row.createdAt.slice(0, 10)}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="min-h-11"
                        onClick={() => open("edit", row)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="destructive"
                        className="min-h-11"
                        disabled={row.id === currentId}
                        onClick={() => open("delete", row)}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p>No administrators found.</p>
      )}
      {data.invitations.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Pending invitations</h2>
          <ul className="divide-y rounded-xl border bg-background">
            {data.invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0 text-sm">
                  <p className="wrap-break-word font-medium">
                    {invitation.email}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    {invitation.role === "SUPER_ADMIN"
                      ? "Super admin"
                      : "Admin"}{" "}
                    · Expires{" "}
                    {invitation.expiresAt.replace("T", " ").slice(0, 16)} UTC
                  </p>
                </div>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={() => {
                    setInvitationId(invitation.id);
                    setEmail(invitation.email);
                    setError("");
                    setMode("cancel");
                  }}
                >
                  Cancel invitation
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {mode && (
        <BuilderConfirm
          title={
            mode === "edit"
              ? "Edit administrator"
              : mode === "delete"
                ? "Delete administrator?"
                : mode === "cancel"
                  ? "Cancel invitation?"
                  : "Invite administrator"
          }
          description={
            mode === "delete"
              ? `Permanently delete ${target?.name} (${target?.email})? Their previous reviews and audit attribution will be kept.`
              : mode === "edit"
                ? `Update ${target?.email}. Inactive accounts lose access immediately.`
                : mode === "cancel"
                  ? `Invalidate the invitation for ${email}?`
                  : "Send a single-use email link that expires in 24 hours."
          }
          pending={pending}
          destructive={mode === "delete" || mode === "cancel"}
          confirmLabel={
            mode === "invite"
              ? "Send invitation"
              : mode === "delete"
                ? "Delete administrator"
                : mode === "cancel"
                  ? "Cancel invitation"
                  : "Save changes"
          }
          onConfirm={confirm}
          onClose={() => {
            if (!pending) setMode(undefined);
          }}
        >
          {(mode === "edit" || mode === "invite") && (
            <div className="mt-5 space-y-4">
              {mode === "edit" ? (
                <label className="block text-sm font-medium">
                  Name
                  <input
                    className={inputClass}
                    value={name}
                    maxLength={120}
                    disabled={pending}
                    onChange={(event) => setName(event.target.value)}
                  />
                </label>
              ) : (
                <label className="block text-sm font-medium">
                  Email
                  <input
                    type="email"
                    autoComplete="email"
                    className={inputClass}
                    value={email}
                    maxLength={254}
                    disabled={pending}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
              )}
              <label className="block text-sm font-medium">
                Role
                <select
                  className={inputClass}
                  value={role}
                  disabled={pending}
                  onChange={(event) =>
                    setRole(
                      event.target.value === "SUPER_ADMIN"
                        ? "SUPER_ADMIN"
                        : "ADMIN",
                    )
                  }
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super admin</option>
                </select>
              </label>
              {mode === "edit" && (
                <label className="block text-sm font-medium">
                  Status
                  <select
                    className={inputClass}
                    value={status}
                    disabled={pending}
                    onChange={(event) =>
                      setStatus(
                        event.target.value === "INACTIVE"
                          ? "INACTIVE"
                          : "ACTIVE",
                      )
                    }
                  >
                    <option value="ACTIVE">Active</option>
                    <option value="INACTIVE">Inactive</option>
                  </select>
                </label>
              )}
            </div>
          )}
          {error && (
            <p role="alert" className="mt-4 text-sm text-destructive">
              {error}
            </p>
          )}
        </BuilderConfirm>
      )}
    </div>
  );
}
