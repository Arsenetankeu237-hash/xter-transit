"use client";

import { useFormStatus } from "react-dom";

/** Bouton de soumission avec état de chargement (à utiliser dans tout <form action={...}>). */
export function SubmitButton({
  children,
  className,
  pendingLabel = "Traitement…",
  disabled,
}: {
  children: React.ReactNode;
  className: string;
  pendingLabel?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={className}>
      {pending ? pendingLabel : children}
    </button>
  );
}
