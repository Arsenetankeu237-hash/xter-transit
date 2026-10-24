import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card, CardHeader, Badge, inputClass, Field, PageHeader, Alert } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { calculateQuoteAction, updateQuoteLinesAction, setQuoteStatusAction, assignQuoteCustomerAction, quoteToInvoiceAction } from "@/app/actions/finance";
import { computeQuote } from "@/lib/quotes";
import { getSettings } from "@/lib/settings";
import { parseLines } from "@/lib/invoices";
import { formatMoney, formatDate } from "@/lib/format";
import { QUOTE_STATUSES, MODES } from "@/lib/constants";

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <ResolvePageParams params={params} />
    </Suspense>
  );
}

async function ResolvePageParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content quoteId={id} />
    </Suspense>
  );
}

async function Content({ quoteId }: { quoteId: string }) {
  await connection(); // page dynamique : données et session à la demande
  const quote = await db.quote.findUnique({ where: { id: quoteId }, include: { customer: true, invoices: true } });
  if (!quote) notFound();
  const settings = await getSettings();
  const lines = parseLines(quote.lines);
  const preview = await computeQuote(
    {
      mode: quote.mode as "AIR" | "SEA",
      originCountry: quote.originCountry,
      destCountry: quote.destCountry,
      weightKg: quote.weightKg,
      lengthCm: quote.lengthCm,
      widthCm: quote.widthCm,
      heightCm: quote.heightCm,
      volumeM3: quote.volumeM3,
    },
    settings
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Devis ${quote.number}`}
        subtitle={`${MODES[quote.mode as keyof typeof MODES]} · ${quote.originCountry ?? "?"} → ${quote.destCountry ?? "?"} · Demandé le ${formatDate(quote.createdAt)}${quote.isUrgent ? " · URGENT" : ""}`}
        action={
          <Badge tone={quote.status === "NEW" ? "amber" : quote.status === "SENT" ? "blue" : quote.status === "ACCEPTED" || quote.status === "INVOICED" ? "green" : quote.status === "REFUSED" ? "red" : "slate"}>
            {QUOTE_STATUSES[quote.status as keyof typeof QUOTE_STATUSES]}
          </Badge>
        }
      />

      {/* Demande du client */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-navy-900 uppercase">Demande</h2>
        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-4">
          <Info label="Contact" value={quote.contactName ?? "—"} sub={`${quote.contactEmail ?? ""}${quote.contactPhone ? " · " + quote.contactPhone : ""}`} />
          <Info label="Trajet" value={`${quote.originCity ?? quote.originCountry ?? "?"} → ${quote.destCity ?? quote.destCountry ?? "?"}`} />
          <Info label="Poids / Volume" value={`${quote.weightKg ? quote.weightKg + " kg" : "—"} / ${quote.volumeM3 ?? preview.volumeM3 ?? "—"} m³`} />
          <Info label="Marchandise" value={quote.cargoType ?? "—"} />
        </div>
        {quote.notes && <p className="mt-4 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">« {quote.notes} »</p>}
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        {/* Calcul automatique */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-navy-900 uppercase">Calcul automatique</h2>
          <p className="mt-1 text-xs text-slate-400">
            Ajustez les données d'entrée puis calculez : la grille la plus spécifique active est utilisée.
          </p>
          <div className="mt-4">
            <ActionForm action={calculateQuoteAction} submitLabel="Calculer le devis">
              <input type="hidden" name="quoteId" value={quote.id} />
              <div className="grid grid-cols-2 gap-3">
                <Field label="Poids réel (kg)">
                  <input name="weightKg" type="number" step="0.01" min="0" defaultValue={quote.weightKg ?? ""} className={inputClass} />
                </Field>
                <Field label="Volume (m³)">
                  <input name="volumeM3" type="number" step="0.001" min="0" defaultValue={quote.volumeM3 ?? ""} className={inputClass} />
                </Field>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <Field label="Longueur (cm)">
                  <input name="lengthCm" type="number" step="0.1" min="0" defaultValue={quote.lengthCm ?? ""} className={inputClass} />
                </Field>
                <Field label="Largeur (cm)">
                  <input name="widthCm" type="number" step="0.1" min="0" defaultValue={quote.widthCm ?? ""} className={inputClass} />
                </Field>
                <Field label="Hauteur (cm)">
                  <input name="heightCm" type="number" step="0.1" min="0" defaultValue={quote.heightCm ?? ""} className={inputClass} />
                </Field>
              </div>
            </ActionForm>
          </div>

          <div className="mt-5 rounded-lg border border-slate-100 bg-slate-50 p-4 text-sm">
            <p className="font-semibold text-navy-900">
              Grille : {preview.rateTableName ?? "aucune"} · Total estimé : {preview.total > 0 ? formatMoney(preview.total, preview.currency) : "—"}
            </p>
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              <li>Poids volumétrique (aérien) : {preview.volumetricWeightKg ?? "—"} kg · Poids taxable : {preview.taxableWeightKg ?? "—"} kg</li>
              {preview.lines.map((l, i) => (
                <li key={i}>{l.label} : {formatMoney(l.amount, preview.currency)}</li>
              ))}
              {preview.warnings.map((w, i) => <li key={"w" + i} className="text-amber-600">⚠ {w}</li>)}
            </ul>
          </div>
        </Card>

        {/* Lignes du devis */}
        <Card className="p-6">
          <h2 className="text-sm font-semibold text-navy-900 uppercase">Lignes du devis {quote.total != null && quote.total > 0 && `— ${formatMoney(quote.total, quote.currency ?? "XAF")}`}</h2>
          <p className="mt-1 text-xs text-slate-400">Modifiable manuellement : vous gardez la main sur le chiffrage final (traçé dans l'audit).</p>
          <div className="mt-4">
            <ActionForm action={updateQuoteLinesAction} submitLabel="Enregistrer les lignes">
              <input type="hidden" name="quoteId" value={quote.id} />
              {lines.map((l, i) => (
                <div key={i} className="grid grid-cols-[2fr_70px_100px] gap-2">
                  <input name={`line_label_${i}`} defaultValue={l.label} className={inputClass} />
                  <input name={`line_qty_${i}`} defaultValue={l.qty} className={inputClass} />
                  <input name={`line_price_${i}`} defaultValue={l.unitPrice} className={inputClass} />
                </div>
              ))}
              <div className="grid grid-cols-[2fr_70px_100px] gap-2 rounded-lg border border-dashed border-slate-200 p-2">
                <input name="new_label" placeholder="Nouvelle ligne…" className={inputClass} />
                <input name="new_qty" placeholder="Qté" defaultValue="1" className={inputClass} />
                <input name="new_price" placeholder="P.U." className={inputClass} />
              </div>
              <Field label="Devise">
                <select name="currency" defaultValue={quote.currency ?? settings.defaultCurrency} className={inputClass}>
                  {settings.currencies.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>
            </ActionForm>
          </div>
        </Card>
      </div>

      {/* Workflow */}
      <Card className="p-6">
        <h2 className="text-sm font-semibold text-navy-900 uppercase">Traitement du devis</h2>
        <div className="mt-4 grid gap-6 lg:grid-cols-3">
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Client rattaché</p>
            {quote.customer ? (
              <p className="text-sm text-slate-700">{quote.customer.name} ({quote.customer.code})</p>
            ) : (
              <AssignCustomer quoteId={quote.id} />
            )}
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Changer le statut</p>
            <ActionForm action={setQuoteStatusAction} submitLabel="Appliquer">
              <input type="hidden" name="quoteId" value={quote.id} />
              <select name="status" defaultValue={quote.status} className={inputClass}>
                {Object.entries(QUOTE_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </ActionForm>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-slate-500 uppercase">Facturation</p>
            {quote.status === "ACCEPTED" && quote.invoices.length === 0 ? (
              <ActionForm action={quoteToInvoiceAction} submitLabel="Générer la facture">
                <input type="hidden" name="quoteId" value={quote.id} />
              </ActionForm>
            ) : quote.invoices.length > 0 ? (
              <p className="text-sm text-slate-600">Facturé : {quote.invoices.map((i) => i.number).join(", ")}</p>
            ) : (
              <p className="text-xs text-slate-400">Le devis doit être au statut « Accepté » avant facturation.</p>
            )}
          </div>
        </div>
        {quote.status === "SENT" && !process.env.SMTP_HOST && (
          <Alert tone="warning">SMTP non configuré : l'envoi e-mail du devis est journalisé mais pas réellement expédié (voir README §Notifications).</Alert>
        )}
      </Card>
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 uppercase">{label}</p>
      <p className="mt-1 font-medium text-slate-700">{value}</p>
      {sub && <p className="text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

async function AssignCustomer({ quoteId }: { quoteId: string }) {
  const customers = await db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });
  return (
    <ActionForm action={assignQuoteCustomerAction} submitLabel="Rattacher">
      <input type="hidden" name="quoteId" value={quoteId} />
      <select name="customerId" className={inputClass} required defaultValue="">
        <option value="">— Sélectionner le client —</option>
        {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
      </select>
    </ActionForm>
  );
}
