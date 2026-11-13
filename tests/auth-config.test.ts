import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getAuthOptions } from "../src/auth";

vi.mock("next-auth", () => ({ getServerSession: vi.fn() }));
vi.mock("next/server", () => ({ connection: vi.fn() }));
vi.mock("@/modules/auth/credentials", () => ({ verifyCredentials: vi.fn() }));

beforeEach(() => {
  vi.stubEnv("AUTH_SECRET", "unit-test-only-secret-not-a-real-credential");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("NextAuth configuration", () => {
  it("requires an explicit strong secret and uses the credentials-only JWT strategy", () => {
    const options = getAuthOptions();
    expect(options.session).toEqual({ strategy: "jwt", maxAge: 28800 });
    expect(options.providers).toHaveLength(1);
    expect(options.providers[0].type).toBe("credentials");
    expect(options.pages).toEqual({
      signIn: "/admin/login",
      error: "/admin/login",
    });
    vi.stubEnv("AUTH_SECRET", "");
    expect(() => getAuthOptions()).toThrow("AUTH_SECRET");
    vi.stubEnv("AUTH_SECRET", "too-short");
    expect(() => getAuthOptions()).toThrow("AUTH_SECRET");
  });
});
