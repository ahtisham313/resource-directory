import { afterEach, expect, it, vi } from "vitest";
import { parseAnalyticsPeriod } from "../src/modules/analytics/analytics-period";
import { sanitizePublicEvent } from "../src/modules/analytics/public-tracking";
import { getPosthogSessions } from "../src/modules/analytics/posthog-sessions";
import { publicPosthogConfig } from "../src/modules/analytics/posthog-config";
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("uses UTC half-open boundaries, handles leap days, and rejects invalid dates and ranges", () => {
  expect(
    parseAnalyticsPeriod({ mode: "month", year: "2024", month: "2" }),
  ).toMatchObject({
    startIso: "2024-02-01T00:00:00.000Z",
    endIso: "2024-03-01T00:00:00.000Z",
  });
  expect(
    parseAnalyticsPeriod({ mode: "range", start: "2024-02-29" }),
  ).toMatchObject({
    startIso: "2024-02-29T00:00:00.000Z",
    endIso: "2024-03-01T00:00:00.000Z",
  });
  expect(parseAnalyticsPeriod({ mode: "year", year: "2024" })).toMatchObject({
    startIso: "2024-01-01T00:00:00.000Z",
    endIso: "2025-01-01T00:00:00.000Z",
  });
  for (const input of [
    { mode: "range", start: "2023-02-29" },
    { mode: "range", start: "2024-03-01", end: "2024-02-29" },
    { mode: "range", start: "2024-01-01", end: "2025-01-01" },
    { mode: "month", month: "13" },
    { year: ["2024", "2025"] },
  ])
    expect(() => parseAnalyticsPeriod(input)).toThrow();
});
it("drops private routes and sensitive properties while retaining anonymous session and ingestion identifiers", () => {
  const event = {
    uuid: "fixture-event",
    event: "$pageview",
    properties: {
      token: "public-project-token",
      distinct_id: "anonymous-fixture",
      $session_id: "session-fixture",
      $current_url:
        "https://example.com/survey/private-id?email=private@example.com",
      $referrer: "https://example.com/invite/private-token",
      phone: "private phone",
      answers: { private: "survey" },
      latitude: 38.9,
    },
    $set: { email: "private@example.com" },
  };
  const safe = sanitizePublicEvent(event, {
    pathname: "/survey/private-id",
    origin: "https://example.com",
  });
  expect(safe?.properties).toMatchObject({
    token: "public-project-token",
    $session_id: "session-fixture",
    $current_url: "https://example.com/survey/[id]",
    $process_person_profile: false,
    $geoip_disable: true,
  });
  expect(JSON.stringify(safe)).not.toMatch(
    /private|latitude|answers|phone|referrer/,
  );
  expect(safe).not.toHaveProperty("$set");
  for (const pathname of ["/admin", "/admin/login", "/invite/private-token"]) {
    expect(
      sanitizePublicEvent(event, { pathname, origin: "https://example.com" }),
    ).toBeNull();
  }
  expect(
    sanitizePublicEvent(
      { ...event, event: "$autocapture" },
      { pathname: "/", origin: "https://example.com" },
    ),
  ).toBeNull();
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN", "phx_private-key");
  vi.stubEnv("NEXT_PUBLIC_POSTHOG_HOST", "https://us.i.posthog.com");
  expect(publicPosthogConfig()).toBeNull();
});
it("distinguishes missing or failed PostHog access from a real zero and caches each validated period", async () => {
  const request = vi.fn();
  vi.stubGlobal("fetch", request);
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "");
  const period = parseAnalyticsPeriod({
    mode: "month",
    year: "2024",
    month: "2",
  });
  expect(await getPosthogSessions(period)).toMatchObject({
    status: "not-configured",
  });
  expect(request).not.toHaveBeenCalled();
  vi.stubEnv("POSTHOG_PERSONAL_API_KEY", "fixture-private-key");
  vi.stubEnv("POSTHOG_PROJECT_ID", "321");
  vi.stubEnv("POSTHOG_API_HOST", "https://us.posthog.com");
  request.mockResolvedValueOnce(Response.json({ results: [[0]] }));
  const [a, b] = await Promise.all([
    getPosthogSessions(period),
    getPosthogSessions(period),
  ]);
  expect(a).toEqual({ status: "available", count: 0 });
  expect(b).toEqual(a);
  expect(request).toHaveBeenCalledOnce();
  const options = request.mock.calls[0][1] as RequestInit;
  expect(options.headers).toMatchObject({
    Authorization: "Bearer fixture-private-key",
  });
  expect(String(options.body)).toContain(
    "count(DISTINCT properties.$session_id)",
  );
  expect(String(options.body)).toContain("2024-03-01 00:00:00");
  expect(JSON.parse(String(options.body))).toMatchObject({
    refresh: "force_blocking",
  });
  vi.spyOn(Date, "now").mockReturnValue(Date.now() + 61000);
  request.mockResolvedValueOnce(Response.json({ results: [[4]] }));
  expect(await getPosthogSessions(period)).toEqual({
    status: "available",
    count: 4,
  });
  expect(request).toHaveBeenCalledTimes(2);
  request.mockResolvedValueOnce(new Response(null, { status: 403 }));
  expect(
    await getPosthogSessions(
      parseAnalyticsPeriod({ mode: "year", year: "2025" }),
    ),
  ).toMatchObject({
    status: "unavailable",
    message: expect.stringContaining("query:read"),
  });
});
