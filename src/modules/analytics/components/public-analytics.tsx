"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { initializePublicAnalytics } from "../public-tracking";

export function PublicAnalytics() {
  const pathname = usePathname();
  useEffect(() => {
    initializePublicAnalytics();
  }, [pathname]);
  return null;
}
