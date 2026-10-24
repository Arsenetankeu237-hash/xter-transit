import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader, Table, StatusBadge, Badge, inputClass, Field } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { updateShipmentAction, addShipmentEventAction, attachPackageAction, detachPackageAction, uploadShipmentDocumentAction } from "@/app/actions/shipments";
import { FlightsPanel } from "@/components/flights-panel";
import { AwbHelper } from "@/components/awb-helper";
import { formatDateTime, formatDate, formatMoney } from "@/lib/format";
import { SHIPMENT_STATUSES, SHIPMENT_STATUS_MAP, DOCUMENT_KINDS } from "@/lib/constants";

export default async function ShipmentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <ResolvePageParams params={params} />
    </Suspense>
  );
}

async function ResolvePageParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content shipmentId={id} />
    </Suspense>
  );
}

async function Content({ shipmentId }: { shipmentId: string }) {
  await connection(); // page dynamique : données et session à la demande
  const shipment = await db.shipment.findUnique({
    where: { id: shipmentId },
    include: {
      provider: true,
      packages: {
        orderBy: { createdAt: "asc" },
        include: { customer: { select: { id: true, name: true } } },
      },
      documents: { orderBy: { createdAt: "desc" } },
      events: { orderBy: { occurredAt: "desc" }, include: { agent: { select: { name: true } } } },
    },
  });
  if (!shipment) notFound();

  const providers = await db.transportProvider.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  const isAir = shipment.type === "AIR";
  const costs = [
    { key: "freightCost", label: "Fret" },
    { key: "handlingCost", label: "Manutention" },
    { key: "portFees", label: isAir ? "Frais aéroportuaires" : "Frais portuaires" },
    { key: "customsFees", label: "Transit / douane" },
    { key: "storageCost", label: "Stockage" },
    { key: "otherFees", label: "Autres" },
  ] as const;
  const totalCosts = costs.reduce((s, c) => s + (shipment[c.key] ?? 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={shipment.reference}
        subtitle={`${isAir ? "Fret aérien" : "Fret maritime"}${shipment.groupage ? " · Groupage" : " · Expédition dédiée"} · ${shipment.packages.length} colis · ${formatDate(shipment.createdAt)}`}
        action={<Badge tone={shipment.status === "CLOSED" ? "green" : shipment.status === "CANCELLED" ? "red" : "blue"}>{SHIPMENT_STATUS_MAP[shipment.status]?.label ?? shipment.status}</Badge>}
      />

      {/* Trajet & dates */}
      <Card className="p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-6">
          <Info label="Départ" value={`${shipment.originCity ?? ""}${shipment.originCode ? ` (${shipment.originCode})` : ""}` || "—"} sub={shipment.originCountry ?? ""} />
          <Info label="Arrivée" value={`${shipment.destCity ?? ""}${shipment.destCode ? ` (${shipment.destCode})` : ""}` || "—"} sub={shipment.destCountry ?? ""} />
          <Info label="Transporteur" value={shipment.provider?.name ?? "—"} />
          <Info label={isAir ? "Vol" : "Navire"} value={isAir ? shipment.flightNumber ?? "—" : shipment.vesselName ?? "—"} sub={isAir ? undefined : shipment.voyageNumber ?? ""} />
          <Info label={isAir ? "AWB maître" : "Connaissement"} value={isAir ? shipment.awbNumber ?? "—" : shipment.blNumber ?? "—"} />
          <Info label="Conteneur" value={shipment.containerNumber ?? "—"} sub={shipment.containerType ?? ""} />
        </dl>
        <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 text-sm sm:grid-cols-5">
          <Info label="Départ prévu" value={formatDate(shipment.plannedDepartureAt)} />
          <Info label="Départ réel" value={formatDate(shipment.actualDepartureAt)} />
          <Info label="Arrivée estimée" value={formatDate(shipment.etaAt)} />
          <Info label="Arrivée réelle" value={formatDate(shipment.actualArrivalAt)} />
          <Info label="Mise à disposition" value={formatDate(shipment.releasedAt)} />
        </dl>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        {/* Événements */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-navy-900 uppercase">Ajouter un événement d'expédition</h2>
            <p className="mt-1 text-xs text-slate-400">
              Un événement d'expédition peut être propagé à tous les colis du groupage — sans supprimer leur historique individuel.
            </p>
            <div className="mt-4">
              <ActionForm action={addShipmentEventAction} submitLabel="Enregistrer">
                <input type="hidden" name="shipmentId" value={shipment.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Étape *">
                    <select name="status" required defaultValue="" className={inputClass}>
                      <option value="">— Sélectionner —</option>
                      {SHIPMENT_STATUSES.filter((s) => s.key !== "CLOSED" || true).map((s) => (
                        <option key={s.key} value={s.key}>{s.label}</option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Date et heure *">
                    <input type="datetime-local" name="occurredAt" required defaultValue={nowLocal} className={inputClass} />
                  </Field>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Lieu">
                    <input name="location" className={inputClass} placeholder={isAir ? "Aéroport de…" : "Port de…"} />
                  </Field>
                  <Field label="Observation">
                    <input name="description" className={inputClass} />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" name="applyToPackages" defaultChecked className="h-4 w-4" />
                  Propager cette étape aux colis du groupage (statut équivalent par mode de transport)
                </label>
              </ActionForm>
            </div>
          </Card>

          <Card>
            <CardHeader title={`Colis du groupage (${shipment.packages.length})`} />
            <div className="border-b border-slate-100 p-4">
              <ActionForm action={attachPackageAction} submitLabel="Rattacher" className="flex flex-wrap items-end gap-3">
                <input type="hidden" name="shipmentId" value={shipment.id} />
                <Field label="Numéro de suivi du colis à rattacher" className="min-w-64 flex-1">
                  <input name="trackingNumber" required placeholder="XTER-2026-000001" className={inputClass} />
                </Field>
              </ActionForm>
            </div>
            {shipment.packages.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Aucun colis rattaché pour le moment.</p>
            ) : (
              <Table head={["N° suivi", "Client", "Statut", "Poids", ""]}>
                {shipment.packages.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs">
                      <Link href={`/admin/colis/${p.id}`} className="font-semibold text-navy-800">{p.trackingNumber}</Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/clients/${p.customer.id}`} className="text-sm text-slate-600 hover:text-accent-600">{p.customer.name}</Link>
                    </td>
                    <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                    <td className="px-4 py-3 text-xs text-slate-500">{p.weightKg ? p.weightKg + " kg" : "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <ActionForm action={detachPackageAction} submitLabel="Détacher" buttonClassName="text-xs font-semibold text-red-600 hover:underline" confirmMessage={`Détacher ${p.trackingNumber} de cette expédition ?`}>
                        <input type="hidden" name="packageId" value={p.id} />
                        <input type="hidden" name="shipmentId" value={shipment.id} />
                      </ActionForm>
                    </td>
                  </tr>
                ))}
              </Table>
            )}
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-navy-900 uppercase">Journal d'expédition ({shipment.events.length})</h2>
            {shipment.events.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Aucun événement.</p>
            ) : (
              <ol className="mt-4 space-y-3">
                {shipment.events.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 border-b border-slate-50 pb-3 last:border-0">
                    <Badge tone="navy">{SHIPMENT_STATUS_MAP[e.status]?.label ?? e.status}</Badge>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-slate-700">{e.description}</p>
                      <p className="mt-0.5 text-xs text-slate-400">
                        {formatDateTime(e.occurredAt)}{e.location ? ` · ${e.location}` : ""}{e.agent?.name ? ` · ${e.agent.name}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Colonne droite : modification, coûts, documents */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Modifier l'expédition</h2>
            <ActionForm action={updateShipmentAction} submitLabel="Enregistrer">
              <input type="hidden" name="id" value={shipment.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pays départ">
                  <input name="originCountry" defaultValue={shipment.originCountry ?? ""} className={inputClass} />
                </Field>
                <Field label="Pays arrivée">
                  <input name="destCountry" defaultValue={shipment.destCountry ?? ""} className={inputClass} />
                </Field>
                <Field label="Ville départ">
                  <input name="originCity" defaultValue={shipment.originCity ?? ""} className={inputClass} />
                </Field>
                <Field label="Ville arrivée">
                  <input name="destCity" defaultValue={shipment.destCity ?? ""} className={inputClass} />
                </Field>
                <Field label="Code départ">
                  <input name="originCode" defaultValue={shipment.originCode ?? ""} className={inputClass} />
                </Field>
                <Field label="Code arrivée">
                  <input name="destCode" defaultValue={shipment.destCode ?? ""} className={inputClass} />
                </Field>
              </div>
              <Field label="Transporteur">
                <select name="providerId" defaultValue={shipment.providerId ?? ""} className={inputClass}>
                  <option value="">— Aucun —</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Vol">
                  <input name="flightNumber" defaultValue={shipment.flightNumber ?? ""} className={inputClass} />
                </Field>
                <Field label="AWB maître">
                  <input name="awbNumber" defaultValue={shipment.awbNumber ?? ""} className={inputClass} />
                </Field>
                <Field label="Navire">
                  <input name="vesselName" defaultValue={shipment.vesselName ?? ""} className={inputClass} />
                </Field>
                <Field label="Voyage">
                  <input name="voyageNumber" defaultValue={shipment.voyageNumber ?? ""} className={inputClass} />
                </Field>
                <Field label="Conteneur">
                  <input name="containerNumber" defaultValue={shipment.containerNumber ?? ""} className={inputClass} />
                </Field>
                <Field label="BL">
                  <input name="blNumber" defaultValue={shipment.blNumber ?? ""} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Départ prévu">
                  <input type="datetime-local" name="plannedDepartureAt" defaultValue={toLocalInput(shipment.plannedDepartureAt)} className={inputClass} />
                </Field>
                <Field label="Arrivée estimée (ETA)">
                  <input type="datetime-local" name="etaAt" defaultValue={toLocalInput(shipment.etaAt)} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                {costs.map((c) => (
                  <Field key={c.key} label={c.label}>
                    <input name={c.key} type="number" step="0.01" min="0" defaultValue={shipment[c.key] ?? ""} className={inputClass} />
                  </Field>
                ))}
              </div>
              <Field label="Devise des coûts">
                <select name="currency" defaultValue={shipment.currency} className={inputClass}>
                  <option>XAF</option><option>EUR</option><option>USD</option>
                </select>
              </Field>
              {totalCosts > 0 && (
                <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  Total des coûts enregistrés : <strong>{formatMoney(totalCosts, shipment.currency)}</strong>
                </p>
              )}
              <Field label="Notes">
                <textarea name="notes" rows={2} defaultValue={shipment.notes ?? ""} className={inputClass} />
              </Field>
            </ActionForm>
          </Card>

          {isAir && (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-navy-900 uppercase">Rechercher un vol réel (API Amadeus)</h2>
              <div className="mt-4">
                <FlightsPanel
                  shipmentId={shipment.id}
                  defaultFrom={shipment.originCode ?? ""}
                  defaultTo={shipment.destCode ?? ""}
                  defaultDate={toLocalInput(shipment.plannedDepartureAt) || new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10)}
                />
              </div>
            </Card>
          )}

          {isAir && (
            <Card className="p-6">
              <h2 className="text-sm font-semibold text-navy-900 uppercase">Assistant AWB maître {shipment.awbNumber ? `(actuel : ${shipment.awbNumber})` : ""}</h2>
              <div className="mt-4">
                <AwbHelper shipmentId={shipment.id} providerPrefix={shipment.provider?.awbPrefix ?? null} currentAwb={shipment.awbNumber} />
              </div>
            </Card>
          )}

          <Card>
            <CardHeader title={`Documents (${shipment.documents.length})`} />
            <div className="p-4">
              {shipment.documents.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {shipment.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{d.title}</span>
                      <a href={`/api/documents/${d.id}`} className="shrink-0 text-xs font-semibold text-accent-600">Ouvrir</a>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={uploadShipmentDocumentAction} submitLabel="Ajouter">
                <input type="hidden" name="shipmentId" value={shipment.id} />
                <Field label="Fichier *" hint="Manifeste, liste de groupage, BL importé…">
                  <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <select name="kind" defaultValue="MANIFEST" className={inputClass}>
                      {Object.entries(DOCUMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Visibilité">
                    <select name="visibility" defaultValue="STAFF" className={inputClass}>
                      <option value="STAFF">Interne</option>
                      <option value="CLIENT">Partagé clients</option>
                    </select>
                  </Field>
                </div>
              </ActionForm>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-400 uppercase">{label}</dt>
      <dd className="mt-1 font-medium text-slate-700">{value}</dd>
      {sub && <dd className="text-xs text-slate-400">{sub}</dd>}
    </div>
  );
}

function toLocalInput(d: Date | null): string {
  if (!d) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
