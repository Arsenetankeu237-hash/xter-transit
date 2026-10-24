import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader, StatCard, StatusBadge, Table, Badge } from "@/components/ui";
import { BarChart, DonutChart } from "@/components/charts";
import { formatDateTime, formatMoney } from "@/lib/format";

export const metadata = { title: "Tableau de bord" };

export default function AdminDashboard() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    totalPackages, received, preparation, airTransit, seaTransit, awaitingDeparture,
    arrived, customs, delivered, delayed, hold,
  ] = await Promise.all([
    db.package.count({ where: { archivedAt: null } }),
    db.package.count({ where: { status: "RECEIVED_WAREHOUSE", archivedAt: null } }),
    db.package.count({ where: { status: { in: ["PREPARATION", "CONTROLLED_WEIGHED", "DOCS_PREPARATION", "PACKAGE_ANNOUNCED"] }, archivedAt: null } }),
    db.package.count({ where: { mode: "AIR", status: { in: ["SHIPPED", "IN_TRANSIT", "TRANSIT_HUB"] }, archivedAt: null } }),
    db.package.count({ where: { mode: "SEA", status: { in: ["SHIPPED", "IN_TRANSIT", "VESSEL_DEPARTED", "VESSEL_ARRIVED"] }, archivedAt: null } }),
    db.package.count({ where: { status: "AWAITING_DEPARTURE", archivedAt: null } }),
    db.package.count({ where: { status: { in: ["ARRIVED_DESTINATION_COUNTRY", "AVAILABLE_PICKUP", "CONTAINER_UNLOADED"] }, archivedAt: null } }),
    db.package.count({ where: { status: "CUSTOMS_IN_PROGRESS", archivedAt: null } }),
    db.package.count({ where: { status: "DELIVERED" } }),
    db.package.count({ where: { status: "DELAYED", archivedAt: null } }),
    db.package.count({ where: { holdFlag: true, archivedAt: null } }),
  ]);

  const [pendingPaymentsAmount, revenueMonth, recentEvents, syncIntegrations] = await Promise.all([
    db.invoice.aggregate({
      where: { status: { in: ["ISSUED", "PARTIAL"] } },
      _sum: { total: true },
    }),
    db.payment.aggregate({
      where: { status: "CONFIRMED", confirmedAt: { gte: monthStart } },
      _sum: { amount: true },
    }),
    db.trackingEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        package: { select: { id: true, trackingNumber: true } },
        shipment: { select: { id: true, reference: true } },
        agent: { select: { name: true } },
      },
    }),
    db.providerIntegration.findMany({
      where: { enabled: true },
      include: { provider: { select: { name: true } } },
      orderBy: { lastSyncAt: "desc" },
    }),
  ]);

  // Colis créés par mois (12 derniers mois)
  const months: Array<{ label: string; value: number }> = [];
  for (let i = 11; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const count = await db.package.count({ where: { createdAt: { gte: start, lt: end } } });
    months.push({
      label: start.toLocaleDateString("fr-FR", { month: "short" }),
      value: count,
    });
  }

  const statusDonut = [
    { label: "Reçus / préparation", value: received + preparation },
    { label: "En attente de départ", value: awaitingDeparture },
    { label: "Transit aérien", value: airTransit },
    { label: "Transit maritime", value: seaTransit },
    { label: "Arrivés / dispo", value: arrived },
    { label: "Dédouanement", value: customs },
    { label: "Litiges / retards", value: delayed + hold },
  ].filter((d) => d.value > 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tableau de bord"
        subtitle="Vue d'ensemble des opérations de transit"
        action={
          <div className="flex gap-2">
            <Link href="/admin/colis/nouveau" className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
              + Nouveau colis
            </Link>
            <Link href="/admin/expeditions/nouveau" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              + Nouvelle expédition
            </Link>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Colis actifs" value={totalPackages - delivered} hint={`${totalPackages} au total`} />
        <StatCard label="En préparation" value={received + preparation} tone="info" />
        <StatCard label="En transit" value={airTransit + seaTransit} hint={`Aérien ${airTransit} · Maritime ${seaTransit}`} tone="info" />
        <StatCard label="Livrés" value={delivered} tone="success" />
        <StatCard label="Retards" value={delayed} tone={delayed > 0 ? "danger" : "default"} />
        <StatCard label="Litiges / régularisations" value={hold} tone={hold > 0 ? "warning" : "default"} />
        <StatCard label="CA encaissé (mois)" value={formatMoney(revenueMonth._sum.amount ?? 0)} tone="success" />
        <StatCard label="Solde factures dues" value={formatMoney(pendingPaymentsAmount._sum.total ?? 0)} tone="warning" />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Colis enregistrés — 12 derniers mois" />
          <div className="p-5">
            <BarChart data={months} />
          </div>
        </Card>
        <Card>
          <CardHeader title="Répartition des statuts" />
          <div className="p-5">
            {statusDonut.length > 0 ? <DonutChart data={statusDonut} /> : <p className="text-sm text-slate-500">Aucun colis actif.</p>}
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Dernières opérations de suivi" />
        {recentEvents.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Aucun événement enregistré. Créez un premier colis pour démarrer.</p>
        ) : (
          <Table head={["Date", "Cible", "Statut", "Source", "Agent"]}>
            {recentEvents.map((e) => (
              <tr key={e.id}>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(e.occurredAt)}</td>
                <td className="px-4 py-3 font-mono text-xs">
                  {e.package ? (
                    <Link href={`/admin/colis/${e.package.id}`} className="font-semibold text-navy-800">{e.package.trackingNumber}</Link>
                  ) : e.shipment ? (
                    <Link href={`/admin/expeditions/${e.shipment.id}`} className="font-semibold text-navy-800">{e.shipment.reference}</Link>
                  ) : "—"}
                </td>                <td className="px-4 py-3"><StatusBadge status={e.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-500">{e.source === "MANUAL" ? "Manuel" : e.source === "API" ? "API transporteur" : "Import"}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{e.agent?.name ?? "—"}</td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Dernières synchronisations transporteurs"
          action={<Link href="/admin/integrations" className="text-xs font-semibold text-accent-600">Gérer les intégrations →</Link>}
        />
        {syncIntegrations.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Aucune intégration active — le suivi fonctionne en mode manuel.
            Configurez un transporteur dans « Intégrations » pour importer automatiquement ses événements.
          </p>
        ) : (
          <ul className="divide-y divide-slate-50">
            {syncIntegrations.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm">
                <span className="font-medium text-navy-900">{i.provider.name} — {i.name}</span>
                <span className="flex items-center gap-3 text-xs text-slate-500">
                  <Badge tone={i.lastSyncStatus === "SUCCESS" ? "green" : i.lastSyncStatus === "ERROR" ? "red" : "amber"}>
                    {i.lastSyncStatus ?? "Jamais synchronisé"}
                  </Badge>
                  {i.lastSyncAt ? formatDateTime(i.lastSyncAt) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
