import "dotenv/config";
import { createDatabaseClient } from "../src/lib/database-client";
import { seedDatabase } from "./seed-database";

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const db = createDatabaseClient(process.env.DATABASE_URL);
  try {
    const result = await seedDatabase(db, {
      email: process.env.SEED_ADMIN_EMAIL,
      password: process.env.SEED_ADMIN_PASSWORD,
      name: process.env.SEED_ADMIN_NAME,
    });
    console.log(
      `Seed complete: survey ${result.surveyId}, version 1, ${result.sampleResourceCount} demo resources.`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error(
    "Seed failed. Check database migrations and SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD (12–72 bytes). Credentials were not logged.",
  );
  process.exitCode = 1;
});
