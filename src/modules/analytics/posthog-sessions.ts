import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { AnalyticsPeriod } from "./analytics-period";
import { publicPosthogConfig } from "./posthog-config";

export type SessionSummary =
  | { status: "available"; count: number }
  | { status: "not-configured" | "unavailable"; message: string };
const cache = new Map<
  string,
  { expires: number; pending: Promise<SessionSummary> }
>();
function privateConfig() {
  const parsed = z
    .object({
      key: z.string().trim().min(1),
      project: z.string().regex(/^[1-9]\d{0,11}$/),
      host: z.url(),
    })
    .safeParse({
      key: process.env.POSTHOG_PERSONAL_API_KEY,
      project: process.env.POSTHOG_PROJECT_ID,
      host: process.env.POSTHOG_API_HOST,
    });
  if (!parsed.success) return null;
  const url = new URL(parsed.data.host),
    local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== "/" ||
    ["us.i.posthog.com", "eu.i.posthog.com"].includes(url.hostname) ||
    (url.protocol !== "https:" && !(url.protocol === "http:" && local))
  )
    return null;
  return { ...parsed.data, host: url.origin };
}
export function isPublicPosthogConfigured() {
  return publicPosthogConfig() !== null;
}
export async function getPosthogSessions(
  period: AnalyticsPeriod,
): Promise<SessionSummary> {
  const config = privateConfig();
  if (!config)
    return {
      status: "not-configured",
      message:
        "PostHog sessions are not configured. Set POSTHOG_PERSONAL_API_KEY, POSTHOG_PROJECT_ID, and POSTHOG_API_HOST on the server.",
    };
  const key = createHash("sha256")
    .update(
      JSON.stringify([
        config.host,
        config.project,
        config.key,
        period.startIso,
        period.endIso,
      ]),
    )
    .digest("hex");
  const found = cache.get(key);
  if (found && found.expires > Date.now()) return found.pending;
  for (const [id, entry] of cache)
    if (entry.expires <= Date.now()) cache.delete(id);
  if (cache.size >= 24) cache.delete(cache.keys().next().value!);
  const pending = querySessions(config, period);
  cache.set(key, { expires: Date.now() + 60000, pending });
  return pending;
}
async function querySessions(
  config: NonNullable<ReturnType<typeof privateConfig>>,
  period: AnalyticsPeriod,
): Promise<SessionSummary> {
  // Only validated UTC timestamps enter the fixed query; URL input never becomes SQL.
  const start = period.startIso.slice(0, 19).replace("T", " "),
    end = period.endIso.slice(0, 19).replace("T", " ");
  const query = `SELECT count(DISTINCT properties.$session_id) AS sessions FROM events WHERE event = '$pageview' AND properties.analytics_source = 'resource_directory' AND properties.$session_id IS NOT NULL AND properties.$session_id != '' AND timestamp >= toDateTime('${start}', 'UTC') AND timestamp < toDateTime('${end}', 'UTC')`;
  try {
    const response = await fetch(
      `${config.host}/api/projects/${config.project}/query/`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.key}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query: { kind: "HogQLQuery", query },
          name: "Resource Directory website sessions",
          refresh: "force_blocking",
        }),
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(6000),
      },
    );
    if (!response.ok)
      return {
        status: "unavailable",
        message:
          response.status === 401 || response.status === 403
            ? "PostHog rejected the session query. Check the personal API key's project access and query:read scope."
            : response.status === 429
              ? "PostHog's query limit was reached. Try again in a minute."
              : "PostHog sessions are temporarily unavailable. Other dashboard data is available.",
      };
    const parsed = z
      .object({
        results: z.tuple([z.tuple([z.number().int().nonnegative().safe()])]),
      })
      .safeParse(await response.json());
    if (!parsed.success) throw new Error("Invalid session count");
    return { status: "available", count: parsed.data.results[0][0] };
  } catch {
    return {
      status: "unavailable",
      message:
        "PostHog sessions are temporarily unavailable. Other dashboard data is available.",
    };
  }
}
