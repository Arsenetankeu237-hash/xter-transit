import { NextResponse, type NextRequest } from "next/server";
import { processWebhook } from "@/lib/integrations";

/**
 * Webhook transporteur entrant : POST /api/webhooks/tracking/{integrationId}
 * Authentification (selon la configuration de l'intégration) :
 *   - en-tête x-webhook-secret : secret partagé (comparaison à temps constant) ;
 *   - ou en-tête x-signature : sha256=HMAC-SHA256(corps brut, secret).
 * Idempotence : les événements portant un externalId déjà traité sont ignorés.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const rawBody = await req.text();

  // Limite de taille défensive
  if (rawBody.length > 512 * 1024) {
    return NextResponse.json({ error: "Corps trop volumineux." }, { status: 413 });
  }

  const result = await processWebhook(id, rawBody, req.headers);
  return NextResponse.json(
    { ok: result.ok, message: result.message },
    { status: result.status }
  );
}
