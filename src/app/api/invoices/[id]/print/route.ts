import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseLines } from "@/lib/invoices";
import { getSettings } from "@/lib/settings";
import { formatMoney, formatDate } from "@/lib/format";

/**
 * Facture / reçu imprimable (HTML A4 — « Imprimer → Enregistrer en PDF » du navigateur).
 * Accès : équipe habilitée ou client propriétaire de la facture.
 * Document interne : il n'est valable ni comme facture fiscale officielle ni comme
 * document de transport tant que l'entreprise ne l'a pas validé.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Non authentifié." }, { status: 401 });

  const { id } = await ctx.params;
  const invoice = await db.invoice.findUnique({
    where: { id },
    include: { customer: true, payments: { where: { status: "CONFIRMED" }, orderBy: { confirmedAt: "asc" } } },
  });
  if (!invoice) return NextResponse.json({ error: "Facture introuvable." }, { status: 404 });
  if (user.role === "CLIENT" && invoice.customerId !== user.customerId) {
    return NextResponse.json({ error: "Accès refusé." }, { status: 403 });
  }

  const s = await getSettings();
  const lines = parseLines(invoice.lines);
  const paid = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
  const balance = Math.max(0, invoice.total - paid);
  const fmt = (n: number) => formatMoney(n, invoice.currency);
  const escapeHtml = (str: string) =>
    str.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${invoice.number} — ${s.brandName}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, Helvetica, sans-serif; color: #0d1c31; background: #f6f8fb; padding: 24px; }
  .page { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; }
  header { display: flex; justify-content: space-between; border-bottom: 3px solid #0d1c31; padding-bottom: 16px; }
  h1 { font-size: 20px; }
  .muted { color: #64748b; font-size: 12px; }
  .orange { color: #ea580c; font-weight: bold; }
  table { width: 100%; border-collapse: collapse; margin-top: 24px; font-size: 13px; }
  th { text-align: left; background: #f1f5f9; padding: 8px; font-size: 11px; text-transform: uppercase; color: #475569; }
  td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
  .totals { margin-top: 16px; margin-left: auto; width: 300px; font-size: 13px; }
  .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
  .totals .grand { font-weight: bold; font-size: 16px; border-top: 2px solid #0d1c31; padding-top: 8px; }
  .box { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-top: 24px; font-size: 12px; }
  .cols { display: flex; gap: 24px; margin-top: 24px; font-size: 12px; }
  .cols > div { flex: 1; }
  footer { margin-top: 32px; font-size: 10px; color: #94a3b8; text-align: center; }
  .print-btn { display: block; margin: 0 auto 16px; padding: 10px 24px; background: #234166; color: #fff; border: 0; border-radius: 6px; font-size: 14px; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .print-btn { display: none; } .page { padding: 0; } @page { size: A4; margin: 14mm; } }
</style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">Imprimer / Enregistrer en PDF</button>
  <div class="page">
    <header>
      <div>
        <img src="/logo.png" alt="${s.brandName}" style="height:52px;width:auto" />
        <p class="muted">${s.contactAddress}</p>
        <p class="muted">${s.contactPhone ? "Tél : " + s.contactPhone : ""} ${s.contactEmail ? " · " + s.contactEmail : ""}</p>
      </div>
      <div style="text-align:right">
        <h1 class="orange">${invoice.status === "PAID" ? "REÇU / FACTURE ACQUITTÉE" : "FACTURE"}</h1>
        <p class="muted">N° <strong>${invoice.number}</strong></p>
        <p class="muted">Émise le ${formatDate(invoice.issuedAt ?? invoice.createdAt)}</p>
        ${invoice.dueAt ? `<p class="muted">Échéance : ${formatDate(invoice.dueAt)}</p>` : ""}
      </div>
    </header>

    <div class="cols">
      <div>
        <p class="muted"><strong>CLIENT</strong></p>
        <p>${invoice.customer.name}</p>
        <p class="muted">${invoice.customer.addressLine ?? ""}</p>
        <p class="muted">${invoice.customer.city ?? ""}${invoice.customer.country ? ", " + invoice.customer.country : ""}</p>
        <p class="muted">${invoice.customer.phone ?? ""}</p>
        <p class="muted">${invoice.customer.email ?? ""}</p>
      </div>
      <div>
        <p class="muted"><strong>INFORMATIONS</strong></p>
        <p class="muted">Devise : ${invoice.currency}</p>
        <p class="muted">Code client : ${invoice.customer.code}</p>
      </div>
    </div>

    <table>
      <thead><tr><th>Désignation</th><th style="text-align:right">Qté</th><th style="text-align:right">P.U.</th><th style="text-align:right">Montant</th></tr></thead>
      <tbody>
        ${lines.map((l) => `<tr><td>${escapeHtml(l.label)}</td><td style="text-align:right">${l.qty}</td><td style="text-align:right">${fmt(l.unitPrice)}</td><td style="text-align:right">${fmt(l.amount)}</td></tr>`).join("")}
      </tbody>
    </table>

    <div class="totals">
      <div><span>Sous-total</span><span>${fmt(invoice.subtotal)}</span></div>
      ${invoice.taxRate ? `<div><span>TVA (${invoice.taxRate}%)</span><span>${fmt(invoice.taxAmount ?? 0)}</span></div>` : ""}
      <div class="grand"><span>Total</span><span>${fmt(invoice.total)}</span></div>
      <div><span>Payé</span><span>${fmt(paid)}</span></div>
      <div><span><strong>Solde restant</strong></span><span><strong>${fmt(balance)}</strong></span></div>
    </div>

    ${invoice.payments.length > 0 ? `
    <div class="box">
      <p><strong>Règlements enregistrés</strong></p>
      ${invoice.payments.map((p) => `<p>${formatDate(p.confirmedAt)} — ${p.method === "CASH" ? "Espèces" : p.method === "BANK_TRANSFER" ? "Virement" : p.method === "MOBILE_MONEY" ? "Mobile Money" : "Paiement en ligne"} — ${fmt(p.amount)}${p.reference ? " (réf. " + escapeHtml(p.reference) + ")" : ""}</p>`).join("")}
    </div>` : ""}

    ${invoice.notes ? `<div class="box">${escapeHtml(invoice.notes)}</div>` : ""}

    <footer>
      Document interne généré par la plateforme ${s.brandName}.
      ${invoice.status === "PAID" ? "Facture acquittée des règlements listés ci-dessus." : ""}
      Mentions légales, conditions de paiement et voies de recours figurent dans les conditions générales disponibles sur demande.
    </footer>
  </div>
</body>
</html>`;

  return new NextResponse(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
