import { hash } from "bcryptjs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { credentialsSchema } from "../src/modules/auth/auth-types";
import { verifyCredentials } from "../src/modules/auth/credentials";

const { findAdmin } = vi.hoisted(() => ({ findAdmin: vi.fn() }));
vi.mock("@/lib/db", () => ({
  getDb: () => ({ adminUser: { findUnique: findAdmin } }),
}));

const password = "Unit test password 123";
let passwordHash: string;
const safeAdmin = {
  id: "test-admin",
  name: "Test Admin",
  email: "admin@example.com",
  role: "ADMIN",
};

beforeAll(async () => {
  passwordHash = await hash(password, 4);
});
beforeEach(() => {
  findAdmin.mockReset();
});

describe("admin credentials", () => {
  it("accepts a valid bcrypt password, normalizes email, and returns only safe fields", async () => {
    findAdmin.mockResolvedValue({
      ...safeAdmin,
      status: "ACTIVE",
      passwordHash,
    });
    expect(
      await verifyCredentials({ email: "  ADMIN@EXAMPLE.COM ", password }),
    ).toEqual(safeAdmin);
    expect(findAdmin).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: "admin@example.com" } }),
    );
  });

  it("rejects an incorrect password", async () => {
    findAdmin.mockResolvedValue({
      ...safeAdmin,
      status: "ACTIVE",
      passwordHash,
    });
    expect(
      await verifyCredentials({
        email: safeAdmin.email,
        password: "wrong password",
      }),
    ).toBeNull();
  });

  it("rejects an unknown email", async () => {
    findAdmin.mockResolvedValue(null);
    expect(
      await verifyCredentials({ email: safeAdmin.email, password }),
    ).toBeNull();
  });

  it("rejects an inactive admin even with a correct password", async () => {
    findAdmin.mockResolvedValue({
      ...safeAdmin,
      status: "INACTIVE",
      passwordHash,
    });
    expect(
      await verifyCredentials({ email: safeAdmin.email, password }),
    ).toBeNull();
  });

  it.each([
    undefined,
    {},
    { email: "", password: "" },
    { email: "invalid", password },
    { email: safeAdmin.email, password: "" },
    { email: safeAdmin.email, password: "a".repeat(73) },
    { email: safeAdmin.email, password: "😀".repeat(19) },
  ])(
    "rejects missing, malformed, or truncated-bcrypt input without a query (%j)",
    async (input) => {
      expect(await verifyCredentials(input)).toBeNull();
      expect(findAdmin).not.toHaveBeenCalled();
    },
  );

  it("preserves password whitespace", () => {
    expect(
      credentialsSchema.parse({ email: safeAdmin.email, password: " pass " })
        .password,
    ).toBe(" pass ");
  });
});
