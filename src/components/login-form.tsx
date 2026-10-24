"use client";

import { useActionState } from "react";
import { loginAction, type AuthFormState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, btnPrimary, Field, Alert } from "@/components/ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction] = useActionState<AuthFormState, FormData>(loginAction, {});
  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <Field label="Adresse e-mail">
        <input name="email" type="email" required autoComplete="username" className={inputClass} placeholder="vous@entreprise.com" />
      </Field>
      <Field label="Mot de passe">
        <input name="password" type="password" required autoComplete="current-password" className={inputClass} />
      </Field>
      <SubmitButton className={btnPrimary + " w-full py-3"} pendingLabel="Connexion…">
        Se connecter
      </SubmitButton>
    </form>
  );
}
