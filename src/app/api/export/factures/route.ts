import { NextResponse } from "next/server";
import { actionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logAudit } from "@/lib/audit";

/** Export CSV des factures et paiements (autorisation finance:manage requise). */
export async function GET() {
  const user = await actionUser("finance:manage");
  const invoices = await db.invoice.findMany({
    orderBy: { createdAt: "desc" },
    include: { customer: { select: { code: true, name: true } }, payments: true },
  });

  const header = ["N° facture", "Client", "Statut", "Devise", "Sous-total", "TVA", "Total", "Payé", "Solde", "Émise le", "Échéance", "Paiements"];
  const rows = invoices.map((i) => {
    const paid = i.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);
    const payments = i.payments
      .filter((p) => p.status === "CONFIRMED")
      .map((p) => `${p.method}:${p.amount}${p.reference ? "(réf " + p.reference + ")" : ""}`)
      .join(" | ");
    return [
      i.number,
      `${i.customer.code} ${i.customer.name}`,
      i.status,
      i.currency,
      i.subtotal.toFixed(2),
      (i.taxAmount ?? 0).toFixed(2),
      i.total.toFixed(2),
      paid.toFixed(2),
      Math.max(0, i.total - paid).toFixed(2),
      (i.issuedAt ?? i.createdAt).toISOString(),
      i.dueAt?.toISOString() ?? "",
      payments,
    ];
  });

  const csv = "\uFEFF" + [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\r\n");
  await logAudit({ userId: user.id, userName: user.name, action: "EXPORT", entity: "Invoice", after: { count: invoices.length, format: "csv" } });
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="factures-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
