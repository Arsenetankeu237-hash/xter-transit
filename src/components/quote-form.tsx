"use client";

import { useActionState } from "react";
import { submitQuoteRequest, type FormState } from "@/app/actions/public";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, btnAccent, Field, Alert } from "@/components/ui";

const initial: FormState = {};

export function QuoteForm() {
  const [state, formAction] = useActionState(submitQuoteRequest, initial);

  if (state.ok) {
    return <Alert tone="success">{state.message}</Alert>;
  }

  const err = (name: string) => state.fieldErrors?.[name];

  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet *">
          <input name="contactName" required className={inputClass} placeholder="Votre nom" />
          {err("contactName") && <span className="mt-1 block text-xs text-red-600">{err("contactName")}</span>}
        </Field>
        <Field label="E-mail *">
          <input name="contactEmail" type="email" required className={inputClass} placeholder="vous@exemple.com" />
          {err("contactEmail") && <span className="mt-1 block text-xs text-red-600">{err("contactEmail")}</span>}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Téléphone">
          <input name="contactPhone" className={inputClass} placeholder="+237 6XX XX XX XX" />
        </Field>
        <Field label="Mode de transport *">
          <select name="mode" required defaultValue="AIR" className={inputClass}>
            <option value="AIR">Fret aérien</option>
            <option value="SEA">Fret maritime (groupage / conteneur)</option>
          </select>
        </Field>
        <Field label="Caractère urgent">
          <select name="isUrgent" defaultValue="false" className={inputClass}>
            <option value="false">Non</option>
            <option value="true">Oui</option>
          </select>
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pays & ville de départ *">
          <input name="originCountry" required className={inputClass} placeholder="Ex : France, Paris" />
          {err("originCountry") && <span className="mt-1 block text-xs text-red-600">{err("originCountry")}</span>}
        </Field>
        <Field label="Pays & ville de destination *">
          <input name="destCountry" required className={inputClass} placeholder="Ex : Cameroun, Douala" />
          {err("destCountry") && <span className="mt-1 block text-xs text-red-600">{err("destCountry")}</span>}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ville de départ">
          <input name="originCity" className={inputClass} />
        </Field>
        <Field label="Ville de destination">
          <input name="destCity" className={inputClass} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label="Poids (kg)">
          <input name="weightKg" type="number" step="0.1" min="0" className={inputClass} placeholder="12.5" />
          {err("weightKg") && <span className="mt-1 block text-xs text-red-600">{err("weightKg")}</span>}
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

      <Field label="Volume (m³) — pour le maritime" hint="Si vous le connaissez déjà ; sinon il sera calculé à partir des dimensions.">
        <input name="volumeM3" type="number" step="0.001" min="0" className={inputClass} />
        {err("volumeM3") && <span className="mt-1 block text-xs text-red-600">{err("volumeM3")}</span>}
      </Field>

      <Field label="Nature de la marchandise">
        <input name="cargoType" className={inputClass} placeholder="Ex : cartons de vêtements, pièces détachées…" />
      </Field>

      <Field label="Précisions">
        <textarea name="notes" rows={4} className={inputClass} placeholder="Décrivez votre envoi, vos contraintes de délai…" />
      </Field>

      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-slate-400">
          Les devis transmis restent des <strong>estimations</strong> : le prix n'est ferme qu'après validation par notre équipe.
        </p>
        <SubmitButton className={btnAccent + " px-6 py-3"} pendingLabel="Envoi…">
          Envoyer ma demande
        </SubmitButton>
      </div>
    </form>
  );
}
