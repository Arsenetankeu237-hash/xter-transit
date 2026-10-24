import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { Card, CardHeader, EmptyState, Badge } from "@/components/ui";
import { formatDateTime, formatBytes } from "@/lib/format";
import { DOCUMENT_KINDS } from "@/lib/constants";

export const metadata = { title: "Mes documents" };

export default function ClientDocumentsPage() {
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

  const docs = await db.document.findMany({
    where: { customerId: user.customerId, visibility: "CLIENT" },
    orderBy: { createdAt: "desc" },
    include: { package: { select: { trackingNumber: true } }, invoice: { select: { number: true } } },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-navy-950">Mes documents</h1>
      <Card>
        <CardHeader title="Documents partagés par notre équipe" />
        {docs.length === 0 ? (
          <div className="p-6">
            <EmptyState title="Aucun document disponible" hint="Factures, reçus et justificatifs partagés apparaîtront ici." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-50">
            {docs.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
                <div>
                  <p className="text-sm font-semibold text-navy-900">{d.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {DOCUMENT_KINDS[d.kind as keyof typeof DOCUMENT_KINDS] ?? d.kind}
                    {d.package && <> · Colis <span className="font-mono">{d.package.trackingNumber}</span></>}
                    {d.invoice && <> · Facture {d.invoice.number}</>}
                    {" · "}{formatDateTime(d.createdAt)} · {formatBytes(d.sizeBytes)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <a href={`/api/documents/${d.id}`} className="text-xs font-semibold text-accent-600">Télécharger</a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
