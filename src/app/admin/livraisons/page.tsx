import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader, Table, EmptyState, Badge, StatusBadge, inputClass, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { assignDeliveryAction } from "@/app/actions/deliveries";
import { DeliveryAttemptForm } from "@/components/delivery-attempt-form";
import { formatDateTime, formatDate } from "@/lib/format";
import { DELIVERY_STATUSES } from "@/lib/constants";
import { getSessionUser } from "@/lib/auth";

export const metadata = { title: "Livraisons" };

export default async function DeliveriesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const user = await getSessionUser();
  const isAgent = user?.role === "DELIVERY_AGENT";

  const deliveries = await db.delivery.findMany({
    where: isAgent && user ? { agentId: user.id, status: { in: ["ASSIGNED", "IN_PROGRESS", "RESCHEDULED"] } } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      agent: { select: { name: true } },
      package: { include: { customer: { select: { name: true } }, recipientAddress: true } },
    },
  });

  const [availablePackages, agents] = await Promise.all([
    db.package.findMany({
      where: { archivedAt: null, status: { in: ["CUSTOMS_CLEARED", "AVAILABLE_PICKUP", "OUT_FOR_DELIVERY"] }, deliveries: { none: { status: { in: ["ASSIGNED", "IN_PROGRESS", "RESCHEDULED"] } } } },
      orderBy: { statusUpdatedAt: "desc" },
      take: 200,
      select: { id: true, trackingNumber: true, customer: { select: { name: true } } },
    }),
    db.user.findMany({ where: { active: true, role: "DELIVERY_AGENT" }, select: { id: true, name: true } }),
  ]);

  const open = deliveries.filter((d) => ["ASSIGNED", "IN_PROGRESS", "RESCHEDULED"].includes(d.status));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Livraisons finales"
        subtitle={isAgent ? "Vos tournées du moment" : "Affectation des colis et enregistrement des preuves de réception"}
      />

      {/* Tournées ouvertes avec formulaire de tentative */}
      <div className="space-y-4">
        {open.length === 0 && (
          <EmptyState title="Aucune livraison en cours" hint={isAgent ? "Aucune tournée affectée pour le moment." : "Affectez un colis disponible ci-dessous pour créer une tournée."} />
        )}
        {open.map((d) => (
          <Card key={d.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-sm font-bold text-navy-900">
                  <Link href={`/admin/colis/${d.package.id}`} className="hover:text-accent-600">{d.package.trackingNumber}</Link>
                  <span className="ml-2 font-sans text-xs font-normal text-slate-500">{d.package.customer.name}</span>
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Destinataire : {d.package.recipientAddress ? `${d.package.recipientAddress.contactName} — ${d.package.recipientAddress.line1 ?? ""}, ${d.package.recipientAddress.city}` : "non renseigné"}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Agent : {d.agent?.name ?? "non affecté"} · Planifiée : {formatDateTime(d.scheduledFor)} · Tentatives : {d.attempts}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={d.package.status} />
                <Badge tone="navy">{DELIVERY_STATUSES[d.status as keyof typeof DELIVERY_STATUSES]}</Badge>
              </div>
            </div>
            <details className="mt-4">
              <summary className="cursor-pointer rounded-lg bg-navy-50 px-4 py-2 text-sm font-semibold text-navy-800">
                Enregistrer une tentative (résultat, photo, signature)
              </summary>
              <div className="mt-4">
                <DeliveryAttemptForm deliveryId={d.id} packageTracking={d.package.trackingNumber} />
              </div>
            </details>
          </Card>
        ))}
      </div>

      {/* Historique */}
      <Card>
        <CardHeader title={`Historique des livraisons (${deliveries.length})`} />
        {deliveries.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Aucune livraison enregistrée.</p>
        ) : (
          <Table head={["Colis", "Client", "Agent", "Statut", "Tentatives", "Livré le", "Réceptionnaire", "Preuves"]}>
            {deliveries.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs">
                  <Link href={`/admin/colis/${d.package.id}`} className="font-semibold text-navy-800">{d.package.trackingNumber}</Link>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{d.package.customer.name}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{d.agent?.name ?? "—"}</td>
                <td className="px-4 py-3">
                  <Badge tone={d.status === "DELIVERED" ? "green" : d.status === "FAILED" ? "red" : "amber"}>
                    {DELIVERY_STATUSES[d.status as keyof typeof DELIVERY_STATUSES]}
                  </Badge>
                </td>
                <td className="px-4 py-3 text-sm">{d.attempts}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{formatDate(d.deliveredAt)}</td>
                <td className="px-4 py-3 text-xs text-slate-600">{d.recipientName ?? "—"}</td>
                <td className="px-4 py-3 text-xs">
                  {d.photoDocId && <a href={`/api/documents/${d.photoDocId}`} className="mr-2 font-semibold text-accent-600">Photo</a>}
                  {d.signatureDocId && <a href={`/api/documents/${d.signatureDocId}`} className="font-semibold text-accent-600">Signature</a>}
                  {!d.photoDocId && !d.signatureDocId && "—"}
                </td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Affectation */}
      {!isAgent && (
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Affecter une nouvelle livraison</h2>
          {availablePackages.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun colis prêt pour la livraison (statuts attendus : dédouanement terminé, disponible, en cours de livraison).</p>
          ) : (
            <ActionForm action={assignDeliveryAction} submitLabel="Affecter la livraison" className="grid items-end gap-4 sm:grid-cols-3">
              <Field label="Colis *">
                <select name="packageId" required className={inputClass}>
                  <option value="">— Sélectionner —</option>
                  {availablePackages.map((p) => (
                    <option key={p.id} value={p.id}>{p.trackingNumber} — {p.customer.name}</option>
                  ))}
                </select>
              </Field>
              <Field label="Agent de livraison">
                <select name="agentId" className={inputClass} defaultValue="">
                  <option value="">— Non affecté —</option>
                  {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="Planifiée le">
                <input type="datetime-local" name="scheduledFor" className={inputClass} />
              </Field>
            </ActionForm>
          )}
        </Card>
      )}
    </div>
  );
}
