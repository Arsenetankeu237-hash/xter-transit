/**
 * Fabrique PrismaClient (Prisma 7 — architecture driver adapter).
 *
 * Développement : SQLite via better-sqlite3 (aucune dépendance externe).
 * Production PostgreSQL : installer `@prisma/adapter-pg` puis activer la
 * branche PG ci-dessous (voir README §Déploiement).
 */
import path from "node:path";
import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

export type Client = InstanceType<typeof PrismaClient>;

export function createPrismaClient(opts?: { log?: boolean }): Client {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  const log = opts?.log ? ["warn", "error"] : ["error"];

  if (url.startsWith("file:")) {
    const file = path.resolve(process.cwd(), url.slice("file:".length));
    const adapter = new PrismaBetterSqlite3({ url: "file:" + file });
    return new PrismaClient({ adapter, log: log as never });
  }

  // --- Production PostgreSQL ---
  // 1) npm install @prisma/adapter-pg
  // 2) Décommentez le bloc suivant :
  // import { PrismaPg } from "@prisma/adapter-pg";
  // const adapter = new PrismaPg({ connectionString: url });
  // return new PrismaClient({ adapter, log });
  throw new Error(
    "DATABASE_URL pointe vers " + url +
    " mais seul SQLite est configuré. Installez @prisma/adapter-pg et activez la branche PostgreSQL dans src/lib/db-factory.ts (voir README)."
  );
}
