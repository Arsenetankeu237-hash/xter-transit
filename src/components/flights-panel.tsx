"use client";

import { useState } from "react";
import { applyFlightAction } from "@/app/actions/flights";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, Field, Alert, Badge } from "@/components/ui";

interface FlightResult {
  key: string;
  flightNumber: string;
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  stops: number;
  segments: Array<{ flightNumber: string; from: string; to: string; departAt: string; arriveAt: string }>;
}

function fmt(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function FlightsPanel({
  shipmentId,
  defaultFrom,
  defaultTo,
  defaultDate,
}: {
  shipmentId: string;
  defaultFrom: string;
  defaultTo: string;
  defaultDate: string;
}) {
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(defaultTo);
  const [date, setDate] = useState(defaultDate);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flights, setFlights] = useState<FlightResult[] | null>(null);
  const [applied, setApplied] = useState<string | null>(null);

  async function search() {
    setError(null);
    setFlights(null);
    setApplied(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/flights/search?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&date=${encodeURIComponent(date)}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Recherche impossible.");
      } else {
        setFlights(json.flights ?? []);
      }
    } catch {
      setError("Recherche impossible (réseau).");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <p className="mb-3 text-xs leading-relaxed text-slate-400">
        Interroge l'API officielle <strong>Amadeus</strong> : vols réels entre deux aéroports (codes IATA, ex. DLA → CDG).
        « Utiliser » renseigne automatiquement le n° de vol, le départ prévu et l'arrivée estimée de l'expédition.
      </p>
      <div className="flex flex-wrap items-end gap-2">
        <Field label="De (IATA)">
          <input value={from} onChange={(e) => setFrom(e.target.value.toUpperCase())} maxLength={3} className={inputClass + " w-24 font-mono"} placeholder="DLA" />
        </Field>
        <Field label="Vers (IATA)">
          <input value={to} onChange={(e) => setTo(e.target.value.toUpperCase())} maxLength={3} className={inputClass + " w-24 font-mono"} placeholder="CDG" />
        </Field>
        <Field label="Date">
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass + " w-40"} />
        </Field>
        <button
          type="button"
          onClick={search}
          disabled={loading || from.length !== 3 || to.length !== 3 || !date}
          className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700 disabled:opacity-50"
        >
          {loading ? "Recherche…" : "Rechercher les vols"}
        </button>
      </div>

      {error && <div className="mt-4"><Alert tone="warning">{error}</Alert></div>}
      {applied && <div className="mt-4"><Alert tone="success">{applied}</Alert></div>}

      {flights && (
        <div className="mt-4 space-y-2">
          {flights.length === 0 && (
            <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
              Aucun vol trouvé pour cette liaison à cette date (essayez une autre date ou une escale proche).
            </p>
          )}
          {flights.map((f) => (
            <form
              key={f.key}
              action={async (fd: FormData) => {
                const result = await applyFlightAction({}, fd);
                if (result.ok && result.message) setApplied(result.message);
                else if (result.error) setError(result.error);
              }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white px-4 py-2.5"
            >
              <input type="hidden" name="shipmentId" value={shipmentId} />
              <input type="hidden" name="flightNumber" value={f.flightNumber} />
              <input type="hidden" name="departAt" value={f.departAt} />
              <input type="hidden" name="arriveAt" value={f.arriveAt} />
              <div className="min-w-0">
                <p className="text-sm font-bold text-navy-900">
                  <span className="font-mono">{f.flightNumber}</span>
                  <span className="ml-2 font-normal text-slate-500">{f.from} → {f.to}</span>
                  {f.stops > 0 && <span className="ml-2"><Badge tone="amber">{f.stops} escale{f.stops > 1 ? "s" : ""}</Badge></span>}
                </p>
                <p className="mt-0.5 text-xs text-slate-400">
                  Départ {fmt(f.departAt)} · Arrivée {fmt(f.arriveAt)}
                  {f.stops > 0 && " · via " + f.segments.slice(0, -1).map((s) => s.to).join(", ")}
                </p>
              </div>
              <SubmitButton className="rounded-lg border border-navy-200 bg-navy-50 px-3 py-1.5 text-xs font-semibold text-navy-800 hover:bg-navy-100" pendingLabel="…">
                Utiliser ce vol
              </SubmitButton>
            </form>
          ))}
        </div>
      )}
    </div>
  );
}
