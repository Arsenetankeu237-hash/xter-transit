import { NextResponse } from "next/server";
import { actionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/** Export CSV des colis (autorisation packages:manage requise). */
export async function GET() {
  const user = await actionUser("packages:manage");
  const packages = await db.package.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { code: true, name: true } }, shipment: { select: { reference: true } } },
  });

  const header = [
    "N° suivi", "Client", "Mode", "Statut", "Expédition", "Référence", "Pièces",
    "Poids kg", "Poids volumétrique", "Poids taxable", "Dimensions cm",
    "Valeur déclarée", "Devise", "Créé le", "Dernier changement statut", "Archivé",
  ];
  const rows: string[][] = packages.map((p) => [
    p.trackingNumber,
    `${p.customer.code} ${p.customer.name}`,
    p.mode,
    p.status,
    p.shipment?.reference ?? "",
    p.reference ?? "",
    p.pieces != null ? String(p.pieces) : "",
    p.weightKg != null ? String(p.weightKg) : "",
    p.volumetricWeightKg != null ? String(p.volumetricWeightKg) : "",
    p.taxableWeightKg != null ? String(p.taxableWeightKg) : "",
    p.lengthCm ? `${p.lengthCm}x${p.widthCm}x${p.heightCm}` : "",
    p.declaredValue != null ? String(p.declaredValue) : "",
    p.declaredCurrency ?? "",
    p.createdAt.toISOString(),
    p.statusUpdatedAt.toISOString(),
    p.archivedAt ? "oui" : "non",
  ]);

  const csv = toCsv([header, ...rows]);
  await logAudit({ userId: user.id, userName: user.name, action: "EXPORT", entity: "Package", after: { count: packages.length, format: "csv" } });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="colis-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function toCsv(rows: string[][]): string {
  // BOM UTF-8 pour Excel
  return "\uFEFF" + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
}
