import { randomBytes } from "node:crypto";
import { hash } from "bcryptjs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getDb } from "../src/lib/db";
import { verifyCredentials } from "../src/modules/auth/credentials";
import { requireAdmin, requireRole } from "../src/modules/auth/authorization";

const { readSession } = vi.hoisted(() => ({ readSession: vi.fn() }));
vi.mock("@/auth", () => ({ auth: readSession }));

const connectionString = process.env.DATABASE_TEST_URL;
if (!connectionString || connectionString !== process.env.DATABASE_URL)
  throw new Error("Run with npm run test:db.");
const target = new URL(connectionString);
if (
  !["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
  !/^\/resource_directory_test_[a-f0-9]+$/.test(target.pathname)
)
  throw new Error("A disposable local test database is required.");

const password = randomBytes(24).toString("hex");
const email = `auth-${randomBytes(8).toString("hex")}@example.com`;
let adminId: string;

beforeAll(async () => {
  const admin = await getDb().adminUser.create({
    data: {
      name: "Authentication fixture",
      email,
      passwordHash: await hash(password, 12),
      role: "ADMIN",
      status: "ACTIVE",
    },
  });
  adminId = admin.id;
  readSession.mockResolvedValue({ user: { id: adminId, role: "SUPER_ADMIN" } });
});
afterAll(async () => {
  await getDb().$disconnect();
});

describe("authentication against PostgreSQL", () => {
  it("verifies bcrypt credentials and current role, then denies a disabled or deleted account", async () => {
    const admin = await verifyCredentials({
      email: ` ${email.toUpperCase()} `,
      password,
    });
    expect(admin?.id).toBe(adminId);
    expect(admin).not.toHaveProperty("passwordHash");
    expect(
      await verifyCredentials({ email, password: "incorrect" }),
    ).toBeNull();
    expect((await requireAdmin()).id).toBe(adminId);
    await expect(requireRole("SUPER_ADMIN")).rejects.toMatchObject({
      status: 403,
    });

    await getDb().adminUser.update({
      where: { id: adminId },
      data: { role: "SUPER_ADMIN" },
    });
    expect((await requireRole("SUPER_ADMIN")).role).toBe("SUPER_ADMIN");
    await getDb().adminUser.update({
      where: { id: adminId },
      data: { status: "INACTIVE" },
    });
    expect(await verifyCredentials({ email, password })).toBeNull();
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
    await getDb().adminUser.delete({ where: { id: adminId } });
    await expect(requireAdmin()).rejects.toMatchObject({ status: 401 });
  });
});
