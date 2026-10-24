import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, PageHeader, inputClass, Field } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createShipmentAction } from "@/app/actions/shipments";

export const metadata = { title: "Nouvelle expédition" };

export default function NewShipmentPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const providers = await db.transportProvider.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true, type: true },
  });

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nouvelle expédition"
        subtitle="Une expédition regroupe plusieurs colis (groupage) ou transporte un conteneur complet. Chaque colis reste suivi individuellement."
      />
      <Card className="p-6">
        <ActionForm action={createShipmentAction} submitLabel="Créer l'expédition">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Type de fret *">
              <select name="type" required defaultValue="AIR" className={inputClass}>
                <option value="AIR">Aérien</option>
                <option value="SEA">Maritime</option>
              </select>
            </Field>
            <Field label="Groupage (plusieurs clients)">
              <select name="groupage" defaultValue="false" className={inputClass}>
                <option value="false">Non — expédition dédiée</option>
                <option value="true">Oui — groupage multi-clients</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pays de départ">
              <input name="originCountry" className={inputClass} placeholder="Ex : Cameroun" />
            </Field>
            <Field label="Ville / Aéroport / Port de départ">
              <input name="originCity" className={inputClass} placeholder="Ex : Douala" />
            </Field>
            <Field label="Code (IATA / UN-LOCODE)">
              <input name="originCode" className={inputClass} placeholder="DLA / CMDLA" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Pays de destination">
              <input name="destCountry" className={inputClass} placeholder="Ex : France" />
            </Field>
            <Field label="Ville / Aéroport / Port d'arrivée">
              <input name="destCity" className={inputClass} placeholder="Ex : Paris" />
            </Field>
            <Field label="Code (IATA / UN-LOCODE)">
              <input name="destCode" className={inputClass} placeholder="CDG / FRLEH" />
            </Field>
          </div>

          <Field label="Transporteur">
            <select name="providerId" defaultValue="" className={inputClass}>
              <option value="">— Aucun —</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="N° de vol (aérien)">
              <input name="flightNumber" className={inputClass} placeholder="AF982" />
            </Field>
            <Field label="N° AWB maître (aérien)">
              <input name="awbNumber" className={inputClass} placeholder="057-12345675" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Navire (maritime)">
              <input name="vesselName" className={inputClass} />
            </Field>
            <Field label="N° de voyage">
              <input name="voyageNumber" className={inputClass} />
            </Field>
            <Field label="N° de connaissement (BL)">
              <input name="blNumber" className={inputClass} />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="N° de conteneur">
              <input name="containerNumber" className={inputClass} placeholder="MSCU1234567" />
            </Field>
            <Field label="Type de conteneur">
              <select name="containerType" defaultValue="" className={inputClass}>
                <option value="">—</option>
                <option value="20'">20 pieds</option>
                <option value="40'">40 pieds</option>
                <option value="40'HC">40 pieds High Cube</option>
                <option value="LCL">Groupage (LCL)</option>
              </select>
            </Field>
          </div>

          <Field label="Notes">
            <textarea name="notes" rows={2} className={inputClass} />
          </Field>
        </ActionForm>
      </Card>
    </div>
  );
}
