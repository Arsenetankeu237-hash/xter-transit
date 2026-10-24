import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { readDocumentFile } from "@/lib/documents";

/**
 * Accès aux fichiers du stockage privé — toujours après vérification :
 * - staff habilité : accès aux documents internes ;
 * - client : uniquement les documents marqués CLIENT liés à son compte ;
 * - preuves de livraison (photo / signature) : staff uniquement.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await ctx.params;
  const doc = await db.document.findUnique({
    where: { id },
    include: {
      package: { select: { customerId: true } },
      invoice: { select: { customerId: true } },
      quote: { select: { customerId: true } },
    },
  });
  if (!doc) return NextResponse.json({ error: "Document introuvable." }, { status: 404 });

  if (user.role === "CLIENT") {
    if (doc.visibility !== "CLIENT") return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    const ownerCustomerId = doc.customerId ?? doc.package?.customerId ?? doc.invoice?.customerId ?? doc.quote?.customerId;
    if (!user.customerId || ownerCustomerId !== user.customerId) {
      return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
    }
  }

  try {
    const buffer = await readDocumentFile(doc.storedName);
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": doc.mime,
        "Content-Disposition": `inline; filename="${encodeURIComponent(doc.fileName)}"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Fichier indisponible." }, { status: 410 });
  }
}
