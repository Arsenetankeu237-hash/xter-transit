/** État partagé des formulaires via useActionState. */
export interface FormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
  /** redirection optionnelle après succès */
  redirectTo?: string;
}

export const emptyFormState: FormState = {};

import { z } from "zod";

/** Convertit une erreur Zod en champ→message pour l'affichage. */
export function zodFieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/** Extrait les valeurs optionnelles d'un FormData en string|null. */
export function optionalString(formData: FormData, name: string): string | null {
  const v = formData.get(name);
  if (typeof v !== "string" || v.trim() === "") return null;
  return v.trim();
}

/** Nombre optionnel depuis FormData. */
export function optionalNumber(formData: FormData, name: string): number | null {
  const v = formData.get(name);
  if (typeof v !== "string" || v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Date optionnelle (input date/datetime-local) depuis FormData. */
export function optionalDate(formData: FormData, name: string): Date | null {
  const v = formData.get(name);
  if (typeof v !== "string" || v.trim() === "") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
