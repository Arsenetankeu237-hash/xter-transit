"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { FormState } from "@/lib/form";
import { SubmitButton } from "@/components/submit-button";
import { Alert, btnPrimary } from "@/components/ui";

/**
 * Formulaire serveur générique : affiche les erreurs/succès de l'action,
 * gère le bouton de soumission et la redirection optionnelle après succès.
 * Les champs (children) sont fournis par la page serveur.
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Traitement…",
  className = "space-y-4",
  buttonClassName,
  resetOnSuccess = false,
  confirmMessage,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children: React.ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  className?: string;
  buttonClassName?: string;
  resetOnSuccess?: boolean;
  confirmMessage?: string;
}) {
  const [state, formAction] = useActionState(action, {} as FormState);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && state.redirectTo) {
      router.push(state.redirectTo);
    } else if (state.ok && resetOnSuccess) {
      router.refresh();
    }
  }, [state, router]);

  return (
    <form
      action={formAction}
      className={className}
      onSubmit={confirmMessage ? (e) => { if (!window.confirm(confirmMessage)) e.preventDefault(); } : undefined}
    >
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && state.message && <Alert tone="success">{state.message}</Alert>}
      {children}
      <SubmitButton className={buttonClassName ?? btnPrimary} pendingLabel={pendingLabel}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
