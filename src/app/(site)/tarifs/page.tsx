import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { Card, EmptyState } from "@/components/ui";
import { formatMoney } from "@/lib/format";
import { MODES, RATE_BASES } from "@/lib/constants";

export const metadata = { title: "Tarifs indicatifs" };

export default function TarifsPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-950">Tarifs indicatifs</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-500">
        Grilles publiées par notre équipe à titre indicatif. Le prix ferme de votre envoi est
        confirmé par un devis validé, après pesée et contrôle de la marchandise.
      </p>
      <div className="mt-8">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-xl bg-slate-100" />}>
          <TarifsContent />
        </Suspense>
      </div>
    </div>
  );
}

async function TarifsContent() {
  await connection(); // rendu à la demande : données gérées en administration
  const settings = await getSettings();
  if (!settings.showPublicTarifs) {
    return (
      <EmptyState
        title="Tarifs sur demande"
        hint="Nos tarifs dépendent du poids taxable, du volume, de la destination et des prestations choisies. Demandez un devis personnalisé, gratuit et sans engagement."
      />
    );
  }

  const tables = await db.rateTable.findMany({
    where: { active: true },
    include: { lines: true },
    orderBy: { mode: "asc" },
  });
  const now = new Date();
  const valid = tables.filter(
    (t) => (!t.validFrom || t.validFrom <= now) && (!t.validTo || t.validTo >= now)
  );
  if (valid.length === 0) {
    return <EmptyState title="Aucune grille tarifaire publique active" hint="Les tarifs indicatifs apparaîtront ici dès publication par l'entreprise." />;
  }

  return (
    <div className="space-y-6">
      {valid.map((t) => {
        const perUnit = t.lines.find((l) => l.basis === "PER_KG" || l.basis === "PER_M3");
        return (
          <Card key={t.id} className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-bold text-navy-950">
                {MODES[t.mode as keyof typeof MODES]} — {t.name}
              </h2>
              {perUnit?.unitPrice && (
                <p className="text-lg font-black text-accent-600">
                  dès {formatMoney(perUnit.unitPrice, t.currency)} / {perUnit.basis === "PER_KG" ? "kg" : "m³"}
                </p>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {t.originCountry ? `Depuis ${t.originCountry} · ` : ""}
              {t.destCountry ? `Vers ${t.destCountry} · ` : ""}
              {t.validTo ? `Valable jusqu'au ${t.validTo.toLocaleDateString("fr-FR")}` : "En vigueur"}
            </p>
            <ul className="mt-4 divide-y divide-slate-50 text-sm">
              {t.lines.map((l) => (
                <li key={l.id} className="flex justify-between gap-4 py-2">
                  <span className="text-slate-600">
                    {l.label}
                    <span className="ml-2 text-xs text-slate-400">{RATE_BASES[l.basis as keyof typeof RATE_BASES]}</span>
                  </span>
                  <span className="font-semibold text-navy-900">
                    {l.unitPrice ? `${formatMoney(l.unitPrice, t.currency)} / ${l.basis === "PER_KG" ? "kg" : l.basis === "PER_M3" ? "m³" : "unité"}` : ""}
                    {l.fixedAmount ? formatMoney(l.fixedAmount, t.currency) : ""}
                    {l.minAmount ? `minimum ${formatMoney(l.minAmount, t.currency)}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        );
      })}
      <div className="text-center">
        <Link href="/devis" className="inline-block rounded-lg bg-accent-500 px-6 py-3 text-sm font-semibold text-white transition hover:bg-accent-600">
          Demander un devis précis
        </Link>
      </div>
    </div>
  );
}
