/**
 * Règles AWB (Air Waybill) — standard IATA :
 * 11 chiffres = préfixe compagnie (3) + n° de série (8) + clé de contrôle (1).
 * Clé de contrôle = n° de série modulo 7.
 */

export function awbCheckDigit(serial: string): number | null {
  if (!/^\d{8}$/.test(serial)) return null;
  return Number(serial) % 7;
}

export function isValidAwb(awb: string): boolean {
  const m = /^(\d{3})(\d{8})(\d)$/.exec(awb.replace(/[-\s]/g, ""));
  if (!m) return false;
  return Number(m[3]) === Number(m[2]) % 7;
}
