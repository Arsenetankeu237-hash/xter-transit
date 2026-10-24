import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, StatusBadge, Badge, inputClass, Field, PageHeader, Alert } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { updatePackageAction, addPackageEventAction, correctEventAction, uploadPackageDocumentAction, archivePackageAction, setPackageShipmentAction } from "@/app/actions/packages";
import { assignDeliveryAction } from "@/app/actions/deliveries";
import { packageTimeline } from "@/lib/tracking";
import { formatDateTime, formatDate, formatMoney, formatWeight } from "@/lib/format";
import { statusesForMode, EVENT_SOURCES, DOCUMENT_KINDS, MODES } from "@/lib/constants";

export default async function PackageDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
      <Content packageId={id} />
    </Suspense>
  );
}

async function Content({ packageId }: { packageId: string }) {
  await connection(); // page dynamique : données et session à la demande
  const pkg = await db.package.findUnique({
    where: { id: packageId },
    include: {
      customer: { include: { addresses: true } },
      shipment: true,
      senderAddress: true,
      recipientAddress: true,
      documents: { orderBy: { createdAt: "desc" } },
      deliveries: { orderBy: { createdAt: "desc" }, include: { agent: { select: { name: true } } } },
    },
  });
  if (!pkg) notFound();

  const [timeline, shipments, deliveryAgents] = await Promise.all([
    packageTimeline(pkg.id),
    db.shipment.findMany({ where: { status: { notIn: ["CLOSED", "CANCELLED"] } }, orderBy: { createdAt: "desc" }, select: { id: true, reference: true, type: true, destCountry: true } }),
    db.user.findMany({ where: { active: true, role: "DELIVERY_AGENT" }, select: { id: true, name: true } }),
  ]);
  const nowLocal = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  return (
    <div className="space-y-6">
      <PageHeader
        title={pkg.trackingNumber}
        subtitle={`${MODES[pkg.mode as keyof typeof MODES]} · Client : ${pkg.customer.name} · Créé le ${formatDateTime(pkg.createdAt)}`}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={pkg.status} />
            <Link href={`/admin/colis/${pkg.id}/etiquette`} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
              Étiquette QR
            </Link>
            {pkg.archivedAt ? (
              <Badge tone="slate">Archivé</Badge>
            ) : null}
          </div>
        }
      />

      {pkg.holdFlag && <Alert tone="warning">Colis signalé (retard, document manquant ou régularisation en cours).</Alert>}

      {/* Résumé */}
      <Card className="p-6">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4 lg:grid-cols-6">
          <Info label="Poids réel" value={formatWeight(pkg.weightKg)} />
          <Info label="Poids volumétrique" value={formatWeight(pkg.volumetricWeightKg)} />
          <Info label="Poids taxable" value={formatWeight(pkg.taxableWeightKg)} />
          <Info label="Dimensions" value={pkg.lengthCm ? `${pkg.lengthCm}×${pkg.widthCm}×${pkg.heightCm} cm` : "—"} />
          <Info label="Pièces" value={pkg.pieces != null ? String(pkg.pieces) : "—"} />
          <Info label="Valeur déclarée" value={pkg.declaredValue != null ? formatMoney(pkg.declaredValue, pkg.declaredCurrency ?? "XAF") : "—"} />
        </dl>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Expéditeur</p>
            <p className="mt-1 text-slate-700">{pkg.senderAddress ? `${pkg.senderAddress.contactName} — ${pkg.senderAddress.city}, ${pkg.senderAddress.country}` : "Non renseigné"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase">Destinataire</p>
            <p className="mt-1 text-slate-700">{pkg.recipientAddress ? `${pkg.recipientAddress.contactName} — ${pkg.recipientAddress.city}, ${pkg.recipientAddress.country}` : "Non renseigné"}</p>
          </div>
        </div>
        {pkg.contentDescription && <p className="mt-4 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">Contenu : {pkg.contentDescription}</p>}
        {pkg.shipment && (
          <p className="mt-3 text-sm">
            Expédition : <Link href={`/admin/expeditions/${pkg.shipment.id}`} className="font-mono font-semibold text-accent-600">{pkg.shipment.reference}</Link>
            {pkg.shipment.groupage && " (groupage)"}
          </p>
        )}
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_1fr]">
        {/* Timeline + ajout événement */}
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-navy-900 uppercase">Ajouter un événement de suivi</h2>
            <div className="mt-4">
              <ActionForm action={addPackageEventAction} submitLabel="Enregistrer l'événement">
                <input type="hidden" name="targetId" value={pkg.id} />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Statut *">
                    <select name="status" required className={inputClass} defaultValue="">
                      <option value="">— Sélectionner —</option>
                      {statusesForMode(pkg.mode).map((s) => (
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
                    <input name="location" className={inputClass} placeholder="Ex : Entrepôt Douala / Aéroport CDG" />
                  </Field>
                  <Field label="Observation">
                    <input name="description" className={inputClass} placeholder="Détail de l'étape…" />
                  </Field>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  <input type="checkbox" name="visiblePublic" defaultChecked className="h-4 w-4" />
                  Visible dans le suivi public
                </label>
              </ActionForm>
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-navy-900 uppercase">Historique ({timeline.length})</h2>
            {timeline.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">Aucun événement.</p>
            ) : (
              <ol className="mt-6 space-y-0 border-l-2 border-navy-100 pl-6">
                {timeline.map((e, i) => (
                  <li key={e.id} className={`relative pb-6 last:pb-0 ${e.corrected ? "opacity-50" : ""}`}>
                    <span className={`absolute top-1 -left-[31px] h-3 w-3 rounded-full border-2 ${i === 0 && !e.corrected ? "border-accent-500 bg-accent-500" : e.corrected ? "border-slate-300 bg-white" : "border-navy-200 bg-white"}`} />
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={e.status} />
                      {e.corrected && <Badge tone="slate">corrigé — conservé pour audit</Badge>}
                      {e.scope === "shipment" && <Badge tone="navy">expédition {e.shipmentRef}</Badge>}
                      <span className="text-[10px] text-slate-400">
                        {EVENT_SOURCES[e.source as keyof typeof EVENT_SOURCES]}
                        {e.agentName ? ` · ${e.agentName}` : ""}
                        {e.externalRef ? ` · réf. ${e.externalRef}` : ""}
                      </span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-400">{formatDateTime(e.occurredAt)}{e.location ? ` · ${e.location}` : ""}</p>
                    {e.description && <p className="mt-1 text-sm text-slate-600">{e.description}</p>}
                    {!e.corrected && e.source === "MANUAL" && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-xs font-semibold text-slate-400 hover:text-accent-600">Corriger cet événement</summary>
                        <div className="mt-3 rounded-lg border border-slate-100 bg-slate-50 p-4">
                          <ActionForm action={correctEventAction} submitLabel="Enregistrer la correction" buttonClassName="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600">
                            <input type="hidden" name="eventId" value={e.id} />
                            <input type="hidden" name="packageId" value={pkg.id} />
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Field label="Nouveau statut">
                                <select name="status" className={inputClass} defaultValue={e.status}>
                                  {statusesForMode(pkg.mode).map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
                                </select>
                              </Field>
                              <Field label="Nouvelle date">
                                <input type="datetime-local" name="occurredAt" className={inputClass} defaultValue={new Date(e.occurredAt.getTime() - e.occurredAt.getTimezoneOffset() * 60000).toISOString().slice(0, 16)} />
                              </Field>
                            </div>
                            <Field label="Nouveau lieu / description">
                              <input name="description" className={inputClass} defaultValue={e.description} />
                            </Field>
                            <Field label="Justification *">
                              <input name="reason" required className={inputClass} placeholder="Motif de la correction (tracé dans l'audit)" />
                            </Field>
                          </ActionForm>
                        </div>
                      </details>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="space-y-6">
          {/* Expédition */}
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Expédition</h2>
            <ActionForm action={setPackageShipmentAction} submitLabel="Appliquer">
              <input type="hidden" name="packageId" value={pkg.id} />
              <Field label="Rattacher à une expédition" hint="Le mode de transport suivra l'expédition. Le colis garde son propre historique de suivi.">
                <select name="shipmentId" defaultValue={pkg.shipmentId ?? ""} className={inputClass}>
                  <option value="">— Aucune (colis isolé) —</option>
                  {shipments.map((s) => (
                    <option key={s.id} value={s.id}>{s.reference} · {s.type === "AIR" ? "Aérien" : "Maritime"}{s.destCountry ? ` → ${s.destCountry}` : ""}</option>
                  ))}
                </select>
              </Field>
            </ActionForm>
          </Card>

          {/* Livraison */}
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Livraison finale</h2>
            {pkg.deliveries.length > 0 && (
              <ul className="mb-4 space-y-2">
                {pkg.deliveries.map((d) => (
                  <li key={d.id} className="rounded-lg border border-slate-100 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-navy-800">{d.status}</span>
                      <span className="text-slate-400">{formatDate(d.lastAttemptAt ?? d.createdAt)}{d.agent ? ` · ${d.agent.name}` : ""}</span>
                    </div>
                    {d.recipientName && <p className="mt-1 text-slate-500">Réceptionnaire : {d.recipientName}</p>}
                    {d.note && <p className="text-slate-500">{d.note}</p>}
                  </li>
                ))}
              </ul>
            )}
            {["DELIVERED", "RETURNED_TO_SENDER", "CANCELLED"].includes(pkg.status) ? (
              <p className="text-sm text-slate-500">Colis clôturé — pas de nouvelle livraison.</p>
            ) : (
              <ActionForm action={assignDeliveryAction} submitLabel="Affecter la livraison">
                <input type="hidden" name="packageId" value={pkg.id} />
                <Field label="Agent de livraison">
                  <select name="agentId" className={inputClass} defaultValue="">
                    <option value="">— Non affecté —</option>
                    {deliveryAgents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="Planifiée le">
                  <input type="datetime-local" name="scheduledFor" className={inputClass} />
                </Field>
              </ActionForm>
            )}
          </Card>

          {/* Documents */}
          <Card>
            <CardHeader title={`Documents (${pkg.documents.length})`} />
            <div className="p-4">
              {pkg.documents.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {pkg.documents.map((d) => (
                    <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="min-w-0 truncate text-slate-700" title={d.title}>
                        {d.title} {d.visibility === "CLIENT" && <Badge tone="green">client</Badge>}
                      </span>
                      <a href={`/api/documents/${d.id}`} className="shrink-0 text-xs font-semibold text-accent-600">Ouvrir</a>
                    </li>
                  ))}
                </ul>
              )}
              <ActionForm action={uploadPackageDocumentAction} submitLabel="Ajouter le document">
                <input type="hidden" name="packageId" value={pkg.id} />
                <Field label="Fichier *" hint="PDF, PNG, JPEG, WebP — 10 Mo max. Stockage privé.">
                  <input type="file" name="file" required accept=".pdf,.png,.jpg,.jpeg,.webp" className={inputClass} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Type">
                    <select name="kind" className={inputClass} defaultValue="OTHER">
                      {Object.entries(DOCUMENT_KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Visibilité">
                    <select name="visibility" className={inputClass} defaultValue="STAFF">
                      <option value="STAFF">Interne uniquement</option>
                      <option value="CLIENT">Partagé avec le client</option>
                    </select>
                  </Field>
                </div>
                <Field label="Titre">
                  <input name="title" className={inputClass} placeholder="Ex : Facture fret, photo réception…" />
                </Field>
              </ActionForm>
            </div>
          </Card>
        </div>
      </div>

      {/* Modification */}
      <Card className="p-6">
        <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Modifier le colis</h2>
        <ActionForm action={updatePackageAction} submitLabel="Enregistrer les modifications">
          <input type="hidden" name="id" value={pkg.id} />
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Mode">
              <select name="mode" defaultValue={pkg.mode} className={inputClass}>
                <option value="AIR">Fret aérien</option>
                <option value="SEA">Fret maritime</option>
              </select>
            </Field>
            <Field label="Référence">
              <input name="reference" defaultValue={pkg.reference ?? ""} className={inputClass} />
            </Field>
            <Field label="Pièces">
              <input name="pieces" type="number" min="1" defaultValue={pkg.pieces ?? ""} className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Poids (kg)">
              <input name="weightKg" type="number" step="0.01" min="0" defaultValue={pkg.weightKg ?? ""} className={inputClass} />
            </Field>
            <Field label="Longueur (cm)">
              <input name="lengthCm" type="number" step="0.1" min="0" defaultValue={pkg.lengthCm ?? ""} className={inputClass} />
            </Field>
            <Field label="Largeur (cm)">
              <input name="widthCm" type="number" step="0.1" min="0" defaultValue={pkg.widthCm ?? ""} className={inputClass} />
            </Field>
            <Field label="Hauteur (cm)">
              <input name="heightCm" type="number" step="0.1" min="0" defaultValue={pkg.heightCm ?? ""} className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Expéditeur">
              <select name="senderAddressId" defaultValue={pkg.senderAddressId ?? ""} className={inputClass}>
                <option value="">—</option>
                {pkg.customer.addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.contactName} ({a.city})</option>)}
              </select>
            </Field>
            <Field label="Destinataire">
              <select name="recipientAddressId" defaultValue={pkg.recipientAddressId ?? ""} className={inputClass}>
                <option value="">—</option>
                {pkg.customer.addresses.map((a) => <option key={a.id} value={a.id}>{a.label} — {a.contactName} ({a.city})</option>)}
              </select>
            </Field>
          </div>
          <Field label="Description du contenu">
            <input name="contentDescription" defaultValue={pkg.contentDescription ?? ""} className={inputClass} />
          </Field>
          <Field label="Instructions de manutention">
            <textarea name="handlingInstructions" rows={2} defaultValue={pkg.handlingInstructions ?? ""} className={inputClass} />
          </Field>
        </ActionForm>
        <div className="mt-6 border-t border-slate-100 pt-4">
          <ActionForm action={archivePackageAction} submitLabel={pkg.archivedAt ? "Désarchiver" : "Archiver"} buttonClassName="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100" confirmMessage={pkg.archivedAt ? undefined : "Archiver ce colis ? Il sera masqué des listes actives mais conservé dans l'historique."}>
            <input type="hidden" name="id" value={pkg.id} />
          </ActionForm>
        </div>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-400 uppercase">{label}</dt>
      <dd className="mt-1 font-medium text-slate-700">{value}</dd>
    </div>
  );
}
