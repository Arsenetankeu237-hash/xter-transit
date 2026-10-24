"use client";

import { useActionState } from "react";
import { submitContactMessage, type FormState } from "@/app/actions/public";
import { SubmitButton } from "@/components/submit-button";
import { inputClass, btnAccent, Field, Alert } from "@/components/ui";

const initial: FormState = {};

export function ContactForm() {
  const [state, formAction] = useActionState(submitContactMessage, initial);
  if (state.ok) return <Alert tone="success">{state.message}</Alert>;

  const err = (name: string) => state.fieldErrors?.[name];
  return (
    <form action={formAction} className="space-y-5">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nom complet *">
          <input name="name" required className={inputClass} />
          {err("name") && <span className="mt-1 block text-xs text-red-600">{err("name")}</span>}
        </Field>
        <Field label="E-mail *">
          <input name="email" type="email" required className={inputClass} />
          {err("email") && <span className="mt-1 block text-xs text-red-600">{err("email")}</span>}
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Téléphone">
          <input name="phone" className={inputClass} />
        </Field>
        <Field label="Objet *">
          <input name="subject" required className={inputClass} placeholder="Question sur un colis, devis…" />
          {err("subject") && <span className="mt-1 block text-xs text-red-600">{err("subject")}</span>}
        </Field>
      </div>
      <Field label="Message *">
        <textarea name="message" rows={5} required className={inputClass} />
        {err("message") && <span className="mt-1 block text-xs text-red-600">{err("message")}</span>}
      </Field>
      <SubmitButton className={btnAccent + " px-6 py-3"} pendingLabel="Envoi…">Envoyer le message</SubmitButton>
    </form>
  );
}
