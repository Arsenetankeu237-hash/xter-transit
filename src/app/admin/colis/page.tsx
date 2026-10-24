import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, Table, EmptyState, StatusBadge, Pagination, inputClass, btnPrimary } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { MODES, PACKAGE_STATUSES } from "@/lib/constants";

export const metadata = { title: "Colis" };

const PAGE_SIZE = 20;

export default function PackagesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; mode?: string; status?: string; page?: string }>;
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
  searchParams: Promise<{ q?: string; mode?: string; status?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const buildHref = (over: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const merged = { q: sp.q, mode: sp.mode, status: sp.status, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) params.set(k, v);
    return "/admin/colis" + (params.toString() ? "?" + params.toString() : "");
  };

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-navy-950">Colis</h1>
        <div className="flex gap-2">
          <a href="/api/export/colis" className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Export CSV
          </a>
          <Link href="/admin/colis/nouveau" className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
            + Nouveau colis
          </Link>
        </div>
      </div>

      <form method="get" className="mb-4 flex flex-wrap gap-2">
        <input name="q" defaultValue={sp.q ?? ""} placeholder="N° suivi, référence, client…" className={inputClass + " max-w-xs"} />
        <select name="mode" defaultValue={sp.mode ?? ""} className={inputClass + " w-40"}>
          <option value="">Tous modes</option>
          <option value="AIR">Aérien</option>
          <option value="SEA">Maritime</option>
        </select>
        <select name="status" defaultValue={sp.status ?? ""} className={inputClass + " w-64"}>
          <option value="">Tous statuts</option>
          {PACKAGE_STATUSES.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
        </select>
        <button className={btnPrimary}>Filtrer</button>
      </form>

      <PackageList sp={sp} page={page} buildHref={buildHref} />
    </div>
  );
}

async function PackageList({
  sp,
  page,
  buildHref,
}: {
  sp: { q?: string; mode?: string; status?: string };
  page: number;
  buildHref: (over: Record<string, string | undefined>) => string;
}) {
  const where: Record<string, unknown> = {};
  if (sp.mode === "AIR" || sp.mode === "SEA") where.mode = sp.mode;
  if (sp.status) where.status = sp.status;
  if (sp.q?.trim()) {
    const q = sp.q.trim();
    where.OR = [
      { trackingNumber: { contains: q } },
      { reference: { contains: q } },
      { customer: { name: { contains: q } } },
      { customer: { code: { contains: q } } },
      { customer: { phone: { contains: q } } },
    ];
  }

  const [total, packages] = await Promise.all([
    db.package.count({ where }),
    db.package.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        customer: { select: { name: true, code: true } },
        shipment: { select: { reference: true } },
      },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  if (packages.length === 0) {
    return <EmptyState title="Aucun colis" hint="Aucun colis ne correspond à ces critères." />;
  }

  return (
    <Card>
      <Table head={["N° suivi", "Client", "Mode", "Statut", "Expédition", "Poids", "Créé le", ""]}>
        {packages.map((p) => (
          <tr key={p.id} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <Link href={`/admin/colis/${p.id}`} className="font-mono text-xs font-semibold text-navy-800">{p.trackingNumber}</Link>
              {p.archivedAt && <span className="ml-2 text-[10px] text-slate-400">(archivé)</span>}
            </td>
            <td className="px-4 py-3">
              <Link href={`/admin/clients/${p.customerId}`} className="text-sm text-slate-700 hover:text-accent-600">{p.customer.name}</Link>
            </td>
            <td className="px-4 py-3 text-xs text-slate-500">{MODES[p.mode as keyof typeof MODES]}</td>
            <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
            <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.shipment?.reference ?? "—"}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{p.weightKg ? p.weightKg + " kg" : "—"}</td>
            <td className="px-4 py-3 text-xs text-slate-400">{formatDate(p.createdAt)}</td>
            <td className="px-4 py-3 text-right"><Link href={`/admin/colis/${p.id}`} className="text-xs font-semibold text-accent-600">Ouvrir</Link></td>
          </tr>
        ))}
      </Table>
      <Pagination page={page} totalPages={totalPages} baseHref={buildHref({ page: undefined })} />
    </Card>
  );
}
