import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: {
    default: "Admin Portal | Resource Directory",
    template: "%s | Resource Directory",
  },
  description: "Resource Directory administration.",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full [font-family:var(--font-geist-sans),sans-serif]">
      {children}
    </div>
  );
}
