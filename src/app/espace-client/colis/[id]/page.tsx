import { Suspense } from "react";
import { connection } from "next/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { packageTimeline } from "@/lib/tracking";
import { Card, StatusBadge, Alert } from "@/components/ui";
import { formatDateTime, formatWeight } from "@/lib/format";
import { EVENT_SOURCES, MODES } from "@/lib/constants";

export const metadata = { title: "Détail du colis" };

export default async function ClientPackagePage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <ResolvePageParams params={params} />
    </Suspense>
  );
}

async function ResolvePageParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-100" />}>
      <Content packageId={id} />
    </Suspense>
  );
}

async function Content({ packageId }: { packageId: string }) {
  await connection(); // page dynamique : données et session à la demande
  const user = await getSessionUser();
  if (!user) redirect("/connexion");

  const pkg = await db.package.findUnique({
    where: { id: packageId },
    include: {
      shipment: { select: { reference: true, type: true } },
      documents: { where: { visibility: "CLIENT" } },
    },
  });
  // Sécurité : un client n'accède qu'à ses propres colis
  if (!pkg || (user.role === "CLIENT" && pkg.customerId !== user.customerId)) notFound();

  const timeline = await packageTimeline(pkg.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Link href={user.role === "CLIENT" ? "/espace-client" : `/admin/colis/${pkg.id}`} className="font-semibold text-accent-600">
          ← Retour
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-2xl font-bold text-navy-950">{pkg.trackingNumber}</p>
            <p className="mt-1 text-sm text-slate-500">
              {MODES[pkg.mode as keyof typeof MODES]} · Créé le {formatDateTime(pkg.createdAt)}
              {pkg.shipment && <> · Expédition <span className="font-mono">{pkg.shipment.reference}</span></>}
            </p>
          </div>
          <StatusBadge status={pkg.status} />
        </div>
        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Poids</dt>
            <dd className="mt-1 text-slate-700">{formatWeight(pkg.weightKg)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Colis</dt>
            <dd className="mt-1 text-slate-700">{pkg.pieces ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Référence</dt>
            <dd className="mt-1 text-slate-700">{pkg.reference ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold text-slate-400 uppercase">Contenu</dt>
            <dd className="mt-1 text-slate-700">{pkg.contentDescription ?? "—"}</dd>
          </div>
        </dl>
      </Card>

      {pkg.documents.length > 0 && (
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-navy-900 uppercase">Documents</h2>
          <ul className="mt-3 space-y-2">
            {pkg.documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <span className="text-slate-700">{d.title}</span>
                <a href={`/api/documents/${d.id}`} className="text-xs font-semibold text-accent-600">Télécharger</a>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="p-6">
        <h2 className="text-sm font-semibold text-navy-900 uppercase">Historique complet</h2>
        {timeline.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucun événement enregistré pour le moment.</p>
        ) : (
          <ol className="mt-6 space-y-0 border-l-2 border-navy-100 pl-6">
            {timeline
              .filter((e) => !e.corrected)
              .map((e, i) => (
                <li key={e.id} className="relative pb-6 last:pb-0">
                  <span className={`absolute top-1 -left-[31px] h-3 w-3 rounded-full border-2 ${i === 0 ? "border-accent-500 bg-accent-500" : "border-navy-200 bg-white"}`} />
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge status={e.status} />
                    {e.scope === "shipment" && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">Expédition {e.shipmentRef}</span>}
                    {user.role !== "CLIENT" && (
                      <span className="text-[10px] text-slate-400">
                        {EVENT_SOURCES[e.source as keyof typeof EVENT_SOURCES]}
                        {e.agentName ? ` · ${e.agentName}` : ""}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(e.occurredAt)}{e.location ? ` · ${e.location}` : ""}</p>
                  {e.description && <p className="mt-1 text-sm text-slate-600">{e.description}</p>}
                </li>
              ))}
          </ol>
        )}
      </Card>

      {user.role === "CLIENT" && pkg.holdFlag && (
        <Alert tone="warning">
          Une action est peut-être requise sur ce colis (régularisation, document manquant…). Notre équipe vous contactera ; vous pouvez aussi nous écrire via la page Contact.
        </Alert>
      )}
    </div>
  );
}
