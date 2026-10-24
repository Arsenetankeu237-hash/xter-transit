import { NextResponse, type NextRequest } from "next/server";
import { actionUser } from "@/lib/auth";
import { searchFlights, isFlightsConfigured } from "@/lib/flights";
import { rateLimit } from "@/lib/rate-limit";

/**
 * Recherche de vols réels (Amadeus) — réservée à l'équipe habilitée.
 * GET /api/flights/search?from=DLA&to=CDG&date=2026-11-05
 */
export async function GET(req: NextRequest) {
  try {
    await actionUser("shipments:manage");
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Accès refusé." }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = rateLimit(`flights:${ip}`, 20, 60_000);
  if (!rl.ok) {
    return NextResponse.json({ error: `Trop de recherches. Réessayez dans ${rl.retryAfterSec} s.` }, { status: 429 });
  }

  const url = new URL(req.url);
  const from = (url.searchParams.get("from") ?? "").toUpperCase().trim();
  const to = (url.searchParams.get("to") ?? "").toUpperCase().trim();
  const date = (url.searchParams.get("date") ?? "").trim();

  if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
    return NextResponse.json({ error: "Codes aéroport IATA requis (3 lettres), ex : DLA, CDG." }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Date requise au format AAAA-MM-JJ." }, { status: 400 });
  }

  if (!isFlightsConfigured()) {
    return NextResponse.json(
      {
        error:
          "API vols non configurée. Créez un compte gratuit sur developers.amadeus.com, obtenez vos clés Self-Service, puis renseignez AMADEUS_CLIENT_ID et AMADEUS_CLIENT_SECRET dans .env (AMADEUS_ENV=test pour l'environnement d'essai).",
        configured: false,
      },
      { status: 503 }
    );
  }

  try {
    const flights = await searchFlights(from, to, date);
    return NextResponse.json({ ok: true, from, to, date, count: flights.length, flights });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Recherche impossible." },
      { status: 502 }
    );
  }
}
