"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { nextQuoteNumber, nextInvoiceNumber } from "@/lib/numbering";
import { computeQuote } from "@/lib/quotes";
import { recordPayment, confirmPayment, computeTotals, parseLines, type InvoiceLine } from "@/lib/invoices";
import { dispatchNotifications } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { formatMoney, formatDate } from "@/lib/format";
import { FormState, zodFieldErrors, optionalString, optionalNumber, optionalDate } from "@/lib/form";

// ---------------------------------------------------------------------------
// Devis
// ---------------------------------------------------------------------------

export async function calculateQuoteAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const quoteId = String(formData.get("quoteId") ?? "");
    const quote = await db.quote.findUnique({ where: { id: quoteId } });
    if (!quote) return { error: "Devis introuvable." };

    const settings = await getSettings();
    const computation = await computeQuote(
      {
        mode: quote.mode as "AIR" | "SEA",
        originCountry: quote.originCountry,
        destCountry: quote.destCountry,
        weightKg: optionalNumber(formData, "weightKg") ?? quote.weightKg,
        lengthCm: optionalNumber(formData, "lengthCm") ?? quote.lengthCm,
        widthCm: optionalNumber(formData, "widthCm") ?? quote.widthCm,
        heightCm: optionalNumber(formData, "heightCm") ?? quote.heightCm,
        volumeM3: optionalNumber(formData, "volumeM3") ?? quote.volumeM3,
      },
      settings
    );

    await db.quote.update({
      where: { id: quoteId },
      data: {
        weightKg: optionalNumber(formData, "weightKg") ?? quote.weightKg,
        lengthCm: optionalNumber(formData, "lengthCm") ?? quote.lengthCm,
        widthCm: optionalNumber(formData, "widthCm") ?? quote.widthCm,
        heightCm: optionalNumber(formData, "heightCm") ?? quote.heightCm,
        volumeM3: optionalNumber(formData, "volumeM3") ?? quote.volumeM3,
        lines: JSON.stringify(computation.lines),
        currency: computation.currency,
        total: computation.total,
        status: quote.status === "NEW" ? "PROCESSING" : quote.status,
        validUntil: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "QUOTE_CALCULATE", entity: "Quote", entityId: quoteId, after: computation });
    revalidatePath(`/admin/devis/${quoteId}`);
    const warnings = computation.warnings.length ? " Avertissements : " + computation.warnings.join(" ") : "";
    return { ok: true, message: `Calcul effectué : ${formatMoney(computation.total, computation.currency)} (estimation).${warnings}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

/** Mise à jour manuelle des lignes (l'agent garde la main sur le chiffrage). */
export async function updateQuoteLinesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const quoteId = String(formData.get("quoteId") ?? "");
    const quote = await db.quote.findUnique({ where: { id: quoteId } });
    if (!quote) return { error: "Devis introuvable." };

    const lines: InvoiceLine[] = [];
    let i = 0;
    while (formData.has(`line_label_${i}`)) {
      const label = String(formData.get(`line_label_${i}`) ?? "").trim();
      const qty = Number(String(formData.get(`line_qty_${i}`) ?? "0").replace(",", ".")) || 0;
      const unitPrice = Number(String(formData.get(`line_price_${i}`) ?? "0").replace(",", ".")) || 0;
      if (label) lines.push({ label, qty, unitPrice, amount: Math.round(qty * unitPrice * 100) / 100 });
      i++;
    }
    // ligne libre supplémentaire
    const newLabel = optionalString(formData, "new_label");
    const newQty = optionalNumber(formData, "new_qty") ?? 1;
    const newPrice = optionalNumber(formData, "new_price") ?? 0;
    if (newLabel && newPrice > 0) {
      lines.push({ label: newLabel, qty: newQty, unitPrice: newPrice, amount: Math.round(newQty * newPrice * 100) / 100 });
    }

    if (lines.length === 0) return { error: "Au moins une ligne est requise." };
    const currency = optionalString(formData, "currency") ?? quote.currency ?? "XAF";
    const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;

    await db.quote.update({
      where: { id: quoteId },
      data: {
        lines: JSON.stringify(lines),
        currency,
        total,
        subtotal: total,
        status: quote.status === "NEW" ? "PROCESSING" : quote.status,
        validUntil: quote.validUntil ?? new Date(Date.now() + 30 * 24 * 3600 * 1000),
      },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "QUOTE_UPDATE_LINES", entity: "Quote", entityId: quoteId, before: { lines: quote.lines, total: quote.total }, after: { lines, total } });
    revalidatePath(`/admin/devis/${quoteId}`);
    return { ok: true, message: `Devis mis à jour : ${formatMoney(total, currency)}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function setQuoteStatusAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const quoteId = String(formData.get("quoteId") ?? "");
    const status = String(formData.get("status") ?? "");
    const allowed = ["NEW", "PROCESSING", "SENT", "ACCEPTED", "REFUSED", "EXPIRED", "INVOICED"];
    if (!allowed.includes(status)) return { error: "Statut invalide." };
    const quote = await db.quote.findUnique({ where: { id: quoteId }, include: { customer: { include: { users: { where: { active: true } } } } } });
    if (!quote) return { error: "Devis introuvable." };
    if (status === "SENT" && (quote.total == null || quote.total === 0)) {
      return { error: "Impossible d'envoyer un devis non chiffré." };
    }

    await db.quote.update({ where: { id: quoteId }, data: { status } });
    await logAudit({ userId: user.id, userName: user.name, action: "QUOTE_STATUS", entity: "Quote", entityId: quoteId, before: { status: quote.status }, after: { status } });

    if (status === "SENT" && quote.customer) {
      await dispatchNotifications(
        "quote_sent",
        {
          quoteNumber: quote.number,
          amount: formatMoney(quote.total ?? 0, quote.currency ?? "XAF"),
          validUntil: formatDate(quote.validUntil),
        },
        {
          customerId: quote.customerId,
          userIds: quote.customer.users.map((u) => u.id),
          to: quote.customer.email ?? undefined,
        }
      );
    }
    revalidatePath(`/admin/devis/${quoteId}`);
    revalidatePath("/admin/devis");
    return { ok: true, message: `Statut du devis : ${status}.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function assignQuoteCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const quoteId = String(formData.get("quoteId") ?? "");
    const customerId = optionalString(formData, "customerId");
    await db.quote.update({ where: { id: quoteId }, data: { customerId } });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "Quote", entityId: quoteId, after: { customerId } });
    revalidatePath(`/admin/devis/${quoteId}`);
    return { ok: true, message: customerId ? "Devis rattaché à un client." : "Client détaché." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

/** Conversion d'un devis accepté en facture. */
export async function quoteToInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("finance:manage");
    const quoteId = String(formData.get("quoteId") ?? "");
    const quote = await db.quote.findUnique({ where: { id: quoteId } });
    if (!quote) return { error: "Devis introuvable." };
    if (!quote.customerId) return { error: "Rattachez d'abord le devis à un client." };
    if (quote.total == null || quote.total === 0) return { error: "Devis non chiffré." };
    if (quote.status !== "ACCEPTED") return { error: "Seul un devis accepté peut être facturé." };

    const existing = await db.invoice.findFirst({ where: { quoteId } });
    if (existing) return { error: `Ce devis est déjà facturé (${existing.number}).` };

    const lines = parseLines(quote.lines);
    const totals = computeTotals(lines, null);
    const number = await nextInvoiceNumber(db);
    const invoice = await db.invoice.create({
      data: {
        number,
        customerId: quote.customerId,
        quoteId,
        status: "ISSUED",
        currency: quote.currency ?? "XAF",
        lines: JSON.stringify(lines),
        subtotal: totals.subtotal,
        total: totals.total,
        issuedAt: new Date(),
        dueAt: new Date(Date.now() + 15 * 24 * 3600 * 1000),
      },
      select: { id: true, number: true },
    });
    await db.quote.update({ where: { id: quoteId }, data: { status: "INVOICED" } });
    await logAudit({ userId: user.id, userName: user.name, action: "QUOTE_TO_INVOICE", entity: "Invoice", entityId: invoice.id, after: { number: invoice.number, quoteId } });
    revalidatePath(`/admin/devis/${quoteId}`);
    return { ok: true, message: `Facture ${invoice.number} générée.`, redirectTo: `/admin/factures/${invoice.id}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Factures
// ---------------------------------------------------------------------------

export async function createInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("finance:manage");
    const customerId = String(formData.get("customerId") ?? "");
    if (!customerId) return { error: "Client requis." };
    const customer = await db.customer.findUnique({ where: { id: customerId } });
    if (!customer) return { error: "Client introuvable." };

    const lines: InvoiceLine[] = [];
    let i = 0;
    while (formData.has(`line_label_${i}`)) {
      const label = String(formData.get(`line_label_${i}`) ?? "").trim();
      const qty = Number(String(formData.get(`line_qty_${i}`) ?? "0").replace(",", ".")) || 0;
      const unitPrice = Number(String(formData.get(`line_price_${i}`) ?? "0").replace(",", ".")) || 0;
      if (label && unitPrice > 0) lines.push({ label, qty, unitPrice, amount: Math.round(qty * unitPrice * 100) / 100 });
      i++;
    }
    if (lines.length === 0) return { error: "Au moins une ligne est requise." };

    const currency = optionalString(formData, "currency") ?? "XAF";
    const taxRate = optionalNumber(formData, "taxRate");
    const totals = computeTotals(lines, taxRate);
    const number = await nextInvoiceNumber(db);
    const invoice = await db.invoice.create({
      data: {
        number,
        customerId,
        status: "ISSUED",
        currency,
        lines: JSON.stringify(lines),
        subtotal: totals.subtotal,
        taxRate: taxRate,
        taxAmount: totals.taxAmount,
        total: totals.total,
        issuedAt: new Date(),
        dueAt: optionalDate(formData, "dueAt") ?? new Date(Date.now() + 15 * 24 * 3600 * 1000),
        notes: optionalString(formData, "notes"),
      },
      select: { id: true, number: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "Invoice", entityId: invoice.id, after: { number: invoice.number, total: totals.total, currency } });
    revalidatePath("/admin/factures");
    return { ok: true, message: `Facture ${invoice.number} émise.`, redirectTo: `/admin/factures/${invoice.id}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function recordPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("finance:manage");
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const method = String(formData.get("method") ?? "");
    if (!["CASH", "BANK_TRANSFER", "MOBILE_MONEY", "ONLINE"].includes(method)) return { error: "Moyen de paiement invalide." };
    const amount = optionalNumber(formData, "amount");
    if (!amount || amount <= 0) return { error: "Montant invalide." };
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId } });
    if (!invoice) return { error: "Facture introuvable." };

    // ONLINE : enregistré PENDING, confirmé uniquement par le prestataire (webhook)
    const result = await recordPayment({
      invoiceId,
      method,
      amount,
      currency: invoice.currency,
      reference: optionalString(formData, "reference"),
      notes: optionalString(formData, "notes"),
      manualConfirm: method !== "ONLINE",
      agent: { id: user.id, name: user.name },
    });
    if (!result.ok) return { error: result.error };
    revalidatePath(`/admin/factures/${invoiceId}`);
    return {
      ok: true,
      message: method === "ONLINE"
        ? "Paiement en ligne enregistré en attente — il sera confirmé par le prestataire."
        : "Paiement enregistré et confirmé.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function confirmPaymentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("finance:manage");
    const paymentId = String(formData.get("paymentId") ?? "");
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const result = await confirmPayment(paymentId, { userId: user.id, userName: user.name });
    if (!result.ok) return { error: result.error };
    revalidatePath(`/admin/factures/${invoiceId}`);
    return { ok: true, message: "Paiement confirmé." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function cancelInvoiceAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("finance:manage");
    const invoiceId = String(formData.get("invoiceId") ?? "");
    const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { payments: true } });
    if (!invoice) return { error: "Facture introuvable." };
    const confirmed = invoice.payments.filter((p) => p.status === "CONFIRMED");
    if (confirmed.length > 0) return { error: "Facture avec paiements confirmés : émettre un avoir plutôt qu'annuler." };
    await db.invoice.update({ where: { id: invoiceId }, data: { status: "CANCELLED" } });
    await logAudit({ userId: user.id, userName: user.name, action: "CANCEL", entity: "Invoice", entityId: invoiceId, before: { status: invoice.status } });
    revalidatePath(`/admin/factures/${invoiceId}`);
    return { ok: true, message: "Facture annulée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Grilles tarifaires
// ---------------------------------------------------------------------------

export async function createRateTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const schema = z.object({
      name: z.string().trim().min(2, "Nom requis").max(120),
      mode: z.enum(["AIR", "SEA"]),
      currency: z.string().trim().min(3).max(8),
    });
    const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };

    const table = await db.rateTable.create({
      data: {
        name: parsed.data.name,
        mode: parsed.data.mode,
        currency: parsed.data.currency.toUpperCase(),
        originCountry: optionalString(formData, "originCountry"),
        destCountry: optionalString(formData, "destCountry"),
        validFrom: optionalDate(formData, "validFrom"),
        validTo: optionalDate(formData, "validTo"),
        notes: optionalString(formData, "notes"),
      },
      select: { id: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "RateTable", entityId: table.id, after: parsed.data });
    revalidatePath("/admin/devis");
    return { ok: true, message: "Grille tarifaire créée — ajoutez maintenant ses lignes." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function addRateLineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const rateTableId = String(formData.get("rateTableId") ?? "");
    const basis = String(formData.get("basis") ?? "");
    const label = optionalString(formData, "label") ?? basis;
    const unitPrice = optionalNumber(formData, "unitPrice");
    const fixedAmount = optionalNumber(formData, "fixedAmount");
    const minAmount = optionalNumber(formData, "minAmount");
    if (!unitPrice && !fixedAmount && !minAmount) return { error: "Renseignez un prix unitaire, un montant fixe ou un minimum." };

    const line = await db.rateLine.create({
      data: { rateTableId, basis, label, unitPrice, fixedAmount, minAmount, notes: optionalString(formData, "notes") },
      select: { id: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "RateLine", entityId: line.id, after: { basis, label, unitPrice, fixedAmount, minAmount } });
    revalidatePath("/admin/devis");
    return { ok: true, message: "Ligne tarifaire ajoutée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function deleteRateLineAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const lineId = String(formData.get("lineId") ?? "");
    const line = await db.rateLine.findUnique({ where: { id: lineId } });
    if (!line) return { error: "Ligne introuvable." };
    await db.rateLine.delete({ where: { id: lineId } });
    await logAudit({ userId: user.id, userName: user.name, action: "DELETE", entity: "RateLine", entityId: lineId, before: line });
    revalidatePath("/admin/devis");
    return { ok: true, message: "Ligne supprimée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function toggleRateTableAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("quotes:manage");
    const tableId = String(formData.get("tableId") ?? "");
    const table = await db.rateTable.findUnique({ where: { id: tableId } });
    if (!table) return { error: "Grille introuvable." };
    await db.rateTable.update({ where: { id: tableId }, data: { active: !table.active } });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "RateTable", entityId: tableId, after: { active: !table.active } });
    revalidatePath("/admin/devis");
    return { ok: true, message: table.active ? "Grille désactivée." : "Grille activée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
