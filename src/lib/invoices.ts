/**
 * Facturation & paiements.
 * Règles : un paiement ONLINE reste PENDING jusqu'à confirmation authentique du
 * prestataire (webhook) ; les paiements manuels (espèces, virement, Mobile Money)
 * sont enregistrés puis confirmés par un agent habilité. Aucune donnée de carte
 * n'est stockée.
 */
import { db } from "./db";
import { logAudit } from "./audit";
import { dispatchNotifications } from "./notifications";
import { formatMoney } from "./format";

export interface InvoiceLine {
  label: string;
  qty: number;
  unitPrice: number;
  amount: number;
}

export function parseLines(json: string | null | undefined): InvoiceLine[] {
  if (!json) return [];
  try {
    const parsed = JSON.parse(json);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function computeTotals(lines: InvoiceLine[], taxRate?: number | null) {
  const subtotal = round(lines.reduce((s, l) => s + l.qty * l.unitPrice, 0));
  const taxAmount = taxRate ? round(subtotal * (taxRate / 100)) : 0;
  return { subtotal, taxAmount, total: round(subtotal + taxAmount) };
}

/** Recalcule le statut d'une facture d'après les paiements confirmés. */
export async function refreshInvoiceStatus(invoiceId: string): Promise<void> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });
  if (!invoice || invoice.status === "CANCELLED" || invoice.status === "DRAFT") return;
  const confirmed = invoice.payments
    .filter((p) => p.status === "CONFIRMED")
    .reduce((s, p) => s + p.amount, 0);
  const status = confirmed <= 0 ? "ISSUED" : confirmed + 0.01 >= invoice.total ? "PAID" : "PARTIAL";
  if (status !== invoice.status) {
    await db.invoice.update({ where: { id: invoiceId }, data: { status } });
  }
}

export async function recordPayment(params: {
  invoiceId: string;
  method: string;
  amount: number;
  currency: string;
  reference?: string | null;
  notes?: string | null;
  /** Paiements manuels : enregistrés puis confirmés immédiatement par l'agent qui les saisit. */
  manualConfirm: boolean;
  agent: { id: string; name: string };
}): Promise<{ ok: boolean; paymentId?: string; error?: string }> {
  const invoice = await db.invoice.findUnique({ where: { id: params.invoiceId } });
  if (!invoice) return { ok: false, error: "Facture introuvable." };
  if (invoice.status === "CANCELLED") return { ok: false, error: "Facture annulée." };

  const confirmed = (await db.payment.aggregate({
    where: { invoiceId: invoice.id, status: "CONFIRMED" },
    _sum: { amount: true },
  }))._sum.amount ?? 0;
  if (params.manualConfirm && confirmed + params.amount > invoice.total + 0.01) {
    return { ok: false, error: `Montant supérieur au solde restant (${formatMoney(invoice.total - confirmed, invoice.currency)}).` };
  }

  const payment = await db.payment.create({
    data: {
      invoiceId: invoice.id,
      method: params.method,
      amount: params.amount,
      currency: params.currency,
      reference: params.reference ?? null,
      notes: params.notes ?? null,
      status: params.manualConfirm ? "CONFIRMED" : "PENDING",
      receivedAt: params.manualConfirm ? new Date() : null,
      confirmedById: params.manualConfirm ? params.agent.id : null,
      confirmedAt: params.manualConfirm ? new Date() : null,
    },
    select: { id: true },
  });

  if (params.manualConfirm) {
    await refreshInvoiceStatus(invoice.id);
    await notifyPaymentReceived(invoice.id, payment.id);
  }

  await logAudit({
    userId: params.agent.id, userName: params.agent.name,
    action: "PAYMENT_RECORDED", entity: "Payment", entityId: payment.id,
    after: { invoiceNumber: invoice.number, amount: params.amount, method: params.method, confirmed: params.manualConfirm },
  });

  return { ok: true, paymentId: payment.id };
}

/** Confirmation d'un paiement en ligne par le prestataire (webhook authentifié) ou par un agent. */
export async function confirmPayment(
  paymentId: string,
  actor: { userId?: string; userName?: string; provider?: boolean },
  providerRef?: string
): Promise<{ ok: boolean; error?: string }> {
  const payment = await db.payment.findUnique({ where: { id: paymentId }, include: { invoice: true } });
  if (!payment) return { ok: false, error: "Paiement introuvable." };
  if (payment.status === "CONFIRMED") return { ok: false, error: "Paiement déjà confirmé." };

  await db.payment.update({
    where: { id: paymentId },
    data: {
      status: "CONFIRMED",
      receivedAt: new Date(),
      confirmedAt: new Date(),
      confirmedById: actor.userId ?? null,
      providerRef: providerRef ?? payment.providerRef,
    },
  });
  await refreshInvoiceStatus(payment.invoiceId);
  await notifyPaymentReceived(payment.invoiceId, paymentId);

  await logAudit({
    userId: actor.userId ?? null, userName: actor.userName ?? (actor.provider ? "Prestataire paiement (webhook)" : undefined),
    action: "PAYMENT_CONFIRMED", entity: "Payment", entityId: paymentId,
    after: { invoiceNumber: payment.invoice.number, amount: payment.amount },
  });
  return { ok: true };
}

async function notifyPaymentReceived(invoiceId: string, paymentId: string): Promise<void> {
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: { customer: { include: { users: { where: { active: true } } } }, payments: true },
  });
  if (!invoice) return;
  const payment = invoice.payments.find((p) => p.id === paymentId);
  await dispatchNotifications(
    "payment_received",
    {
      invoiceNumber: invoice.number,
      amount: formatMoney(payment?.amount ?? 0, invoice.currency),
    },
    {
      customerId: invoice.customerId,
      userIds: invoice.customer.users.map((u) => u.id),
      to: invoice.customer.email ?? undefined,
    }
  );
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
