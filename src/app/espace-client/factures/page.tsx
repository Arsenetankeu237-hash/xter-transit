import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, Table, EmptyState, Badge } from "@/components/ui";
import { formatDate, formatMoney } from "@/lib/format";
import { INVOICE_STATUSES } from "@/lib/constants";

export const metadata = { title: "Mes factures" };

export default function ClientInvoicesPage() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const user = await getSessionUser();
  if (!user || !user.customerId) redirect("/connexion");

  const invoices = await db.invoice.findMany({
    where: { customerId: user.customerId, status: { not: "DRAFT" } },
    orderBy: { createdAt: "desc" },
    include: { payments: { where: { status: "CONFIRMED" } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-950">Mes factures</h1>
      <Card>
        <CardHeader title="Historique de facturation" />
        {invoices.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Aucune facture" hint="Vos factures et reçus apparaîtront ici." />
          </div>
        ) : (
          <Table head={["N°", "Date", "Échéance", "Total", "Payé", "Solde", "Statut", ""]}>
            {invoices.map((inv) => {
              const paid = inv.payments.reduce((s, p) => s + p.amount, 0);
              const balance = Math.max(0, inv.total - paid);
              return (
                <tr key={inv.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-800">{inv.number}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.issuedAt ?? inv.createdAt)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatDate(inv.dueAt)}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-navy-900">{formatMoney(inv.total, inv.currency)}</td>
                  <td className="px-4 py-3 text-sm text-emerald-700">{formatMoney(paid, inv.currency)}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{formatMoney(balance, inv.currency)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={inv.status === "PAID" ? "green" : inv.status === "PARTIAL" ? "amber" : "slate"}>
                      {INVOICE_STATUSES[inv.status as keyof typeof INVOICE_STATUSES]}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <a href={`/api/invoices/${inv.id}/print`} className="text-xs font-semibold text-accent-600">Voir / imprimer</a>
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </Card>
      <p className="text-xs text-slate-400">
        Pour régler une facture : virement bancaire, Mobile Money ou espèces en agence — les coordonnées de paiement figurent sur le document.
      </p>
    </div>
  );
}
