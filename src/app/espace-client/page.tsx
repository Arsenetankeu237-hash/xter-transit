import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, StatCard, StatusBadge, EmptyState, Table } from "@/components/ui";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";

export const metadata = { title: "Espace client" };

export default function EspaceClientPage() {
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

  const customerId = user.customerId;
  const [packages, invoices, notifications] = await Promise.all([
    db.package.findMany({
      where: { customerId, archivedAt: null },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: { shipment: { select: { reference: true } } },
    }),
    db.invoice.findMany({
      where: { customerId, status: { in: ["ISSUED", "PARTIAL"] } },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    db.notification.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 8,
    }),
  ]);

  const inTransit = packages.filter((p) => ["SHIPPED", "IN_TRANSIT", "TRANSIT_HUB", "VESSEL_DEPARTED"].includes(p.status)).length;
  const delivered = await db.package.count({ where: { customerId, status: "DELIVERED" } });
  const unpaid = invoices.reduce((s, i) => s + i.total, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-950">Bonjour {user.name.split(" ")[0]}</h1>

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Colis actifs" value={packages.length} />
        <StatCard label="En transit" value={inTransit} tone="info" />
        <StatCard label="Livrés" value={delivered} tone="success" />
        <StatCard label="Solde factures" value={formatMoney(unpaid)} tone={unpaid > 0 ? "warning" : "default"} />
      </div>

      <Card>
        <CardHeader title="Mes colis récents" action={<Link href="/espace-client/factures" className="text-xs font-semibold text-accent-600">Mes factures →</Link>} />
        {packages.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Aucun colis pour le moment" hint="Vos expéditions apparaîtront ici dès leur enregistrement par notre équipe." />
          </div>
        ) : (
          <Table head={["N° de suivi", "Mode", "Statut", "Expédition", "Mis à jour", ""]}>
            {packages.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-800">{p.trackingNumber}</td>
                <td className="px-4 py-3 text-slate-600">{p.mode === "AIR" ? "Aérien" : "Maritime"}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-500">{p.shipment?.reference ?? "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(p.updatedAt)}</td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/espace-client/colis/${p.id}`} className="text-xs font-semibold text-accent-600">Détails</Link>
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Notifications" />
          {notifications.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Aucune notification.</p>
          ) : (
            <ul className="divide-y divide-slate-50">
              {notifications.map((n) => (
                <li key={n.id} className="px-5 py-3">
                  <p className="text-sm font-semibold text-navy-900">{n.subject}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{n.body}</p>
                  <p className="mt-1 text-[11px] text-slate-400">{formatDateTime(n.createdAt)}</p>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader title="Documents disponibles" action={<Link href="/espace-client/documents" className="text-xs font-semibold text-accent-600">Tout voir →</Link>} />
          <DocumentsPreview customerId={customerId} />
        </Card>
      </div>
    </div>
  );
}

async function DocumentsPreview({ customerId }: { customerId: string }) {
  const docs = await db.document.findMany({
    where: { customerId, visibility: "CLIENT" },
    orderBy: { createdAt: "desc" },
    take: 6,
  });
  if (docs.length === 0) {
    return <p className="p-6 text-sm text-slate-500">Aucun document partagé pour le moment.</p>;
  }
  return (
    <ul className="divide-y divide-slate-50">
      {docs.map((d) => (
        <li key={d.id} className="flex items-center justify-between px-5 py-3 text-sm">
          <span className="text-slate-700">{d.title}</span>
          <a href={`/api/documents/${d.id}`} className="text-xs font-semibold text-accent-600">Télécharger</a>
        </li>
      ))}
    </ul>
  );
}
