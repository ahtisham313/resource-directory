import "dotenv/config";
import assert from "node:assert/strict";
import { getDb } from "../src/lib/db";
import { verifyCredentials } from "../src/modules/auth/credentials";

async function main() {
  const target = new URL(process.env.DATABASE_URL ?? "");
  if (!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname)) {
    throw new Error(
      "This verification is for the existing local database only.",
    );
  }
  try {
    assert(process.env.SEED_ADMIN_EMAIL && process.env.SEED_ADMIN_PASSWORD);
    const admin = await verifyCredentials({
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
    });
    assert(admin, "Existing seed credentials did not match an active account.");
    assert(!("passwordHash" in admin));
    console.log(
      "Existing local admin verified: ACTIVE account, valid bcrypt password, role",
      admin.role,
    );
  } finally {
    await getDb().$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Admin verification failed. Check the existing local DATABASE_URL and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. No account or password was changed.",
  );
  process.exitCode = 1;
});
