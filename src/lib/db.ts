import "server-only";
import { createDatabaseClient } from "./database-client";
import type { PrismaClient } from "@/generated/prisma/client";

const globalDatabase = globalThis as typeof globalThis & {
  resourceDirectoryDb?: PrismaClient;
};

export function getDb(): PrismaClient {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required for database operations.");
  }
  // Reuse the pool across development hot reloads, without connecting during build.
  globalDatabase.resourceDirectoryDb ??= createDatabaseClient(
    process.env.DATABASE_URL,
  );
  return globalDatabase.resourceDirectoryDb;
}
