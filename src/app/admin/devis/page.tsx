import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, CardHeader, Table, EmptyState, Badge, inputClass, Field, btnGhost } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createRateTableAction, addRateLineAction, deleteRateLineAction, toggleRateTableAction } from "@/app/actions/finance";
import { formatDate, formatMoney } from "@/lib/format";
import { QUOTE_STATUSES, RATE_BASES, MODES } from "@/lib/constants";

export const metadata = { title: "Devis & tarifs" };

export default function QuotesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const { status } = await searchParams;
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">Devis</h1>
        <form method="get" className="mt-4 flex gap-2">
          <select name="status" defaultValue={status ?? ""} className={inputClass + " w-64"}>
            <option value="">Tous statuts</option>
            {Object.entries(QUOTE_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button className="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white">Filtrer</button>
        </form>
        <div className="mt-6">
          <QuotesList status={status} />
        </div>
      </div>

      <div>
        <h2 className="text-xl font-bold text-navy-950">Grilles tarifaires</h2>
        <p className="mt-1 text-sm text-slate-500">
          Les devis sont calculés uniquement à partir des grilles actives — aucun tarif n'est inventé. Une grille sans pays s'applique par défaut ; une grille avec pays est prioritaire.
        </p>
        <div className="mt-4 grid gap-6 xl:grid-cols-[2fr_1fr]">
          <RateTables />
          <Card className="h-fit p-6">
            <h3 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Nouvelle grille</h3>
            <ActionForm action={createRateTableAction} submitLabel="Créer la grille">
              <Field label="Nom *">
                <input name="name" required className={inputClass} placeholder="Ex : Aérien CM→Europe 2026" />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mode *">
                  <select name="mode" required className={inputClass}>
                    <option value="AIR">Aérien</option>
                    <option value="SEA">Maritime</option>
                  </select>
                </Field>
                <Field label="Devise *">
                  <select name="currency" required defaultValue="XAF" className={inputClass}>
                    <option>XAF</option><option>EUR</option><option>USD</option>
                  </select>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Pays d'origine">
                  <input name="originCountry" className={inputClass} placeholder="Optionnel" />
                </Field>
                <Field label="Pays de destination">
                  <input name="destCountry" className={inputClass} placeholder="Optionnel" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Valable du">
                  <input type="date" name="validFrom" className={inputClass} />
                </Field>
                <Field label="au">
                  <input type="date" name="validTo" className={inputClass} />
                </Field>
              </div>
            </ActionForm>
          </Card>
        </div>
      </div>
    </div>
  );
}

async function QuotesList({ status }: { status?: string }) {
  const quotes = await db.quote.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 50,
    include: { customer: { select: { name: true } } },
  });
  if (quotes.length === 0) {
    return <EmptyState title="Aucun devis" hint="Les demandes du formulaire public du site arrivent ici (statut « Nouvelle demande »)." />;
  }
  return (
    <Card>
      <Table head={["N°", "Demandeur", "Trajet", "Mode", "Total", "Statut", "Créé le", ""]}>
        {quotes.map((q) => (
          <tr key={q.id} className="hover:bg-slate-50">
            <td className="px-4 py-3">
              <Link href={`/admin/devis/${q.id}`} className="font-mono text-xs font-semibold text-navy-800">{q.number}</Link>
            </td>
            <td className="px-4 py-3 text-sm text-slate-600">{q.customer?.name ?? q.contactName ?? "—"}</td>
            <td className="px-4 py-3 text-xs text-slate-500">{q.originCountry ?? "?"} → {q.destCountry ?? "?"}</td>
            <td className="px-4 py-3 text-xs">{q.mode === "AIR" ? "✈️" : "🚢"} {MODES[q.mode as keyof typeof MODES]}</td>
            <td className="px-4 py-3 text-sm font-semibold text-navy-900">{q.total != null ? formatMoney(q.total, q.currency ?? "XAF") : "—"}</td>
            <td className="px-4 py-3">
              <Badge tone={q.status === "NEW" ? "amber" : q.status === "SENT" ? "blue" : q.status === "ACCEPTED" || q.status === "INVOICED" ? "green" : q.status === "REFUSED" ? "red" : "slate"}>
                {QUOTE_STATUSES[q.status as keyof typeof QUOTE_STATUSES]}
              </Badge>
            </td>
            <td className="px-4 py-3 text-xs text-slate-400">{formatDate(q.createdAt)}</td>
            <td className="px-4 py-3 text-right"><Link href={`/admin/devis/${q.id}`} className="text-xs font-semibold text-accent-600">Traiter</Link></td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}

async function RateTables() {
  const tables = await db.rateTable.findMany({ include: { lines: true }, orderBy: { createdAt: "desc" } });
  if (tables.length === 0) {
    return <EmptyState title="Aucune grille tarifaire" hint="Créez une première grille pour activer le calcul automatique des devis." />;
  }
  return (
    <div className="space-y-4">
      {tables.map((t) => (
        <Card key={t.id} className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="flex items-center gap-2 text-sm font-bold text-navy-950">
                {t.name}
                <Badge tone="navy">{MODES[t.mode as keyof typeof MODES]}</Badge>
                {t.active ? <Badge tone="green">active</Badge> : <Badge tone="red">désactivée</Badge>}
              </h3>
              <p className="mt-0.5 text-xs text-slate-400">
                {t.originCountry ? `Depuis ${t.originCountry} · ` : "Toute origine · "}
                {t.destCountry ? `Vers ${t.destCountry} · ` : "Toute destination · "}
                {t.currency}
                {t.validTo ? ` · jusqu'au ${formatDate(t.validTo)}` : ""}
              </p>
            </div>
            <ActionForm action={toggleRateTableAction} submitLabel={t.active ? "Désactiver" : "Activer"} buttonClassName="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <input type="hidden" name="tableId" value={t.id} />
            </ActionForm>
          </div>

          <ul className="mt-4 divide-y divide-slate-50 text-sm">
            {t.lines.map((l) => (
              <li key={l.id} className="flex items-center justify-between gap-3 py-2">
                <span className="text-slate-600">
                  {l.label} <span className="ml-1 text-xs text-slate-400">({RATE_BASES[l.basis as keyof typeof RATE_BASES]})</span>
                </span>
                <span className="flex items-center gap-3">
                  <span className="font-semibold text-navy-900">
                    {l.unitPrice ? `${formatMoney(l.unitPrice, t.currency)}/u` : l.fixedAmount ? formatMoney(l.fixedAmount, t.currency) : l.minAmount ? `min. ${formatMoney(l.minAmount, t.currency)}` : ""}
                  </span>
                  <ActionForm action={deleteRateLineAction} submitLabel="Suppr." buttonClassName="text-xs font-semibold text-red-600 hover:underline" confirmMessage="Supprimer cette ligne tarifaire ?">
                    <input type="hidden" name="lineId" value={l.id} />
                  </ActionForm>
                </span>
              </li>
            ))}
            {t.lines.length === 0 && <li className="py-2 text-xs text-slate-400">Aucune ligne — ajoutez un tarif au kg (aérien), au m³ (maritime) et des frais.</li>}
          </ul>

          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-accent-600">+ Ajouter une ligne</summary>
            <div className="mt-3">
              <ActionForm action={addRateLineAction} submitLabel="Ajouter la ligne">
                <input type="hidden" name="rateTableId" value={t.id} />
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Base *">
                    <select name="basis" required className={inputClass}>
                      {Object.entries(RATE_BASES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </Field>
                  <Field label="Libellé">
                    <input name="label" className={inputClass} placeholder="Par défaut : la base" />
                  </Field>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Prix unitaire">
                    <input name="unitPrice" type="number" step="0.0001" min="0" className={inputClass} />
                  </Field>
                  <Field label="Montant fixe">
                    <input name="fixedAmount" type="number" step="0.01" min="0" className={inputClass} />
                  </Field>
                  <Field label="Minimum">
                    <input name="minAmount" type="number" step="0.01" min="0" className={inputClass} />
                  </Field>
                </div>
              </ActionForm>
            </div>
          </details>
        </Card>
      ))}
    </div>
  );
}
