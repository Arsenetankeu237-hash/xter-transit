"use client";

import { useActionState, useState } from "react";
import { saveAwbAction, suggestNextAwbAction } from "@/app/actions/flights";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, Field, Alert } from "@/components/ui";

/**
 * Assistant AWB maître :
 * - préfixe IATA de la compagnie (pré-rempli si le transporteur en a un) ;
 * - n° de série 8 chiffres + clé de contrôle calculée (série mod 7 — règle IATA) ;
 * - suggestion du prochain n° non utilisé dans NOTRE base ;
 * - rappel d'honnêteté : le n° définitif est attribué par la compagnie à la réservation.
 */
export function AwbHelper({
  shipmentId,
  providerPrefix,
  currentAwb,
}: {
  shipmentId: string;
  providerPrefix: string | null;
  currentAwb: string | null;
}) {
  const [prefix, setPrefix] = useState(providerPrefix ?? "");
  const [serial, setSerial] = useState(currentAwb && currentAwb.length >= 12 ? currentAwb.slice(4, 12) : "");
  const [saveState, saveAction] = useActionState(saveAwbAction, {});
  const [suggestState, suggestAction] = useActionState(suggestNextAwbAction, {});

  const serialOk = /^\d{8}$/.test(serial);
  const check = serialOk ? String(Number(serial) % 7) : null;
  const fullAwb = /^\d{3}$/.test(prefix) && serialOk ? `${prefix}${serial}${check}` : "";
  const displayed = /^\d{3}$/.test(prefix) && serialOk ? `${prefix}-${serial}${check}` : "";

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        L'AWB maître est <strong>émis par la compagnie aérienne</strong> lors de la réservation du fret —
        aucune API publique ne le génère. Cet assistant le compose proprement (préfixe IATA + série + clé de contrôle
        = série mod 7, règle IATA) et propose le prochain n° non utilisé dans votre base.
      </p>

      {saveState.error && <Alert tone="danger">{saveState.error}</Alert>}
      {saveState.ok && saveState.message && <Alert tone="success">{saveState.message}</Alert>}

      <form action={saveAction} className="mt-2 space-y-3">
        <input type="hidden" name="shipmentId" value={shipmentId} />
        <input type="hidden" name="awb" value={fullAwb} />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Field label="Préfixe compagnie (3 ch.)">
            <input value={prefix} onChange={(e) => setPrefix(e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputClass + " font-mono"} placeholder="057" inputMode="numeric" />
          </Field>
          <Field label="N° de série (8 ch.)">
            <input value={serial} onChange={(e) => setSerial(e.target.value.replace(/\D/g, "").slice(0, 8))} className={inputClass + " font-mono"} placeholder="12345675" inputMode="numeric" />
          </Field>
          <Field label="AWB complet">
            <div className="flex h-[38px] items-center rounded-lg border border-slate-200 bg-slate-50 px-3 font-mono text-sm font-bold text-navy-900">
              {displayed || "—"}
            </div>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700" disabled={!fullAwb}>
            Enregistrer l'AWB
          </SubmitButton>
          <span className="text-xs text-slate-400">
            {providerPrefix
              ? `Préfixe ${providerPrefix} issu du transporteur sélectionné.`
              : "Astuce : renseignez le préfixe IATA du transporteur dans « Partenaires » pour le pré-remplir."}
          </span>
        </div>
      </form>

      <form action={suggestAction} className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-4">
        <input type="hidden" name="prefix" value={prefix} />
        <Field label="Suggérer le prochain n° (base interne)">
          <input value={prefix} onChange={(e) => setPrefix(e.target.value.replace(/\D/g, "").slice(0, 3))} className={inputClass + " w-24 font-mono"} placeholder="057" inputMode="numeric" />
        </Field>
        <SubmitButton className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50" disabled={prefix.length !== 3}>
          Prochain n°
        </SubmitButton>
        {suggestState.message && /^\d{3}-\d{8}\d$/.test(suggestState.message) && (
          <button
            type="button"
            onClick={() => {
              const m = /^(\d{3})-(\d{8})(\d)$/.exec(suggestState.message!);
              if (m) {
                setPrefix(m[1]);
                setSerial(m[2]);
              }
            }}
            className="rounded-lg bg-emerald-50 px-3 py-2 font-mono text-xs font-bold text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100"
          >
            {suggestState.message} — utiliser
          </button>
        )}
        {suggestState.error && <span className="text-xs text-red-600">{suggestState.error}</span>}
      </form>
    </div>
  );
}
