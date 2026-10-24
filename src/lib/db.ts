import { createPrismaClient } from "./db-factory";

const globalForPrisma = globalThis as unknown as { __altDb?: ReturnType<typeof createPrismaClient> };

export const db = globalForPrisma.__altDb ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__altDb = db;
}
