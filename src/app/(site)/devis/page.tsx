import { Suspense } from "react";
import { QuoteForm } from "@/components/quote-form";
import { Card } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Demande de devis" };

export default function DevisPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-950">Demande de devis</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Fret aérien ou maritime, du Cameroun vers l'étranger ou de l'étranger vers le Cameroun.
        Décrivez votre envoi : notre équipe vous transmet une estimation, puis un prix ferme après validation.
      </p>

      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <Suspense fallback={<div className="h-96 animate-pulse rounded-lg bg-slate-100" />}>
            <QuoteForm />
          </Suspense>
        </Card>

        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-100" />}>
          <Aside />
        </Suspense>
      </div>
    </div>
  );
}

async function Aside() {
  const settings = await getSettings();
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-navy-900 uppercase">Comment est calculé le fret ?</h2>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-slate-600">
          <li><strong>Aérien :</strong> poids volumétrique = L × l × H (cm) ÷ {settings.volumetricDivisor} ; le poids taxable retenu est le plus élevé entre poids réel et volumétrique.</li>
          <li><strong>Maritime :</strong> facturation au m³ (volume minimum {settings.seaGroupageMinM3} m³ en groupage) ou au conteneur complet.</li>
          <li>Les frais de dossier, manutention, portuaires et de douane sont détaillés ligne par ligne dans le devis.</li>
        </ul>
      </Card>
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-navy-900 uppercase">Besoin d'aide ?</h2>
        <p className="mt-3 text-xs text-slate-600">
          {settings.contactPhone && <>Téléphone : {settings.contactPhone}<br /></>}
          {settings.contactEmail && <>E-mail : {settings.contactEmail}<br /></>}
          Notre équipe vous répond du lundi au samedi.
        </p>
      </Card>
    </div>
  );
}
