import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, PageHeader, inputClass, Field, Alert } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createPackageAction } from "@/app/actions/packages";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Nouveau colis" };

export default function NewPackagePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <ResolveSearchParams searchParams={searchParams} />
    </Suspense>
  );
}

async function ResolveSearchParams({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  return <Content defaultCustomer={customer} />;
}

async function Content({ defaultCustomer }: { defaultCustomer?: string }) {
  await connection(); // page dynamique : données et session à la demande
  const [customers, settings] = await Promise.all([
    db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true, addresses: true } }),
    getSettings(),
  ]);

  if (customers.length === 0) {
    return (
      <>
        <PageHeader title="Nouveau colis" />
        <Alert tone="warning">
          Aucun client enregistré : créez d'abord une fiche client (<a href="/admin/clients" className="underline">Clients → Nouveau client</a>).
        </Alert>
      </>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Nouveau colis"
        subtitle={`Le numéro de suivi est généré automatiquement au format ${settings.trackingPattern.replace("{PREFIX}", settings.trackingPrefix).replace("{YYYY}", "2026").replace("{SEQ}", "000001")} (personnalisable dans les paramètres).`}
      />
      <Card className="p-6">
        <ActionForm action={createPackageAction} submitLabel="Enregistrer le colis">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Client *">
              <select name="customerId" required defaultValue={defaultCustomer ?? ""} className={inputClass}>
                <option value="">— Sélectionner —</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>{c.code} — {c.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Mode de transport *">
              <select name="mode" required defaultValue="AIR" className={inputClass}>
                <option value="AIR">Fret aérien</option>
                <option value="SEA">Fret maritime</option>
              </select>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Référence commande / client">
              <input name="reference" className={inputClass} />
            </Field>
            <Field label="Nombre de colis (pièces)">
              <input name="pieces" type="number" min="1" step="1" className={inputClass} />
            </Field>
          </div>

          <Field label="Description du contenu">
            <input name="contentDescription" className={inputClass} placeholder="Ex : 2 cartons de vêtements" />
          </Field>
          <Field label="Nature de la marchandise">
            <input name="natureOfGoods" className={inputClass} placeholder="Ex : effets personnels, pièces détachées…" />
          </Field>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Poids réel (kg)">
              <input name="weightKg" type="number" step="0.01" min="0" className={inputClass} />
            </Field>
            <Field label="Longueur (cm)">
              <input name="lengthCm" type="number" step="0.1" min="0" className={inputClass} />
            </Field>
            <Field label="Largeur (cm)">
              <input name="widthCm" type="number" step="0.1" min="0" className={inputClass} />
            </Field>
            <Field label="Hauteur (cm)">
              <input name="heightCm" type="number" step="0.1" min="0" className={inputClass} />
            </Field>
          </div>
          <p className="text-xs text-slate-400">
            Poids volumétrique aérien calculé automatiquement : L × l × H ÷ {settings.volumetricDivisor}. Le poids taxable retenu est le maximum des deux.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Valeur déclarée">
              <input name="declaredValue" type="number" step="0.01" min="0" className={inputClass} />
            </Field>
            <Field label="Devise de la valeur">
              <select name="declaredCurrency" defaultValue={settings.defaultCurrency} className={inputClass}>
                {settings.currencies.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Instructions de manutention">
            <textarea name="handlingInstructions" rows={2} className={inputClass} placeholder="Fragile, haut, ne pas empiler…" />
          </Field>
        </ActionForm>
      </Card>

      <p className="mt-4 text-xs text-slate-400">
        Expéditeur / destinataire : sélectionnez-les après création dans la fiche du colis (adresses du client), onglet « Modifier ».
      </p>
    </div>
  );
}
