import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader, StatusBadge, EmptyState, inputClass, btnPrimary } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Recherche globale" };

export default function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Recherche globale</h1>
        <form method="get" className="mt-4 flex gap-2">
          <input
            name="q"
            defaultValue={q ?? ""}
            placeholder="N° suivi, référence, conteneur, AWB, BL, client, téléphone, pays…"
            className={inputClass + " max-w-2xl"}
          />
          <button className={btnPrimary}>Rechercher</button>
        </form>
      </div>

      {q?.trim() ? (
        <Results q={q.trim()} />
      ) : (
        <EmptyState title="Recherchez dans toute la plateforme" hint="Un seul champ pour retrouver un colis, une expédition, un client ou une facture." />
      )}
    </div>
  );
}

async function Results({ q }: { q: string }) {
  const [packages, shipments, customers, invoices] = await Promise.all([
    db.package.findMany({
      where: {
        OR: [
          { trackingNumber: { contains: q } },
          { reference: { contains: q } },
          { customer: { name: { contains: q } } },
          { customer: { phone: { contains: q } } },
        ],
      },
      take: 10,
      include: { customer: { select: { name: true } } },
    }),
    db.shipment.findMany({
      where: {
        OR: [
          { reference: { contains: q } },
          { containerNumber: { contains: q } },
          { awbNumber: { contains: q } },
          { blNumber: { contains: q } },
          { vesselName: { contains: q } },
        ],
      },
      take: 10,
      include: { _count: { select: { packages: true } } },
    }),
    db.customer.findMany({
      where: {
        OR: [
          { name: { contains: q } },
          { code: { contains: q } },
          { phone: { contains: q } },
          { email: { contains: q } },
        ],
      },
      take: 10,
    }),
    db.invoice.findMany({
      where: { number: { contains: q } },
      take: 10,
      include: { customer: { select: { name: true } } },
    }),
  ]);

  const empty = packages.length + shipments.length + customers.length + invoices.length === 0;

  return (
    <>
      {empty && <EmptyState title={`Aucun résultat pour « ${q} »`} />}

      {packages.length > 0 && (
        <Card>
          <CardHeader title={`Colis (${packages.length})`} />
          <ul className="divide-y divide-slate-50">
            {packages.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <Link href={`/admin/colis/${p.id}`} className="font-mono text-sm font-semibold text-navy-800">{p.trackingNumber}</Link>
                  <span className="ml-3 text-xs text-slate-500">{p.customer.name}</span>
                </div>
                <StatusBadge status={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {shipments.length > 0 && (
        <Card>
          <CardHeader title={`Expéditions (${shipments.length})`} />
          <ul className="divide-y divide-slate-50">
            {shipments.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <div>
                  <Link href={`/admin/expeditions/${s.id}`} className="font-mono text-sm font-semibold text-navy-800">{s.reference}</Link>
                  <span className="ml-3 text-xs text-slate-500">
                    {s.type === "AIR" ? "Aérien" : "Maritime"} · {s._count.packages} colis
                    {s.containerNumber ? ` · ${s.containerNumber}` : ""}
                  </span>
                </div>
                <span className="text-xs text-slate-400">{s.destCountry ?? ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {customers.length > 0 && (
        <Card>
          <CardHeader title={`Clients (${customers.length})`} />
          <ul className="divide-y divide-slate-50">
            {customers.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <Link href={`/admin/clients/${c.id}`} className="text-sm font-semibold text-navy-800">{c.name}</Link>
                <span className="text-xs text-slate-500">{c.code} · {c.phone ?? c.email ?? ""}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {invoices.length > 0 && (
        <Card>
          <CardHeader title={`Factures (${invoices.length})`} />
          <ul className="divide-y divide-slate-50">
            {invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                <Link href={`/admin/factures/${i.id}`} className="font-mono text-sm font-semibold text-navy-800">{i.number}</Link>
                <span className="text-xs text-slate-500">{i.customer.name} · {formatDate(i.createdAt)} · {i.status}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}
