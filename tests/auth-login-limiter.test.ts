import { afterEach, expect, it, vi } from "vitest";
import { loginRetryAfter } from "../src/modules/auth/login-limiter";

afterEach(() => vi.useRealTimers());

it("limits credential bursts using the final proxy address and allows retries after the window", () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T00:00:00Z"));
  const request = (forwarded: string) =>
    new Request("https://example.com/api/auth/callback/credentials", {
      headers: { "x-forwarded-for": forwarded },
    });
  for (let index = 0; index < 20; index++)
    expect(loginRetryAfter(request(`${index}.0.0.1, 192.0.2.100`))).toBe(0);
  expect(loginRetryAfter(request("198.51.100.1, 192.0.2.100"))).toBe(60);
  expect(loginRetryAfter(request("192.0.2.101"))).toBe(0);
  vi.advanceTimersByTime(61000);
  expect(loginRetryAfter(request("192.0.2.100"))).toBe(0);
});
