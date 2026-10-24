import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, Table, EmptyState, Badge, inputClass, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createProviderAction, toggleProviderAction } from "@/app/actions/config";
import { PROVIDER_TYPES } from "@/lib/constants";

export const metadata = { title: "Partenaires" };

export default function PartenairesPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const providers = await db.transportProvider.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { shipments: true, integrations: true } } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Partenaires & référentiel transporteurs"
        subtitle="Compagnies aériennes et maritimes, transitaires, agents en douane, prestataires de livraison"
      />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {providers.length === 0 ? (
          <EmptyState title="Aucun partenaire enregistré" hint="Ajoutez vos transporteurs et partenaires : ils seront proposés dans les expéditions et les intégrations." />
        ) : (
          <Card>
            <Table head={["Nom", "Type", "Contact", "Expéditions", "Intégrations", "Statut", ""]}>
              {providers.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-navy-900">{p.name}</p>
                    {p.country && <p className="text-xs text-slate-400">{p.city ? p.city + ", " : ""}{p.country}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">{PROVIDER_TYPES[p.type as keyof typeof PROVIDER_TYPES] ?? p.type}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {p.contactName && <div>{p.contactName}</div>}
                    {p.phone && <div>{p.phone}</div>}
                    {p.email && <div>{p.email}</div>}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-navy-800">{p._count.shipments}</td>
                  <td className="px-4 py-3 text-sm">{p._count.integrations > 0 ? <Badge tone="green">{p._count.integrations}</Badge> : <span className="text-slate-400">—</span>}</td>
                  <td className="px-4 py-3">{p.active ? <Badge tone="green">Actif</Badge> : <Badge tone="red">Inactif</Badge>}</td>
                  <td className="px-4 py-3 text-right">
                    <ActionForm action={toggleProviderAction} submitLabel={p.active ? "Désactiver" : "Activer"} buttonClassName="text-xs font-semibold text-accent-600 hover:underline">
                      <input type="hidden" name="id" value={p.id} />
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        )}

        <Card className="h-fit p-6">
          <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Nouveau partenaire</h2>
          <ActionForm action={createProviderAction} submitLabel="Enregistrer le partenaire">
            <Field label="Nom *">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Type *">
              <select name="type" required className={inputClass}>
                {Object.entries(PROVIDER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pays">
                <input name="country" className={inputClass} />
              </Field>
              <Field label="Ville">
                <input name="city" className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Contact">
                <input name="contactName" className={inputClass} />
              </Field>
              <Field label="Téléphone">
                <input name="phone" className={inputClass} />
              </Field>
            </div>
            <Field label="E-mail">
              <input name="email" type="email" className={inputClass} />
            </Field>
            <Field label="Préfixe AWB IATA (fret aérien)" hint="3 chiffres — ex : 057 (Air France), 176 (Emirates). Utilisé par l'assistant AWB des expéditions.">
              <input name="awbPrefix" maxLength={3} className={inputClass + " font-mono"} placeholder="057" inputMode="numeric" />
            </Field>
            <Field label="Services proposés">
              <textarea name="services" rows={2} className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
