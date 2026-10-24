/**
 * Consolidation de la base SQLite : checkpoint WAL complet + vérification d'intégrité.
 * À exécuter SERVEUR ARRÊTÉ (sinon le WAL reste actif).
 * Usage : npx tsx scripts/db-checkpoint.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import path from "node:path";
import Database from "better-sqlite3";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

async function main() {
  const file = path.resolve(process.cwd(), "prisma/dev.db");
  const db = new Database(file);
  const chk = db.pragma("wal_checkpoint(TRUNCATE)") as Array<{ busy: number; log: number; checkpointed: number }>;
  console.log("checkpoint:", JSON.stringify(chk[0]));
  const integrity = (db.pragma("integrity_check") as Array<{ integrity_check: string }>)[0];
  console.log("intégrité:", integrity.integrity_check);
  db.close();

  const p = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:" + file }) });
  console.log("contrôle Prisma → clients:", await p.customer.count(), "| colis:", await p.package.count(), "| utilisateurs:", await p.user.count());
  await p.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
