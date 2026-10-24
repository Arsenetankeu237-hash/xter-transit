import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, PageHeader, Table, StatusBadge, Badge, inputClass, Field, Alert } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { updateCustomerAction, createAddressAction, createPortalAccountAction } from "@/app/actions/customers";
import { formatDate, formatMoney } from "@/lib/format";
import { CUSTOMER_TYPES } from "@/lib/constants";

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
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
      <Content customerId={id} />
    </Suspense>
  );
}

async function Content({ customerId }: { customerId: string }) {
  await connection(); // page dynamique : données et session à la demande
  const customer = await db.customer.findUnique({
    where: { id: customerId },
    include: {
      addresses: true,
      users: true,
      packages: { orderBy: { createdAt: "desc" }, take: 20 },
      invoices: { orderBy: { createdAt: "desc" }, take: 10, include: { payments: { where: { status: "CONFIRMED" } } } },
      quotes: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!customer) notFound();

  const outstanding = customer.invoices
    .filter((i) => i.status === "ISSUED" || i.status === "PARTIAL")
    .reduce((s, i) => s + i.total - i.payments.reduce((p, x) => p + x.amount, 0), 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        subtitle={`${customer.code} · ${CUSTOMER_TYPES[customer.type as keyof typeof CUSTOMER_TYPES]} · Client depuis le ${formatDate(customer.createdAt)}`}
        action={
          <div className="flex items-center gap-3">
            {outstanding > 0 && <Badge tone="amber">Solde dû : {formatMoney(outstanding)}</Badge>}
            <Link href={`/admin/colis/nouveau?customer=${customer.id}`} className="rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white hover:bg-accent-600">
              + Nouveau colis
            </Link>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Fiche client */}
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Fiche client</h2>
          <ActionForm action={updateCustomerAction} submitLabel="Enregistrer">
            <input type="hidden" name="id" value={customer.id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom / Raison sociale *">
                <input name="name" required defaultValue={customer.name} className={inputClass} />
              </Field>
              <Field label="Type *">
                <select name="type" defaultValue={customer.type} className={inputClass}>
                  {Object.entries(CUSTOMER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="Téléphone">
                <input name="phone" defaultValue={customer.phone ?? ""} className={inputClass} />
              </Field>
              <Field label="Téléphone 2">
                <input name="phone2" defaultValue={customer.phone2 ?? ""} className={inputClass} />
              </Field>
              <Field label="E-mail">
                <input name="email" type="email" defaultValue={customer.email ?? ""} className={inputClass} />
              </Field>
              <Field label="N° fiscal / RCCM">
                <input name="taxId" defaultValue={customer.taxId ?? ""} className={inputClass} />
              </Field>
              <Field label="Pays">
                <input name="country" defaultValue={customer.country ?? ""} className={inputClass} />
              </Field>
              <Field label="Ville">
                <input name="city" defaultValue={customer.city ?? ""} className={inputClass} />
              </Field>
            </div>
            <Field label="Adresse" className="mt-4">
              <input name="addressLine" defaultValue={customer.addressLine ?? ""} className={inputClass} />
            </Field>
            <Field label="Notes internes" className="mt-4">
              <textarea name="notes" rows={3} defaultValue={customer.notes ?? ""} className={inputClass} />
            </Field>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <input type="checkbox" name="active" defaultChecked={customer.active} className="h-4 w-4 rounded" />
              Client actif
            </label>
          </ActionForm>
        </Card>

        <div className="space-y-6">
          {/* Compte portail */}
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Compte espace client</h2>
            {customer.users.length > 0 ? (
              <div className="space-y-2">
                {customer.users.map((u) => (
                  <div key={u.id} className="flex items-center justify-between rounded-lg border border-slate-100 bg-slate-50 px-4 py-2.5 text-sm">
                    <span>
                      <span className="font-medium text-navy-900">{u.name}</span>
                      <span className="ml-2 text-xs text-slate-500">{u.email}</span>
                    </span>
                    {u.active ? <Badge tone="green">Actif</Badge> : <Badge tone="red">Désactivé</Badge>}
                  </div>
                ))}
                <p className="text-xs text-slate-400">Gérez la désactivation et la réinitialisation dans « Utilisateurs & rôles ».</p>
              </div>
            ) : (
              <ActionForm action={createPortalAccountAction} submitLabel="Créer le compte client">
                <input type="hidden" name="customerId" value={customer.id} />
                <Field label="Nom du titulaire *">
                  <input name="name" required defaultValue={customer.name} className={inputClass} />
                </Field>
                <Field label="E-mail de connexion *">
                  <input name="email" type="email" required defaultValue={customer.email ?? ""} className={inputClass} />
                </Field>
                <Field label="Mot de passe provisoire *" hint="8 caractères minimum — à communiquer au client, qui devra le changer.">
                  <input name="password" type="text" required minLength={8} className={inputClass} defaultValue={Math.random().toString(36).slice(2, 10) + "A1!"} />
                </Field>
              </ActionForm>
            )}
          </Card>

          {/* Adresses */}
          <Card>
            <CardHeader title={`Adresses (${customer.addresses.length})`} />
            <div className="max-h-72 space-y-2 overflow-y-auto p-4">
              {customer.addresses.length === 0 && <p className="text-sm text-slate-500">Aucune adresse enregistrée.</p>}
              {customer.addresses.map((a) => (
                <div key={a.id} className="rounded-lg border border-slate-100 px-4 py-2.5 text-sm">
                  <p className="font-medium text-navy-900">{a.label} — {a.contactName}</p>
                  <p className="mt-0.5 text-xs text-slate-500">{a.line1}{a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.country}{a.phone ? ` · ${a.phone}` : ""}</p>
                </div>
              ))}
            </div>
            <div className="border-t border-slate-100 p-4">
              <details>
                <summary className="cursor-pointer text-xs font-semibold text-accent-600">+ Ajouter une adresse (expéditeur / destinataire)</summary>
                <div className="mt-4">
                  <ActionForm action={createAddressAction} submitLabel="Enregistrer l'adresse">
                    <input type="hidden" name="customerId" value={customer.id} />
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Libellé *">
                        <input name="label" required placeholder="Ex : Destinataire Paris" className={inputClass} />
                      </Field>
                      <Field label="Nom du contact *">
                        <input name="contactName" required className={inputClass} />
                      </Field>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <Field label="Pays *">
                        <input name="country" required className={inputClass} />
                      </Field>
                      <Field label="Ville *">
                        <input name="city" required className={inputClass} />
                      </Field>
                      <Field label="Téléphone">
                        <input name="phone" className={inputClass} />
                      </Field>
                    </div>
                    <Field label="Adresse *">
                      <input name="line1" required className={inputClass} />
                    </Field>
                  </ActionForm>
                </div>
              </details>
            </div>
          </Card>
        </div>
      </div>

      {/* Historique colis */}
      <Card>
        <CardHeader title={`Colis (${customer.packages.length})`} />
        {customer.packages.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">Aucun colis pour ce client.</p>
        ) : (
          <Table head={["N° suivi", "Mode", "Statut", "Créé le", ""]}>
            {customer.packages.map((p) => (
              <tr key={p.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-800">
                  <Link href={`/admin/colis/${p.id}`}>{p.trackingNumber}</Link>
                </td>
                <td className="px-4 py-3 text-sm text-slate-600">{p.mode === "AIR" ? "Aérien" : "Maritime"}</td>
                <td className="px-4 py-3"><StatusBadge status={p.status} /></td>
                <td className="px-4 py-3 text-xs text-slate-400">{formatDate(p.createdAt)}</td>
                <td className="px-4 py-3 text-right"><Link href={`/admin/colis/${p.id}`} className="text-xs font-semibold text-accent-600">Ouvrir</Link></td>
              </tr>
            ))}
          </Table>
        )}
      </Card>

      {/* Factures & devis */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Factures récentes" />
          {customer.invoices.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Aucune facture.</p>
          ) : (
            <Table head={["N°", "Total", "Statut", ""]}>
              {customer.invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/admin/factures/${inv.id}`} className="font-semibold text-navy-800">{inv.number}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-sm">{formatMoney(inv.total, inv.currency)}</td>
                  <td className="px-4 py-2.5"><Badge tone={inv.status === "PAID" ? "green" : inv.status === "CANCELLED" ? "red" : "amber"}>{inv.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/admin/factures/${inv.id}`} className="text-xs font-semibold text-accent-600">Ouvrir</Link></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="Devis récents" />
          {customer.quotes.length === 0 ? (
            <p className="p-6 text-sm text-slate-500">Aucun devis.</p>
          ) : (
            <Table head={["N°", "Trajet", "Total", "Statut", ""]}>
              {customer.quotes.map((q) => (
                <tr key={q.id}>
                  <td className="px-4 py-2.5 font-mono text-xs">
                    <Link href={`/admin/devis/${q.id}`} className="font-semibold text-navy-800">{q.number}</Link>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{q.originCountry ?? "?"} → {q.destCountry ?? "?"}</td>
                  <td className="px-4 py-2.5 text-sm">{q.total != null ? formatMoney(q.total, q.currency ?? "XAF") : "—"}</td>
                  <td className="px-4 py-2.5"><Badge tone={q.status === "ACCEPTED" ? "green" : q.status === "SENT" ? "blue" : "slate"}>{q.status}</Badge></td>
                  <td className="px-4 py-2.5 text-right"><Link href={`/admin/devis/${q.id}`} className="text-xs font-semibold text-accent-600">Ouvrir</Link></td>
                </tr>
              ))}
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
