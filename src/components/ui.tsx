import type { ReactNode } from "react";
import { STATUS_CATEGORY_STYLE, STATUS_MAP } from "@/lib/constants";

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function CardHeader({ title, action }: { title: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
      <h2 className="text-sm font-semibold tracking-wide text-navy-900 uppercase">{title}</h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 className="text-2xl font-bold text-navy-950">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Indicateurs & badges
// ---------------------------------------------------------------------------

export function StatCard({ label, value, hint, tone = "default" }: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "default" | "warning" | "success" | "danger" | "info";
}) {
  const tones: Record<string, string> = {
    default: "text-navy-950",
    warning: "text-amber-600",
    success: "text-emerald-600",
    danger: "text-red-600",
    info: "text-blue-600",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${tones[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const def = STATUS_MAP[status];
  const style = def ? STATUS_CATEGORY_STYLE[def.category] : "bg-slate-100 text-slate-600 ring-slate-200";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>
      {def?.label ?? status}
    </span>
  );
}

export function Badge({ children, tone = "slate" }: { children: ReactNode; tone?: string }) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-700 ring-slate-200",
    blue: "bg-blue-50 text-blue-700 ring-blue-200",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-200",
    amber: "bg-amber-50 text-amber-700 ring-amber-200",
    red: "bg-red-50 text-red-700 ring-red-200",
    orange: "bg-accent-50 text-accent-700 ring-accent-200",
    navy: "bg-navy-50 text-navy-700 ring-navy-200",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${tones[tone] ?? tones.slate}`}>
      {children}
    </span>
  );
}

export function EmptyState({ title, hint, children }: { title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
      <p className="text-sm font-semibold text-slate-600">{title}</p>
      {hint && <p className="mt-1 max-w-md text-xs text-slate-400">{hint}</p>}
      {children && <div className="mt-4">{children}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Formulaires (styles partagés)
// ---------------------------------------------------------------------------

export const inputClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-navy-500 focus:ring-2 focus:ring-navy-100 disabled:bg-slate-50";

export const btnPrimary =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-300 disabled:opacity-50";

export const btnAccent =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-300 disabled:opacity-50";

export const btnGhost =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50";

export const btnDanger =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100 disabled:opacity-50";

export function Field({ label, children, hint, className = "" }: {
  label: string;
  children: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1 block text-xs font-semibold tracking-wide text-slate-600 uppercase">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

// ---------------------------------------------------------------------------
// Tableaux
// ---------------------------------------------------------------------------

export function Table({ head, children }: { head: ReactNode[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/60">
            {head.map((h, i) => (
              <th key={i} className="px-4 py-3 text-xs font-semibold tracking-wide text-slate-500 uppercase whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "success" | "warning" | "danger"; children: ReactNode }) {
  const tones = {
    info: "border-blue-200 bg-blue-50 text-blue-800",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    warning: "border-amber-200 bg-amber-50 text-amber-800",
    danger: "border-red-200 bg-red-50 text-red-800",
  };
  return <div className={`rounded-lg border px-4 py-3 text-sm ${tones[tone]}`}>{children}</div>;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export function Pagination({ page, totalPages, baseHref }: { page: number; totalPages: number; baseHref: string }) {
  if (totalPages <= 1) return null;
  const sep = baseHref.includes("?") ? "&" : "?";
  return (
    <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 text-sm">
      <span className="text-slate-500">
        Page {page} / {totalPages}
      </span>
      <div className="flex gap-2">
        {page > 1 && (
          <a className={btnGhost} href={`${baseHref}${sep}page=${page - 1}`}>
            ← Précédent
          </a>
        )}
        {page < totalPages && (
          <a className={btnGhost} href={`${baseHref}${sep}page=${page + 1}`}>
            Suivant →
          </a>
        )}
      </div>
    </div>
  );
}
