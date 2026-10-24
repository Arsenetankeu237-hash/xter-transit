/** Renommage de la base existante : ALT Transit → XTER Transit (marque, slogan, préfixe, e-mail admin). */
import { PrismaClient } from "../src/generated/prisma/client";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const file = url.startsWith("file:") ? path.resolve(process.cwd(), url.slice("file:".length)) : url;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:" + file }) });

async function main() {
  const changes: Record<string, string> = {
    brandName: "XTER Transit",
    brandTagline: "Vos colis, notre destination",
    brandDescription:
      "Transitaire international : réception, expédition et suivi de vos colis et marchandises par fret aérien et maritime, vers et depuis le monde entier.",
    trackingPrefix: "XTER",
    aboutText:
      "Présentation de l'entreprise à compléter dans les paramètres. XTER Transit organise l'acheminement de colis et marchandises partout dans le monde, par fret aérien et maritime.",
  };
  for (const [key, value] of Object.entries(changes)) {
    await prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }
  console.log("✓ Paramètres de marque mis à jour (XTER Transit, préfixe XTER)");

  const admin = await prisma.user.findUnique({ where: { email: "admin@alt-transit.local" } });
  if (admin) {
    await prisma.user.update({ where: { id: admin.id }, data: { email: "admin@xter-transit.local" } });
    console.log("✓ E-mail administrateur : admin@xter-transit.local");
  } else {
    const existing = await prisma.user.findUnique({ where: { email: "admin@xter-transit.local" } });
    console.log(existing ? "• E-mail admin déjà à jour" : "• Aucun compte admin par défaut trouvé");
  }
  await prisma.session.deleteMany({});
  console.log("• Sessions invalidées (cookie renommé xter_session) — reconnexion nécessaire");
}

main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
