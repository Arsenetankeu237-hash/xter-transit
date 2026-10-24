/**
 * Génération des identifiants métier — numéros uniques.
 * Les fonctions calculent le prochain numéro d'après l'état de la base ;
 * la contrainte d'unicité protège la création (l'appelant relance en cas de collision P2002).
 */
import type { Client } from "./db-factory";

function pad(n: number, len: number): string {
  return String(n).padStart(len, "0");
}

function parseLastSeq(existing: string | undefined): number {
  if (!existing) return 0;
  const parts = existing.split("-");
  const last = Number(parts[parts.length - 1]);
  return Number.isFinite(last) ? last : 0;
}

/**
 * Numéro de suivi selon le motif configuré (défaut XTER-2026-000001).
 * {PREFIX}, {YYYY}, {SEQ} (séquence sur 6 chiffres).
 */
export async function nextTrackingNumber(
  dbx: Client,
  opts: { prefix: string; pattern: string }
): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `${opts.prefix}-${year}`;
  const last = await dbx.package.findFirst({
    where: { trackingNumber: { startsWith: `${prefix}-` } },
    orderBy: { trackingNumber: "desc" },
    select: { trackingNumber: true },
  });
  return opts.pattern
    .replace("{PREFIX}", opts.prefix)
    .replace("{YYYY}", String(year))
    .replace("{SEQ}", pad(parseLastSeq(last?.trackingNumber) + 1, 6));
}

/** Code client CLI-000001 */
export async function nextCustomerCode(dbx: Client): Promise<string> {
  const last = await dbx.customer.findFirst({
    where: { code: { startsWith: "CLI-" } },
    orderBy: { code: "desc" },
    select: { code: true },
  });
  return `CLI-${pad(parseLastSeq(last?.code) + 1, 6)}`;
}

/** Devis DEV-2026-00001 */
export async function nextQuoteNumber(dbx: Client): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEV-${year}-`;
  const last = await dbx.quote.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return `${prefix}${pad(parseLastSeq(last?.number) + 1, 5)}`;
}

/** Facture FAC-2026-00001 */
export async function nextInvoiceNumber(dbx: Client): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const last = await dbx.invoice.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });
  return `${prefix}${pad(parseLastSeq(last?.number) + 1, 5)}`;
}

/** Expédition EXP-A-2026-00001 (aérien) / EXP-M-… (maritime) */
export async function nextShipmentRef(dbx: Client, type: "AIR" | "SEA"): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `EXP-${type === "AIR" ? "A" : "M"}-${year}-`;
  const last = await dbx.shipment.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  return `${prefix}${pad(parseLastSeq(last?.reference) + 1, 5)}`;
}

export function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}
