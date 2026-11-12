import "dotenv/config";
import { randomBytes } from "node:crypto";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Client } from "pg";

const resolveModule = createRequire(import.meta.url);

async function run(file: string, args: string[], env: NodeJS.ProcessEnv) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(
      process.execPath,
      ["--conditions=react-server", file, ...args],
      {
        stdio: "inherit",
        env,
        windowsHide: true,
      },
    );
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`Database test command exited ${code}.`)),
    );
  });
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
  const local = new URL(process.env.DATABASE_URL);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(local.hostname))
    throw new Error(
      "Database integration tests only run on a local PostgreSQL server.",
    );
  const databaseName = `resource_directory_test_${randomBytes(8).toString("hex")}`;
  const vitestCli = join(
    dirname(resolveModule.resolve("vitest/package.json")),
    "vitest.mjs",
  );
  const testUrl = new URL(local);
  testUrl.pathname = `/${databaseName}`;
  const adminUrl = new URL(local);
  adminUrl.pathname = "/postgres";
  const admin = new Client({
    connectionString: adminUrl.toString(),
    connectionTimeoutMillis: 5000,
  });
  let created = false;
  try {
    await admin.connect();
    await admin.query(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const env = {
      ...process.env,
      DATABASE_URL: testUrl.toString(),
      DATABASE_TEST_URL: testUrl.toString(),
    };
    await run(
      resolveModule.resolve("prisma/build/index.js"),
      ["migrate", "deploy"],
      env,
    );
    await run(
      vitestCli,
      ["run", "--config", "vitest.database.config.mts"],
      env,
    );
  } finally {
    // Only remove the random database created by this invocation, never the configured app database.
    if (created)
      await admin.query(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await admin.end();
  }
}

main().catch((error: unknown) => {
  const code =
    error !== null &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "TEST_FAILURE";
  console.error(
    `Database integration checks failed (${code}). Check preceding test output, the local connection and CREATEDB permission.`,
  );
  process.exitCode = 1;
});
