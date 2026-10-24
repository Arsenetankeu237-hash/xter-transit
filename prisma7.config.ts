import "dotenv/config";
import path from "node:path";
import { defineConfig } from "prisma/config";

// Résout les URLs SQLite relatives par rapport à la racine du projet,
// pour que CLI (migrations) et runtime (application) pointent vers le même fichier.
function resolveUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  if (url.startsWith("file:")) {
    const rel = url.slice("file:".length);
    return "file:" + path.resolve(process.cwd(), rel);
  }
  return url;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: resolveUrl(process.env["DATABASE_URL"]),
  },
});
