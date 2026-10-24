import { NextResponse, type NextRequest } from "next/server";
import { publicTrack } from "@/lib/tracking";
import { rateLimit } from "@/lib/rate-limit";

/**
 * API publique de suivi : GET /api/public/track/{numero}
 * Réponse limitée aux données non sensibles (aucune adresse ni contact).
 * Limitée à 30 requêtes / minute / IP.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ number: string }> }) {
  const { number } = await ctx.params;
  const ip = _req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = rateLimit(`api-track:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "Trop de requêtes. Réessayez dans " + rl.retryAfterSec + " secondes." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const result = await publicTrack(decodeURIComponent(number));
  if (!result) {
    return NextResponse.json({ error: "Colis introuvable." }, { status: 404 });
  }
  return NextResponse.json(result);
}
