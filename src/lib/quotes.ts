/**
 * Devis & tarifs — calcul aérien (poids volumétrique / taxable) et maritime
 * (volume m³, groupage ou conteneur). Les tarifs proviennent exclusivement des
 * grilles configurées par l'entreprise ; sans grille, aucun montant n'est inventé.
 */
import { db } from "./db";
import { volumetricWeight, volumeM3 } from "./format";

export interface QuoteLine {
  label: string;
  basis: string;
  qty: number | null;
  unitPrice: number | null;
  amount: number;
}

export interface QuoteComputation {
  lines: QuoteLine[];
  currency: string;
  total: number;
  volumetricWeightKg: number | null;
  taxableWeightKg: number | null;
  volumeM3: number | null;
  rateTableName: string | null;
  estimateOnly: true; // un calcul reste une estimation jusqu'à validation par l'entreprise
  warnings: string[];
}

interface RateInput {
  mode: "AIR" | "SEA";
  originCountry?: string | null;
  destCountry?: string | null;
  weightKg?: number | null;
  lengthCm?: number | null;
  widthCm?: number | null;
  heightCm?: number | null;
  volumeM3?: number | null;
  pallets?: number | null;
}

/** Choisit la grille active la plus spécifique pour le trajet demandé. */
async function findRateTable(input: RateInput) {
  const now = new Date();
  const tables = await db.rateTable.findMany({
    where: {
      mode: input.mode,
      active: true,
      OR: [{ validFrom: null }, { validFrom: { lte: now } }],
      AND: [{ OR: [{ validTo: null }, { validTo: { gte: now } }] }],
    },
    include: { lines: true },
  });
  const destination = (input.destCountry ?? "").trim();
  const origin = (input.originCountry ?? "").trim();
  const scored = tables
    .map((t) => ({
      table: t,
      score:
        (t.destCountry && t.destCountry.trim() === destination ? 2 : t.destCountry ? -1 : 0) +
        (t.originCountry && t.originCountry.trim() === origin ? 1 : t.originCountry ? -1 : 0),
    }))
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score);
  return scored[0]?.table ?? null;
}

export async function computeQuote(
  input: RateInput,
  settings: { volumetricDivisor: number; seaGroupageMinM3: number }
): Promise<QuoteComputation> {
  const warnings: string[] = [];
  const table = await findRateTable(input);

  const vol = input.volumeM3 ?? volumeM3(input.lengthCm, input.widthCm, input.heightCm);
  const volWeight =
    input.mode === "AIR" ? volumetricWeight(input.lengthCm, input.widthCm, input.heightCm, settings.volumetricDivisor) : null;

  let taxableWeight: number | null = null;
  if (input.mode === "AIR" && input.weightKg != null) {
    taxableWeight = Math.max(input.weightKg, volWeight ?? 0);
  }

  if (!table) {
    return {
      lines: [],
      currency: "XAF",
      total: 0,
      volumetricWeightKg: volWeight,
      taxableWeightKg: taxableWeight,
      volumeM3: vol,
      rateTableName: null,
      estimateOnly: true,
      warnings: [
        "Aucune grille tarifaire active pour ce trajet et ce mode : le chiffrage sera saisi manuellement par un agent.",
      ],
    };
  }

  const lines: QuoteLine[] = [];
  const perKg = table.lines.find((l) => l.basis === "PER_KG");
  const perM3 = table.lines.find((l) => l.basis === "PER_M3");
  const perShipment = table.lines.find((l) => l.basis === "PER_SHIPMENT");
  const minCharge = table.lines.find((l) => l.basis === "MIN_CHARGE");
  const fees = table.lines.filter((l) => l.basis.startsWith("FEE_"));

  if (input.mode === "AIR") {
    if (perKg?.unitPrice && taxableWeight) {
      lines.push({
        label: `${perShipmentLineLabel(perKg.label, taxableWeight)} kg taxable × ${perKg.unitPrice}`,
        basis: "PER_KG", qty: taxableWeight, unitPrice: perKg.unitPrice, amount: round(taxableWeight * perKg.unitPrice),
      });
    } else if (perKg?.unitPrice) {
      warnings.push("Poids manquant : le fret aérien n'a pas pu être chiffré au kg.");
    }
  } else {
    const billableVolume = Math.max(vol ?? 0, settings.seaGroupageMinM3);
    if (perM3?.unitPrice && vol != null) {
      lines.push({
        label: `${perM3.label} — ${billableVolume} m³ × ${perM3.unitPrice}`,
        basis: "PER_M3", qty: billableVolume, unitPrice: perM3.unitPrice, amount: round(billableVolume * perM3.unitPrice),
      });
    } else if (perM3?.unitPrice) {
      warnings.push("Volume manquant : le fret maritime n'a pas pu être chiffré au m³.");
    }
  }

  if (perShipment?.fixedAmount) {
    lines.push({ label: perShipment.label, basis: "PER_SHIPMENT", qty: 1, unitPrice: perShipment.fixedAmount, amount: perShipment.fixedAmount });
  }
  for (const fee of fees) {
    if (fee.fixedAmount) {
      lines.push({ label: fee.label, basis: fee.basis, qty: 1, unitPrice: fee.fixedAmount, amount: fee.fixedAmount });
    }
  }

  let total = lines.reduce((sum, l) => sum + l.amount, 0);
  if (minCharge?.minAmount && total < minCharge.minAmount) {
    warnings.push(`Minimum facturable appliqué (${minCharge.minAmount}).`);
    total = minCharge.minAmount;
  }
  if (total === 0) {
    warnings.push("Grille trouvée mais aucune ligne exploitable : chiffrage manuel requis.");
  }

  return {
    lines, currency: table.currency, total: round(total),
    volumetricWeightKg: volWeight, taxableWeightKg: taxableWeight, volumeM3: vol,
    rateTableName: table.name, estimateOnly: true, warnings,
  };
}

function perShipmentLineLabel(label: string, qty: number): string {
  return `${label} — ${qty}`;
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
