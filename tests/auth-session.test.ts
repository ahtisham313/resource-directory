import { describe, expect, it } from "vitest";
import {
  createAdminToken,
  readSessionAdmin,
  safeAdminRedirect,
} from "../src/modules/auth/session-data";

const admin = {
  id: "safe-admin",
  name: "Admin",
  email: "admin@example.com",
  role: "ADMIN",
};

describe("safe session data", () => {
  it("allowlists JWT fields even when the input has private properties", () => {
    const token = createAdminToken({
      ...admin,
      passwordHash: "private hash",
      invitationToken: "private token",
      status: "ACTIVE",
    });
    expect(token).toEqual({
      sub: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
    });
    expect(readSessionAdmin({ ...token, privateData: "hidden" })).toEqual(
      admin,
    );
  });
  it("does not create a session identity for an incomplete token", () => {
    expect(readSessionAdmin({ sub: admin.id })).toBeUndefined();
    expect(
      readSessionAdmin({
        sub: "",
        name: admin.name,
        email: admin.email,
        role: "ADMIN",
      }),
    ).toBeUndefined();
  });
});

describe("admin redirects", () => {
  it.each([
    "https://evil.example/admin",
    "//evil.example/admin",
    "javascript:alert(1)",
    "/administrator",
    "/public",
    "https://example.com.evil.example/admin",
    "\\\\evil.example\\admin",
  ])("rejects unsafe destination %s", (url) => {
    expect(safeAdminRedirect(url, "https://example.com")).toBe(
      "https://example.com/admin",
    );
  });
  it.each([
    "/admin",
    "/admin/surveys",
    "https://example.com/admin/resources",
    "/admin/login",
  ])("accepts same-origin admin destination %s", (url) => {
    expect(safeAdminRedirect(url, "https://example.com")).toBe(
      new URL(url, "https://example.com").href,
    );
  });
  it("drops query strings and fragments from redirects", () => {
    expect(
      safeAdminRedirect(
        "/admin?callbackUrl=https://evil.example#token",
        "https://example.com",
      ),
    ).toBe("https://example.com/admin");
  });
});
