/** Formatage FR : dates, montants, poids, volumes. */

export function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function formatDateTime(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) +
    " à " + date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

export function formatDateInput(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatMoney(amount: number | null | undefined, currency = "XAF"): string {
  if (amount == null || Number.isNaN(amount)) return "—";
  const n = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: currency === "XAF" ? 0 : 2 }).format(amount);
  if (currency === "XAF") return `${n} FCFA`;
  if (currency === "EUR") return `${n} €`;
  if (currency === "USD") return `${n} $US`;
  return `${n} ${currency}`;
}

export function formatWeight(kg: number | null | undefined): string {
  if (kg == null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(kg)} kg`;
}

export function formatVolume(m3: number | null | undefined): string {
  if (m3 == null) return "—";
  return `${new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 }).format(m3)} m³`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}

/** Poids volumétrique aérien : (L × l × H en cm) / diviseur. */
export function volumetricWeight(lengthCm?: number | null, widthCm?: number | null, heightCm?: number | null, divisor = 6000): number | null {
  if (!lengthCm || !widthCm || !heightCm) return null;
  return Math.round((lengthCm * widthCm * heightCm) / divisor * 100) / 100;
}

export function volumeM3(lengthCm?: number | null, widthCm?: number | null, heightCm?: number | null): number | null {
  if (!lengthCm || !widthCm || !heightCm) return null;
  return Math.round((lengthCm * widthCm * heightCm) / 1_000_000 * 1000) / 1000;
}
