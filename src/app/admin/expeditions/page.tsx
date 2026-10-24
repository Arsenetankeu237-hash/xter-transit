import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Table, EmptyState, Badge, Pagination, inputClass, btnPrimary } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { SHIPMENT_STATUS_MAP } from "@/lib/constants";

export const metadata = { title: "Expéditions" };

const PAGE_SIZE = 20;

export default function ShipmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-950">Expéditions aériennes & maritimes</h1>
        <Link href="/admin/expeditions/nouveau" className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
          + Nouvelle expédition
        </Link>
      </div>

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Référence, conteneur, AWB, BL, navire…" className={inputClass + " max-w-md"} />
        <select name="type" defaultValue={sp.type ?? ""} className={inputClass + " w-40"}>
          <option value="">Tous types</option>
          <option value="AIR">Aérien</option>
          <option value="SEA">Maritime</option>
        </select>
        <button className={btnPrimary}>Filtrer</button>
      </form>

      <ShipmentList sp={sp} page={page} />
    </div>
  );
}

async function ShipmentList({ sp, page }: { sp: { q?: string; type?: string }; page: number }) {
  const where: Record<string, unknown> = {};
  if (sp.type === "AIR" || sp.type === "SEA") where.type = sp.type;
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { reference: { contains: q } },
      { containerNumber: { contains: q } },
      { awbNumber: { contains: q } },
      { blNumber: { contains: q } },
      { vesselName: { contains: q } },
      { flightNumber: { contains: q } },
    ];
  }
  const [total, shipments] = await Promise.all([
    db.shipment.count({ where }),
    db.shipment.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { provider: { select: { name: true } }, _count: { select: { packages: true } } },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (shipments.length === 0) {
    return <EmptyState title="Aucune expédition" hint="Créez une expédition aérienne ou maritime pour organiser un départ (groupage ou conteneur)." />;
  }

  return (
    <Card>
      <Table head={["Référence", "Type", "Trajet", "Transporteur", "Conteneur / Vol", "Colis", "Statut", "Départ", ""]}>
        {shipments.map((s) => (
          <tr key={s.id} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <Link href={`/admin/expeditions/${s.id}`} className="font-mono text-xs font-semibold text-navy-800">{s.reference}</Link>
              {s.groupage && <span className="ml-2"><Badge tone="orange">groupage</Badge></span>}
            </td>
            <td className="px-4 py-3 text-xs">{s.type === "AIR" ? "✈️ Aérien" : "🚢 Maritime"}</td>
            <td className="px-4 py-3 text-xs text-slate-500">
              {s.originCity || s.originCountry || "?"} → {s.destCity || s.destCountry || "?"}
            </td>
            <td className="px-4 py-3 text-xs text-slate-500">{s.provider?.name ?? "—"}</td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">
              {s.type === "SEA" ? (s.containerNumber ?? "—") : (s.flightNumber ?? "—")}
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-navy-800">{s._count.packages}</td>
            <td className="px-4 py-3"><Badge tone={s.status === "CLOSED" ? "green" : s.status === "CANCELLED" ? "red" : "blue"}>{SHIPMENT_STATUS_MAP[s.status]?.label ?? s.status}</Badge></td>
            <td className="px-4 py-3 text-xs text-slate-400">{formatDate(s.actualDepartureAt ?? s.plannedDepartureAt)}</td>
            <td className="px-4 py-3 text-right"><Link href={`/admin/expeditions/${s.id}`} className="text-xs font-semibold text-accent-600">Ouvrir</Link></td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} totalPages={totalPages} baseHref={`/admin/expeditions${sp.q ? `?q=${encodeURIComponent(sp.q)}&` : "?"}${sp.type ? `type=${sp.type}&` : ""}`} />
    </Card>
  );
}
