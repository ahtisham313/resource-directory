import "server-only";
import { createHmac } from "node:crypto";
import { createSubmissionLimiter } from "@/modules/surveys/submission-limiter";

const limit = createSubmissionLimiter(20, 60000, 1000);

export function loginRetryAfter(request: Request) {
  const address = (
    request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim() ||
    "unknown"
  ).slice(0, 128);
  const key = createHmac(
    "sha256",
    process.env.AUTH_SECRET ?? "local-login-limit",
  )
    .update(address)
    .digest("hex");
  return limit(key);
}
