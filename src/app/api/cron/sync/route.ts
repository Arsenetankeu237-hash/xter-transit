import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { runSync } from "@/lib/integrations";

/**
 * Synchronisation planifiée : GET/POST /api/cron/sync
 * Protégé par CRON_SECRET (en-tête Authorization: Bearer <secret> ou ?secret=).
 * À appeler périodiquement (ex. toutes les 15 min) par un planificateur externe
 * (cron, systemd timer, Vercel Cron…) si des intégrations "polling" sont actives.
 */
async function handle(req: NextRequest): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret === "changer-cette-valeur-en-production") {
    return NextResponse.json({ error: "CRON_SECRET non configuré." }, { status: 503 });
  }
  const provided =
    req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(req.url).searchParams.get("secret") ??
    "";
  if (provided !== secret) {
    return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
  }

  const integrations = await db.providerIntegration.findMany({
    where: { enabled: true },
    select: { id: true, adapterKey: true },
  });
  const pollable = integrations.filter((i) => i.adapterKey === "generic-rest");
  if (pollable.length === 0) {
    return NextResponse.json({ message: "Aucune intégration de synchronisation active.", results: [] });
  }

  const results = [];
  for (const i of pollable) {
    const report = await runSync(i.id, "CRON");
    results.push({ integrationId: i.id, ...report, error: report.error ?? undefined });
  }
  return NextResponse.json({ message: "Synchronisation terminée.", results });
}

export async function GET(req: NextRequest) {
  return handle(req);
}
export async function POST(req: NextRequest) {
  return handle(req);
}
