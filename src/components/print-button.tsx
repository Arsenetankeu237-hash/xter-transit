"use client";

import { btnGhost } from "@/components/ui";

export function PrintButton({ label = "Imprimer (Ctrl+P)" }: { label?: string }) {
  return (
    <button type="button" onClick={() => window.print()} className={btnGhost}>
      {label}
    </button>
  );
}
