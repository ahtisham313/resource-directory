import "server-only";
import { createHmac, randomBytes } from "node:crypto";

export function createSubmissionLimiter(
  limit = 5,
  windowMs = 60000,
  maxEntries = 1000,
) {
  const entries = new Map<string, { count: number; expires: number }>();
  return (key: string, now = Date.now()): number => {
    for (const [id, entry] of entries)
      if (entry.expires <= now) entries.delete(id);
    let entry = entries.get(key);
    if (!entry) {
      if (entries.size >= maxEntries)
        entries.delete(entries.keys().next().value!);
      entry = { count: 0, expires: now + windowMs };
      entries.set(key, entry);
    }
    entry.count++;
    return entry.count > limit
      ? Math.max(1, Math.ceil((entry.expires - now) / 1000))
      : 0;
  };
}

const limitSubmission = createSubmissionLimiter();
let anonymousSalt: string | undefined;
export function submissionRetryAfter(request: Request): number {
  // Proxy headers are supplemental signals, not identity. This limiter is per process and bounded.
  const address = (
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  ).slice(0, 128);
  const key = createHmac(
    "sha256",
    process.env.AUTH_SECRET ||
      (anonymousSalt ??= randomBytes(32).toString("hex")),
  )
    .update(address)
    .digest("hex");
  return limitSubmission(key);
}
