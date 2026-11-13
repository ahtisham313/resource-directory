"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Library,
  Users,
  Menu,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminBrand } from "./admin-brand";
import { LogoutButton } from "./logout-button";
import { cn } from "@/lib/utils";
import type { SafeAdmin } from "@/modules/auth/auth-types";

const navigation = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/surveys", label: "Survey", icon: ClipboardList },
  { href: "/admin/resources", label: "Resources", icon: Library },
  { href: "/admin/admins", label: "Admins", icon: Users },
];

function AdminNavigation({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin navigation" className="space-y-1">
      {navigation.map(({ href, label, icon: Icon }) => {
        const active =
          href === "/admin"
            ? pathname === href
            : pathname === href ||
              pathname.startsWith(`${href}/`) ||
              (href === "/admin/surveys" &&
                pathname.startsWith("/admin/responses"));
        return (
          <Link
            key={href}
            href={href}
            prefetch={false}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AdminShell({
  admin,
  children,
}: {
  admin: SafeAdmin;
  children: ReactNode;
}) {
  const drawer = useRef<HTMLDialogElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = () => {
      if (media.matches) drawer.current?.close();
    };
    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  function closeDrawer() {
    drawer.current?.close();
  }

  return (
    <div className="min-h-dvh w-full min-w-0 bg-muted/30 text-foreground">
      <a
        href="#admin-content"
        className="sr-only rounded-lg bg-background p-3 focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:ring-2"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-background p-5 lg:flex">
        <AdminBrand />
        <div className="mt-10">
          <AdminNavigation />
        </div>
        <p className="mt-auto pt-8 text-xs text-muted-foreground">
          Resource Directory · Administration
        </p>
      </aside>

      <dialog
        ref={drawer}
        aria-labelledby="admin-menu-title"
        onClose={() => menuButton.current?.focus()}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-dvh w-72 max-w-[calc(100vw-2rem)] border-r bg-background p-5 text-foreground shadow-xl backdrop:bg-black/40"
      >
        <div className="mb-8 flex items-center justify-between gap-2">
          <h2 id="admin-menu-title" className="font-semibold">
            Admin menu
          </h2>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-11"
            onClick={closeDrawer}
            aria-label="Close menu"
          >
            <X aria-hidden="true" />
          </Button>
        </div>
        <AdminBrand />
        <div className="mt-8">
          <AdminNavigation onNavigate={closeDrawer} />
        </div>
      </dialog>

      <div className="min-w-0 lg:pl-64">
        <header className="flex flex-wrap items-center justify-between gap-4 border-b bg-background px-4 py-4 sm:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              ref={menuButton}
              type="button"
              variant="outline"
              size="icon"
              className="size-11 lg:hidden"
              aria-label="Open admin menu"
              aria-haspopup="dialog"
              onClick={() => drawer.current?.showModal()}
            >
              <Menu aria-hidden="true" />
            </Button>
            <div className="min-w-0">
              <p className="text-sm font-semibold">Resource Directory</p>
              <p className="text-xs text-muted-foreground">Admin Portal</p>
            </div>
          </div>
          <div className="flex w-full min-w-0 items-center justify-between gap-3 sm:w-auto sm:justify-end sm:gap-5">
            <div className="min-w-0 sm:max-w-60">
              <p className="truncate text-sm font-medium">
                {admin.name || admin.email}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {admin.email}
              </p>
            </div>
            <LogoutButton />
          </div>
        </header>
        <main
          id="admin-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-6xl min-w-0 px-4 py-8 outline-none sm:px-8 sm:py-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
