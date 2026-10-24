import { PrismaClient } from "../src/generated/prisma/client.ts";
import path from "node:path";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const datasourceUrl = url.startsWith("file:")
  ? "file:" + path.resolve(process.cwd(), url.slice("file:".length))
  : url;

const prisma = new PrismaClient({ datasourceUrl });

async function main() {
  const settings = await prisma.setting.count();
  const users = await prisma.user.count();
  console.log("Connexion OK — settings:", settings, "users:", users);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error("ERREUR:", e.message);
  process.exit(1);
});
