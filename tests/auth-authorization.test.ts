import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getCurrentAdmin,
  requireAdmin,
  requireRole,
} from "../src/modules/auth/authorization";
import { withAdmin } from "../src/modules/auth/admin-api";
import {
  requireAdminPage,
  redirectSignedInAdmin,
} from "../src/modules/auth/page-access";
import { GET } from "../src/app/api/admin/me/route";

const { readSession, findAdmin, redirect } = vi.hoisted(() => ({
  readSession: vi.fn(),
  findAdmin: vi.fn(),
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
}));
vi.mock("@/auth", () => ({ auth: readSession }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ adminUser: { findUnique: findAdmin } }),
}));
vi.mock("next/navigation", () => ({ redirect }));

const admin = {
  id: "current-admin",
  name: "Current Name",
  email: "current@example.com",
  role: "ADMIN",
};
beforeEach(() => {
  vi.clearAllMocks();
  readSession.mockResolvedValue({
    user: { ...admin, name: "Old Name", role: "SUPER_ADMIN" },
  });
  findAdmin.mockResolvedValue({ ...admin, status: "ACTIVE" });
});

describe("current database authorization", () => {
  it("denies a missing session without querying PostgreSQL", async () => {
    readSession.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    expect(findAdmin).not.toHaveBeenCalled();
  });

  it("rejects a malformed session identity", async () => {
    readSession.mockResolvedValue({ user: { id: 1 } });
    expect(await getCurrentAdmin()).toBeNull();
    expect(findAdmin).not.toHaveBeenCalled();
  });

  it("uses the session id to return current safe fields, without selecting the hash", async () => {
    expect(await requireAdmin()).toEqual(admin);
    expect(findAdmin).toHaveBeenCalledWith({
      where: { id: admin.id },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
  });

  it("denies a deleted admin with an otherwise valid session", async () => {
    findAdmin.mockResolvedValue(null);
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it("rechecks status on later calls and denies a newly disabled admin", async () => {
    expect(await requireAdmin()).toEqual(admin);
    findAdmin.mockResolvedValue({ ...admin, status: "INACTIVE" });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });

  it("does not grant SUPER_ADMIN based on a stale JWT role", async () => {
    await expect(requireRole("SUPER_ADMIN")).rejects.toMatchObject({
      status: 403,
    });
  });

  it("accepts ADMIN permission and allows a current SUPER_ADMIN to use either role", async () => {
    expect(await requireRole("ADMIN")).toEqual(admin);
    findAdmin.mockResolvedValue({
      ...admin,
      role: "SUPER_ADMIN",
      status: "ACTIVE",
    });
    expect((await requireRole("SUPER_ADMIN")).role).toBe("SUPER_ADMIN");
    expect((await requireRole("ADMIN")).role).toBe("SUPER_ADMIN");
  });
});

describe("page access", () => {
  it("redirects an unauthenticated protected page to login", async () => {
    readSession.mockResolvedValue(null);
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/admin/login");
  });
  it("redirects a disabled admin to login without a login/dashboard loop", async () => {
    findAdmin.mockResolvedValue({ ...admin, status: "INACTIVE" });
    await expect(requireAdminPage()).rejects.toThrow("REDIRECT:/admin/login");
    redirect.mockClear();
    await redirectSignedInAdmin();
    expect(redirect).not.toHaveBeenCalled();
  });
  it("redirects an active admin away from login", async () => {
    await expect(redirectSignedInAdmin()).rejects.toThrow("REDIRECT:/admin");
  });
  it("keeps login accessible without a session", async () => {
    readSession.mockResolvedValue(null);
    await redirectSignedInAdmin();
    expect(redirect).not.toHaveBeenCalled();
  });
});

describe("protected API", () => {
  it("returns 401 without running the handler", async () => {
    readSession.mockResolvedValue(null);
    const handler = vi.fn();
    const response = await withAdmin(handler);
    expect(response.status).toBe(401);
    expect(handler).not.toHaveBeenCalled();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("returns 403 for an insufficient current role", async () => {
    const handler = vi.fn();
    const response = await withAdmin(handler, "SUPER_ADMIN");
    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("returns only the current safe admin from /api/admin/me", async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ admin });
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });
  it("denies a disabled account even with a session", async () => {
    findAdmin.mockResolvedValue({ ...admin, status: "INACTIVE" });
    expect((await GET()).status).toBe(401);
  });
  it("fails closed with a generic response on database failure", async () => {
    findAdmin.mockRejectedValue(new Error("sensitive connection details"));
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("sensitive");
  });
});
