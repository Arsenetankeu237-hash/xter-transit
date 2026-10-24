"use client";

import { useActionState } from "react";
import { changePasswordAction, type AuthFormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, btnPrimary, Field, Alert } from "@/components/ui";

export function ChangePasswordForm() {
  const [state, formAction] = useActionState<AuthFormState, FormData>(changePasswordAction, {});
  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <Field label="Mot de passe actuel">
        <input name="current" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <Field label="Nouveau mot de passe" hint="8 caractères minimum. Toutes vos autres sessions seront déconnectées.">
        <input name="next" type="password" required minLength={8} autoComplete="new-password" className={inputClass} />
      </Field>
      <SubmitButton className={btnPrimary}>Modifier le mot de passe</SubmitButton>
    </form>
  );
}
