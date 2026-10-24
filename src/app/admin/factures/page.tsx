import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Table, EmptyState, Badge, Pagination } from "@/components/ui";
import { formatMoney, formatDate } from "@/lib/format";
import { INVOICE_STATUSES, PAYMENT_METHODS } from "@/lib/constants";

export const metadata = { title: "Factures & paiements" };

const PAGE_SIZE = 20;

export default function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-950">Factures & paiements</h1>
        <a href="/api/export/factures" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          Export CSV
        </a>
      </div>

      <form method="get" className="mb-4 flex gap-2">
        <select name="status" defaultValue={sp.status ?? ""} className="w-64 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
          <option value="">Tous statuts</option>
          {Object.entries(INVOICE_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <button className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Filtrer</button>
      </form>

      <InvoicesList sp={sp} page={page} />
    </div>
  );
}

async function InvoicesList({ sp, page }: { sp: { status?: string }; page: number }) {
  const where = sp.status ? { status: sp.status } : {};
  const [total, invoices] = await Promise.all([
    db.invoice.count({ where }),
    db.invoice.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { name: true } },
        payments: true,
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (invoices.length === 0) {
    return <EmptyState title="Aucune facture" hint="Les factures sont générées depuis les devis acceptés ou créées directement depuis la fiche d'un client." />;
  }

  return (
    <Card>
      <Table head={["N°", "Client", "Émise le", "Échéance", "Total", "Payé", "Solde", "Statut", "Dernier paiement", ""]}>
        {invoices.map((inv) => {
          const paid = inv.payments.filter((p) => p.status === "CONFIRMED").reduce((s, p) => s + p.amount, 0);
          const balance = Math.max(0, inv.total - paid);
          const lastPayment = inv.payments.filter((p) => p.status === "CONFIRMED").sort((a, b) => (b.confirmedAt?.getTime() ?? 0) - (a.confirmedAt?.getTime() ?? 0))[0];
          return (
            <tr key={inv.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <Link href={`/admin/factures/${inv.id}`} className="font-mono text-xs font-semibold text-navy-800">{inv.number}</Link>
              </td>
              <td className="px-4 py-3 text-sm text-slate-600">{inv.customer.name}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.issuedAt ?? inv.createdAt)}</td>
              <td className="px-4 py-3 text-xs text-slate-500">{formatDate(inv.dueAt)}</td>
              <td className="px-4 py-3 text-sm font-semibold text-navy-900">{formatMoney(inv.total, inv.currency)}</td>
              <td className="px-4 py-3 text-sm text-emerald-700">{formatMoney(paid, inv.currency)}</td>
              <td className="px-4 py-3 text-sm">{balance > 0 ? <span className="font-semibold text-amber-600">{formatMoney(balance, inv.currency)}</span> : "—"}</td>
              <td className="px-4 py-3">
                <Badge tone={inv.status === "PAID" ? "green" : inv.status === "PARTIAL" ? "amber" : inv.status === "CANCELLED" ? "red" : "blue"}>
                  {INVOICE_STATUSES[inv.status as keyof typeof INVOICE_STATUSES]}
                </Badge>
              </td>
              <td className="px-4 py-3 text-xs text-slate-500">
                {lastPayment ? `${PAYMENT_METHODS[lastPayment.method as keyof typeof PAYMENT_METHODS]} · ${formatDate(lastPayment.confirmedAt)}` : "—"}
              </td>
              <td className="px-4 py-3 text-right"><Link href={`/admin/factures/${inv.id}`} className="text-xs font-semibold text-accent-600">Ouvrir</Link></td>
            </tr>
          );
        })}
      </Table>
      <Pagination page={page} totalPages={totalPages} baseHref={`/admin/factures${sp.status ? `?status=${sp.status}&` : "?"}`} />
    </Card>
  );
}
