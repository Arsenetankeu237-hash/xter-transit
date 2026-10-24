import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, Badge, inputClass, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { recordPaymentAction, confirmPaymentAction, cancelInvoiceAction } from "@/app/actions/finance";
import { parseLines } from "@/lib/invoices";
import { formatMoney, formatDate, formatDateTime } from "@/lib/format";
import { PAYMENT_METHODS, INVOICE_STATUSES } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { PrintButton } from "@/components/print-button";

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <ResolvePageParams params={params} />
    </Suspense>
  );
}

async function ResolvePageParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content invoiceId={id} />
    </Suspense>
  );
}

async function Content({ invoiceId }: { invoiceId: string }) {
  await connection(); // page dynamique : données et session à la demande
  const invoice = await db.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      customer: true,
      quote: { select: { id: true, number: true } },
      payments: { orderBy: { createdAt: "desc" }, include: { confirmedBy: { select: { name: true } } } },
      documents: true,
    },
  });
  if (!invoice) notFound();
  const settings = await getSettings();

  const confirmed = invoice.payments.filter((p) => p.status === "CONFIRMED");
  const paid = confirmed.reduce((s, p) => s + p.amount, 0);
  const balance = Math.max(0, invoice.total - paid);
  const lines = parseLines(invoice.lines);

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Facture ${invoice.number}`}
        subtitle={`${invoice.customer.name} · Émise le ${formatDate(invoice.issuedAt ?? invoice.createdAt)}${invoice.dueAt ? ` · Échéance ${formatDate(invoice.dueAt)}` : ""}${invoice.quote ? ` · Devis ${invoice.quote.number}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Badge tone={invoice.status === "PAID" ? "green" : invoice.status === "PARTIAL" ? "amber" : invoice.status === "CANCELLED" ? "red" : "blue"}>
              {INVOICE_STATUSES[invoice.status as keyof typeof INVOICE_STATUSES]}
            </Badge>
            <a href={`/api/invoices/${invoice.id}/print`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Imprimer / PDF
            </a>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Détail de la facture" />
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/60">
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Désignation</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Qté</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">P.U.</th>
                <th className="px-5 py-2.5 text-xs font-semibold text-slate-500 uppercase">Montant</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {lines.map((l, i) => (
                <tr key={i}>
                  <td className="px-5 py-2.5 text-slate-700">{l.label}</td>
                  <td className="px-5 py-2.5 text-slate-500">{l.qty}</td>
                  <td className="px-5 py-2.5 text-slate-500">{formatMoney(l.unitPrice, invoice.currency)}</td>
                  <td className="px-5 py-2.5 font-semibold text-navy-900">{formatMoney(l.amount, invoice.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="space-y-1 border-t border-slate-100 px-5 py-4 text-sm">
            <div className="flex justify-between text-slate-600"><span>Sous-total</span><span>{formatMoney(invoice.subtotal, invoice.currency)}</span></div>
            {invoice.taxRate ? (
              <div className="flex justify-between text-slate-600"><span>TVA ({invoice.taxRate}%)</span><span>{formatMoney(invoice.taxAmount ?? 0, invoice.currency)}</span></div>
            ) : null}
            <div className="flex justify-between text-base font-bold text-navy-950"><span>Total</span><span>{formatMoney(invoice.total, invoice.currency)}</span></div>
            <div className="flex justify-between text-emerald-700"><span>Payé</span><span>{formatMoney(paid, invoice.currency)}</span></div>
            <div className="flex justify-between font-semibold text-amber-600"><span>Solde restant</span><span>{formatMoney(balance, invoice.currency)}</span></div>
          </div>
          {invoice.notes && <p className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{invoice.notes}</p>}
        </Card>

        <div className="space-y-6">
          {/* Paiements */}
          <Card>
            <CardHeader title={`Paiements (${invoice.payments.length})`} />
            <ul className="divide-y divide-slate-50">
              {invoice.payments.length === 0 && <li className="px-5 py-4 text-sm text-slate-500">Aucun paiement enregistré.</li>}
              {invoice.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                  <div>
                    <p className="font-semibold text-navy-900">{formatMoney(p.amount, p.currency)}</p>
                    <p className="text-xs text-slate-400">
                      {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]}
                      {p.reference ? ` · réf. ${p.reference}` : ""}
                      {p.confirmedBy?.name ? ` · confirmé par ${p.confirmedBy.name}` : ""}
                      {" · "}{formatDateTime(p.confirmedAt ?? p.createdAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={p.status === "CONFIRMED" ? "green" : p.status === "PENDING" ? "amber" : "red"}>
                      {p.status === "CONFIRMED" ? "Confirmé" : p.status === "PENDING" ? "En attente" : p.status}
                    </Badge>
                    {p.status === "PENDING" && (
                      <ActionForm action={confirmPaymentAction} submitLabel="Confirmer" buttonClassName="text-xs font-semibold text-accent-600 hover:underline">
                        <input type="hidden" name="paymentId" value={p.id} />
                        <input type="hidden" name="invoiceId" value={invoice.id} />
                      </ActionForm>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            <div className="border-t border-slate-100 p-4">
              <ActionForm action={recordPaymentAction} submitLabel="Enregistrer le paiement">
                <input type="hidden" name="invoiceId" value={invoice.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Moyen *">
                    <select name="method" required className={inputClass}>
                      {Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label={`Montant * (solde : ${formatMoney(balance, invoice.currency)})`}>
                    <input name="amount" type="number" step="0.01" min="0.01" required className={inputClass} />
                  </Field>
                </div>
                <Field label="Référence">
                  <input name="reference" className={inputClass} placeholder="N° virement, transaction Mobile Money…" />
                </Field>
                <p className="text-xs text-slate-400">
                  Paiements manuels confirmés immédiatement. « Paiement en ligne » : enregistrement en attente, confirmé uniquement par le prestataire (webhook).
                </p>
              </ActionForm>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-3 text-sm font-semibold text-navy-900 uppercase">Actions</h2>
            <div className="space-y-3">
              {invoice.documents.filter((d) => d.kind === "RECEIPT").map((d) => (
                <a key={d.id} href={`/api/documents/${d.id}`} className="block text-sm font-semibold text-accent-600">Reçu « {d.title} »</a>
              ))}
              {invoice.status !== "CANCELLED" && invoice.status !== "PAID" && confirmed.length === 0 && (
                <ActionForm action={cancelInvoiceAction} submitLabel="Annuler la facture" buttonClassName="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100" confirmMessage="Annuler cette facture ?">
                  <input type="hidden" name="invoiceId" value={invoice.id} />
                </ActionForm>
              )}
              <PrintButton label="Imprimer la facture" />
              <Link href={`/admin/clients/${invoice.customerId}`} className="block text-sm font-semibold text-slate-500 hover:text-navy-800">
                Voir la fiche client →
              </Link>
              <p className="text-xs text-slate-400">Devise : {invoice.currency} · Devises configurées : {settings.currencies.join(", ")}</p>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
