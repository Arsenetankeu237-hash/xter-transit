/**
 * Paramètres applicatifs (table Setting) — identité de marque, contact,
 * format de numérotation, devises, textes légaux…
 * Lecture mémoïsée par requête via React cache().
 */
import { cache } from "react";
import { db } from "./db";

export interface AppSettings {
  brandName: string;
  brandTagline: string;
  brandDescription: string;
  contactPhone: string;
  contactPhone2: string;
  contactEmail: string;
  contactAddress: string;
  contactHours: string;
  whatsappNumber: string;
  currencies: string[];
  defaultCurrency: string;
  trackingPrefix: string;
  trackingPattern: string;
  volumetricDivisor: number;
  seaGroupageMinM3: number;
  showPublicTarifs: boolean;
  legalCGV: string;
  legalTransport: string;
  legalPrivacy: string;
  aboutText: string;
  dataRetentionMonths: number;
}

const DEFAULTS: AppSettings = {
  brandName: "XTER Transit",
  brandTagline: "Vos colis, notre destination",
  brandDescription:
    "Transitaire international : réception, expédition et suivi de vos colis et marchandises par fret aérien et maritime, vers et depuis le monde entier.",
  contactPhone: "",
  contactPhone2: "",
  contactEmail: "",
  contactAddress: "Douala, Cameroun",
  contactHours: "Lundi – Vendredi : 8h00 – 17h00 · Samedi : 9h00 – 13h00",
  whatsappNumber: "",
  currencies: ["XAF", "EUR", "USD"],
  defaultCurrency: "XAF",
  trackingPrefix: "XTER",
  trackingPattern: "{PREFIX}-{YYYY}-{SEQ}",
  volumetricDivisor: 6000,
  seaGroupageMinM3: 1,
  showPublicTarifs: false,
  legalCGV: "",
  legalTransport: "",
  legalPrivacy: "",
  aboutText: "",
  dataRetentionMonths: 60,
};

function coerce(key: string, value: string | undefined, current: AppSettings): unknown {
  switch (key) {
    case "currencies": return value ? value.split(",").map((s) => s.trim()).filter(Boolean) : current.currencies;
    case "volumetricDivisor": return Number(value) || current.volumetricDivisor;
    case "seaGroupageMinM3": return Number(value) || current.seaGroupageMinM3;
    case "dataRetentionMonths": return Number(value) || current.dataRetentionMonths;
    case "showPublicTarifs": return value === "true";
    default: return value ?? "";
  }
}

export const getSettings = cache(async (): Promise<AppSettings> => {
  const rows = await db.setting.findMany();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const result = { ...DEFAULTS } as unknown as Record<string, unknown>;
  for (const key of Object.keys(DEFAULTS)) {
    if (map[key] !== undefined) result[key] = coerce(key, map[key], DEFAULTS);
  }
  return result as unknown as AppSettings;
});

export async function saveSettings(changes: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(changes)) {
    await db.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}
