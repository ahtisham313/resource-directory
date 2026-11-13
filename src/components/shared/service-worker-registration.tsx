"use client";

import { useEffect } from "react";

export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      process.env.NODE_ENV !== "production" ||
      !window.isSecureContext ||
      !("serviceWorker" in navigator)
    )
      return;

    async function register() {
      const existing = await navigator.serviceWorker.getRegistration("/");
      const worker =
        existing?.active ?? existing?.waiting ?? existing?.installing;
      if (worker && new URL(worker.scriptURL).pathname !== "/sw.js") return;
      await navigator.serviceWorker.register("/sw.js", {
        scope: "/",
        updateViaCache: "none",
      });
    }

    void register().catch(() => {});
  }, []);
  return null;
}
