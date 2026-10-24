import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, Table, EmptyState, Badge, inputClass, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createDestinationAction, toggleDestinationAction, deleteDestinationAction } from "@/app/actions/config";
import { DESTINATION_TYPES } from "@/lib/constants";

export const metadata = { title: "Destinations" };

export default function DestinationsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const destinations = await db.destination.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Destinations & référentiel géographique"
        subtitle="Pays, villes, aéroports, ports et entrepôts actifs — publiés sur le site public"
      />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        {destinations.length === 0 ? (
          <EmptyState title="Référentiel vide" hint="Exécutez `npm run db:seed` pour charger la liste de base, puis ajoutez vos destinations." />
        ) : (
          <Card>
            <Table head={["Nom", "Type", "Code", "Pays", "Statut", ""]}>
              {destinations.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-navy-900">{d.name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{DESTINATION_TYPES[d.type as keyof typeof DESTINATION_TYPES]}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-500">{d.code ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{d.country ?? "—"}</td>
                  <td className="px-4 py-3">{d.enabled ? <Badge tone="green">Actif</Badge> : <Badge tone="slate">Masqué</Badge>}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-3">
                      <ActionForm action={toggleDestinationAction} submitLabel={d.enabled ? "Masquer" : "Publier"} buttonClassName="text-xs font-semibold text-accent-600 hover:underline">
                        <input type="hidden" name="id" value={d.id} />
                      </ActionForm>
                      <ActionForm action={deleteDestinationAction} submitLabel="Supprimer" buttonClassName="text-xs font-semibold text-red-600 hover:underline" confirmMessage={`Supprimer « ${d.name} » du référentiel ?`}>
                        <input type="hidden" name="id" value={d.id} />
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        )}

        <Card className="h-fit p-6">
          <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Ajouter une destination</h2>
          <ActionForm action={createDestinationAction} submitLabel="Enregistrer">
            <Field label="Type *">
              <select name="type" required className={inputClass} defaultValue="CITY">
                {Object.entries(DESTINATION_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Nom *">
              <input name="name" required className={inputClass} placeholder="Ex : Aéroport de Genève" />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Code (IATA / LOCODE)">
                <input name="code" className={inputClass} placeholder="GVA" />
              </Field>
              <Field label="Code pays">
                <input name="countryCode" maxLength={2} className={inputClass} placeholder="CH" />
              </Field>
            </div>
            <Field label="Pays" hint="Requis pour les aéroports, ports, villes.">
              <input name="country" className={inputClass} placeholder="Suisse" />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
