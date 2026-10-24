import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Card, CardHeader, inputClass, Field, PageHeader, Alert } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { saveSettingsAction } from "@/app/actions/config";

export const metadata = { title: "Paramètres" };

export default function ParametresPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const s = await getSettings();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Paramètres de la plateforme"
        subtitle="Identité de marque, coordonnées, numérotation, devises et textes légaux — appliqués immédiatement sur tout le site."
      />

      <Alert tone="info">
        Astuce : le nom du projet, le slogan, le WhatsApp et les textes légaux sont personnalisables ici. La devise de facturation par défaut et les devises acceptées sont également configurables (XAF, EUR, USD…).
      </Alert>

      <Card>
        <CardHeader title="Identité & contact" />
        <div className="p-6">
          <ActionForm action={saveSettingsAction} submitLabel="Enregistrer les paramètres">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Nom de l'entreprise *">
                <input name="brandName" required defaultValue={s.brandName} className={inputClass} />
              </Field>
              <Field label="Slogan">
                <input name="brandTagline" defaultValue={s.brandTagline} className={inputClass} />
              </Field>
            </div>
            <Field label="Présentation (bloc « À propos » et accueil)" className="mt-4">
              <textarea name="brandDescription" rows={2} defaultValue={s.brandDescription} className={inputClass} />
            </Field>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone">
                <input name="contactPhone" defaultValue={s.contactPhone} className={inputClass} />
              </Field>
              <Field label="Téléphone 2">
                <input name="contactPhone2" defaultValue={s.contactPhone2} className={inputClass} />
              </Field>
              <Field label="E-mail">
                <input name="contactEmail" type="email" defaultValue={s.contactEmail} className={inputClass} />
              </Field>
              <Field label="WhatsApp" hint="Format international sans + ni espaces, ex : 237612345678">
                <input name="whatsappNumber" defaultValue={s.whatsappNumber} className={inputClass} />
              </Field>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Adresse">
                <input name="contactAddress" defaultValue={s.contactAddress} className={inputClass} />
              </Field>
              <Field label="Horaires">
                <input name="contactHours" defaultValue={s.contactHours} className={inputClass} />
              </Field>
            </div>

            <CardHeader title="Numérotation & calculs" />
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <Field label="Préfixe de numérotation" hint="Exemple : XTER → XTER-2026-000001">
                <input name="trackingPrefix" defaultValue={s.trackingPrefix} className={inputClass} />
              </Field>
              <Field label="Motif du numéro" hint="Jetons : {PREFIX}, {YYYY}, {SEQ} (6 chiffres)">
                <input name="trackingPattern" defaultValue={s.trackingPattern} className={inputClass} />
              </Field>
              <Field label="Diviseur poids volumétrique (aérien)" hint="Standard : 6000 (règle IATA).">
                <input name="volumetricDivisor" type="number" min="1000" step="500" defaultValue={s.volumetricDivisor} className={inputClass} />
              </Field>
              <Field label="Volume minimal groupage maritime (m³)">
                <input name="seaGroupageMinM3" type="number" min="0.1" step="0.1" defaultValue={s.seaGroupageMinM3} className={inputClass} />
              </Field>
            </div>

            <CardHeader title="Devises & tarifs publics" />
            <div className="mt-2 grid gap-4 sm:grid-cols-2">
              <Field label="Devises acceptées" hint="Séparées par des virgules, ex : XAF,EUR,USD">
                <input name="currencies" defaultValue={s.currencies.join(",")} className={inputClass} />
              </Field>
              <Field label="Devise par défaut">
                <select name="defaultCurrency" defaultValue={s.defaultCurrency} className={inputClass}>
                  {s.currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <input type="hidden" name="showPublicTarifs__present" value="1" />
              <input type="checkbox" name="showPublicTarifs" defaultChecked={s.showPublicTarifs} className="h-4 w-4" />
              Publier les grilles tarifaires actives sur la page « Tarifs indicatifs » du site public
            </label>

            <CardHeader title="Textes légaux & contenu" />
            <div className="mt-2 space-y-4">
              <Field label="Présentation « À propos » complète">
                <textarea name="aboutText" rows={4} defaultValue={s.aboutText} className={inputClass} />
              </Field>
              <Field label="Conditions générales de vente">
                <textarea name="legalCGV" rows={4} defaultValue={s.legalCGV} className={inputClass} />
              </Field>
              <Field label="Conditions de transport">
                <textarea name="legalTransport" rows={4} defaultValue={s.legalTransport} className={inputClass} />
              </Field>
              <Field label="Politique de confidentialité">
                <textarea name="legalPrivacy" rows={4} defaultValue={s.legalPrivacy} className={inputClass} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Conservation des données (mois)">
                  <input name="dataRetentionMonths" type="number" min="12" defaultValue={s.dataRetentionMonths} className={inputClass} />
                </Field>
              </div>
            </div>
          </ActionForm>
        </div>
      </Card>
    </div>
  );
}
