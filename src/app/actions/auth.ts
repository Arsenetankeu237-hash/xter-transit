"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { login, logout, changePassword } from "@/lib/auth";

export interface AuthFormState {
  error?: string;
}

const credentialsSchema = z.object({
  email: z.string().trim().email("E-mail invalide"),
  password: z.string().min(1, "Mot de passe requis"),
  next: z.string().max(200).optional(),
});

export async function loginAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }
  const { email, password, next } = parsed.data;
  const result = await login(email, password);
  if (!result.ok) return { error: result.error ?? "Connexion impossible." };

  // Redirection selon le rôle
  if (next && next.startsWith("/") && !next.startsWith("//")) redirect(next);
  redirect("/admin");
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/connexion");
}

const changeSchema = z.object({
  current: z.string().min(1, "Mot de passe actuel requis"),
  next: z.string().min(8, "Le nouveau mot de passe doit contenir au moins 8 caractères"),
});

export async function changePasswordAction(_prev: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const { getSessionUser } = await import("@/lib/auth");
  const user = await getSessionUser();
  if (!user) return { error: "Session expirée." };
  const parsed = changeSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  const result = await changePassword(user.id, parsed.data.current, parsed.data.next);
  if (!result.ok) return { error: result.error };
  redirect("/connexion?changed=1");
}
