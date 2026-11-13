import posthog from "posthog-js";
import type { CaptureResult } from "posthog-js";
import { publicPosthogConfig } from "./posthog-config";

export function publicAnalyticsPath(pathname: string): string | null {
  if (pathname === "/") return "/";
  if (/^\/survey\/[^/]+\/?$/.test(pathname)) return "/survey/[id]";
  return null;
}
export function sanitizePublicEvent(
  event: CaptureResult,
  location: { pathname: string; origin: string },
): CaptureResult | null {
  const path = publicAnalyticsPath(location.pathname);
  if (!path || !["$pageview", "category_selected"].includes(event.event))
    return null;
  const properties: Record<string, unknown> = {
    analytics_source: "resource_directory",
    $current_url: location.origin + path,
    $pathname: path,
    $ip: "0.0.0.0",
    $geoip_disable: true,
    $process_person_profile: false,
  };
  for (const key of [
    "token",
    "distinct_id",
    "$device_id",
    "$session_id",
    "$window_id",
    "$lib",
    "$lib_version",
    "$insert_id",
    "$is_identified",
    "$session_start_timestamp",
  ]) {
    const value: unknown = event.properties[key];
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean"
    )
      properties[key] = value;
  }
  if (event.event === "category_selected") {
    if (
      path !== "/" ||
      typeof event.properties.category_slug !== "string" ||
      typeof event.properties.category_name !== "string"
    )
      return null;
    properties.category_slug = event.properties.category_slug;
    properties.category_name = event.properties.category_name;
  }
  return {
    uuid: event.uuid,
    event: event.event,
    timestamp: event.timestamp,
    properties,
  };
}
export function publicTrackingAllowed() {
  return (
    typeof window !== "undefined" &&
    publicAnalyticsPath(window.location.pathname) !== null &&
    navigator.doNotTrack !== "1" &&
    !(
      "globalPrivacyControl" in navigator &&
      navigator.globalPrivacyControl === true
    )
  );
}
export function initializePublicAnalytics() {
  const config = publicPosthogConfig();
  if (!config || !publicTrackingAllowed() || posthog.__loaded) return;
  try {
    posthog.init(config.token, {
      api_host: config.host,
      defaults: "2026-08-30",
      capture_pageview: "history_change",
      capture_pageleave: false,
      autocapture: false,
      capture_dead_clicks: false,
      capture_heatmaps: false,
      capture_exceptions: false,
      capture_performance: false,
      disable_session_recording: true,
      disable_surveys: true,
      disable_conversations: true,
      disable_product_tours: true,
      disable_web_experiments: true,
      save_referrer: false,
      save_campaign_params: false,
      disable_capture_url_hashes: true,
      debug: false,
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      person_profiles: "never",
      cross_subdomain_cookie: false,
      secure_cookie: window.location.protocol === "https:",
      respect_dnt: true,
      persistence: "localStorage",
      before_send: (event) =>
        publicTrackingAllowed()
          ? sanitizePublicEvent(event, window.location)
          : null,
      on_request_error: () => {},
    });
  } catch {
    /* Analytics must not prevent browsing. */
  }
}
export function trackCategorySelection(category: {
  slug: string;
  name: string;
}) {
  if (!publicTrackingAllowed()) return;
  let eventId: string;
  try {
    eventId = crypto.randomUUID();
  } catch {
    return;
  }
  try {
    initializePublicAnalytics();
    if (posthog.__loaded) {
      if (posthog.has_opted_out_capturing()) return;
      posthog.capture(
        "category_selected",
        { category_slug: category.slug, category_name: category.name },
        { uuid: eventId },
      );
    }
  } catch {
    /* PostgreSQL recording works independently of PostHog. */
  }
  void fetch("/api/analytics/category", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      event: "category_selected",
      categorySlug: category.slug,
      eventId,
    }),
    keepalive: true,
    credentials: "omit",
    cache: "no-store",
  }).catch(() => {});
}
