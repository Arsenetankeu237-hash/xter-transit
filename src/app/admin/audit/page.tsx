import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, CardHeader, Table, Badge, Pagination, inputClass, btnPrimary } from "@/components/ui";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Journal d'audit" };

const PAGE_SIZE = 30;

export default function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ entity?: string; page?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ entity?: string; page?: string }> }) {
  const sp = await searchParams;
  const entity = sp.entity;
  const page = Math.max(1, Number(sp.page ?? 1) || 1);
  const where = entity ? { entity } : {};
  const [total, logs, entities] = await Promise.all([
    db.auditLog.count({ where }),
    db.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.auditLog.groupBy({ by: ["entity"], _count: true, orderBy: { entity: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Journal d'audit</h1>
        <p className="mt-1 text-sm text-slate-500">
          Toutes les opérations sensibles sont consignées : connexions, créations, modifications, corrections de suivi, paiements, exports…
        </p>
        <form method="get" className="mt-4 flex gap-2">
          <select name="entity" defaultValue={entity ?? ""} className={inputClass + " w-64"}>
            <option value="">Toutes les entités</option>
            {entities.map((e) => <option key={e.entity} value={e.entity}>{e.entity} ({e._count})</option>)}
          </select>
          <button className={btnPrimary}>Filtrer</button>
        </form>
      </div>

      <Card>
        <CardHeader title={`${total} entrées (page ${page}/${totalPages})`} />
        <Table head={["Date", "Utilisateur", "Action", "Entité", "Détails"]}>
          {logs.map((l) => (
            <tr key={l.id} className="align-top hover:bg-slate-50">
              <td className="px-4 py-2.5 text-xs whitespace-nowrap text-slate-500">{formatDateTime(l.createdAt)}</td>
              <td className="px-4 py-2.5 text-xs text-slate-700">{l.userName ?? "système"}</td>
              <td className="px-4 py-2.5">
                <Badge tone={l.action.includes("FAILED") || l.action.includes("DELETE") || l.action.includes("CANCEL") ? "red" : l.action === "LOGIN" ? "navy" : "slate"}>
                  {l.action}
                </Badge>
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-500">
                {l.entity}{l.entityId ? <span className="block font-mono text-[10px] opacity-60">{l.entityId.slice(0, 12)}…</span> : null}
              </td>
              <td className="px-4 py-2.5 max-w-md">
                {l.after && (
                  <details>
                    <summary className="cursor-pointer text-xs text-accent-600">après</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-600">{JSON.stringify(JSON.parse(l.after), null, 1)}</pre>
                  </details>
                )}
                {l.before && (
                  <details>
                    <summary className="cursor-pointer text-xs text-slate-400">avant</summary>
                    <pre className="mt-1 max-h-40 overflow-auto rounded bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-500">{JSON.stringify(JSON.parse(l.before), null, 1)}</pre>
                  </details>
                )}
              </td>
            </tr>
          ))}
        </Table>
        <Pagination page={page} totalPages={totalPages} baseHref={`/admin/audit${entity ? `?entity=${entity}&` : "?"}`} />
      </Card>
    </div>
  );
}
