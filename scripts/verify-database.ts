import "dotenv/config";
import assert from "node:assert/strict";
import { createDatabaseClient } from "../src/lib/database-client";
import { verifySeedData } from "./verify-seed-data";

async function main() {
  if (!process.env.DATABASE_URL || !process.env.SEED_ADMIN_EMAIL)
    throw new Error("Set DATABASE_URL and SEED_ADMIN_EMAIL.");
  const db = createDatabaseClient(process.env.DATABASE_URL);
  try {
    const result = await db.$queryRaw<
      Array<{ database: string }>
    >`SELECT current_database() AS database`;
    assert(result[0]?.database);
    const counts = await verifySeedData(
      db,
      process.env.SEED_ADMIN_EMAIL.trim().toLowerCase(),
    );
    console.log("Database verification passed:", {
      database: result[0].database,
      ...counts,
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Database verification failed. Check migrations, seed data and the configured local connection. Credentials were not logged.",
  );
  process.exitCode = 1;
});
