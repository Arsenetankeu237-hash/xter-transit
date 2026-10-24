import { Suspense } from "react";
import { headers } from "next/headers";
import Link from "next/link";
import { publicTrack } from "@/lib/tracking";
import { rateLimit } from "@/lib/rate-limit";
import { MODES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { Card, StatusBadge, EmptyState, Alert } from "@/components/ui";
import { TrackWidget } from "@/components/site-chrome";

export const metadata = { title: "Suivi de colis" };

export default function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ numero?: string }>;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-950">Suivi de colis</h1>
      <p className="mt-2 text-sm text-slate-500">
        Saisissez le numéro de suivi reçu lors de l'enregistrement de votre envoi. Aucun compte n'est nécessaire.
      </p>
      <div className="mt-6">
        <TrackWidget />
      </div>

      <Suspense fallback={null}>
        <TrackSection searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function TrackSection({ searchParams }: { searchParams: Promise<{ numero?: string }> }) {
  const { numero } = await searchParams;
  if (!numero) return null;
  return (
    <div className="mt-8">
      <TrackResult numero={numero} />
    </div>
  );
}

async function TrackResult({ numero }: { numero: string }) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const rl = rateLimit(`track:${ip}`, 30, 60_000);
  if (!rl.ok) {
    return <Alert tone="warning">Trop de recherches. Merci de patienter {rl.retryAfterSec} secondes.</Alert>;
  }

  const result = await publicTrack(numero);
  if (!result) {
    return (
      <EmptyState
        title={`Aucun colis trouvé pour « ${numero.trim()} »`}
        hint="Vérifiez le numéro de suivi (exemple : XTER-2026-000001). Si votre colis vient d'être enregistré, réessayez dans quelques minutes."
      />
    );
  }

  return (
    <div className="space-y-6">
      <Card className="p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="font-mono text-xl font-bold text-navy-950">{result.trackingNumber}</p>
            {result.reference && <p className="mt-1 text-xs text-slate-500">Référence : {result.reference}</p>}
            <p className="mt-2 text-sm text-slate-600">
              {MODES[result.mode as keyof typeof MODES] ?? result.mode}
              {result.shipmentRef && <> · Expédition {result.shipmentRef}</>}
            </p>
          </div>
          <StatusBadge status={result.status} />
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Départ</dt>
            <dd className="mt-1 text-slate-700">{result.origin ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Destination</dt>
            <dd className="mt-1 text-slate-700">{result.destination ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Réceptionné le</dt>
            <dd className="mt-1 text-slate-700">{formatDateTime(result.receivedAt)}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold tracking-wide text-slate-400 uppercase">Arrivée estimée</dt>
            <dd className="mt-1 text-slate-700">{formatDateTime(result.eta)}</dd>
          </div>
        </dl>

        {result.lastEvent && (
          <div className="mt-6 rounded-lg border border-navy-100 bg-navy-50/50 px-4 py-3">
            <p className="text-xs font-semibold tracking-wide text-navy-600 uppercase">Dernier événement</p>
            <p className="mt-1 text-sm font-medium text-navy-900">
              {result.lastEvent.label}
              {result.lastEvent.location ? ` — ${result.lastEvent.location}` : ""}
            </p>
            <p className="mt-0.5 text-xs text-slate-500">{formatDateTime(result.lastEvent.occurredAt)}</p>
          </div>
        )}
      </Card>

      <Card className="p-6">
        <h2 className="text-sm font-semibold tracking-wide text-navy-900 uppercase">Historique du colis</h2>
        {result.timeline.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Aucun événement public pour le moment.</p>
        ) : (
          <ol className="mt-6 space-y-0 border-l-2 border-navy-100 pl-6">
            {result.timeline.map((e, i) => (
              <li key={i} className="relative pb-6 last:pb-0">
                <span
                  className={`absolute top-1 -left-[31px] h-3 w-3 rounded-full border-2 ${
                    i === 0 ? "border-accent-500 bg-accent-500" : "border-navy-200 bg-white"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-navy-900">{e.label}</p>
                  {e.scope === "shipment" && (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                      Expédition
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

      <p className="text-center text-xs text-slate-400">
        Une question sur votre colis ? <Link href="/contact" className="font-semibold text-accent-600">Contactez-nous</Link>
      </p>
    </div>
  );
}
