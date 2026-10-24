import { Suspense } from "react";
import { connection } from "next/server";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui";

export const metadata = { title: "À propos" };

export default function AProposPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-950">À propos</h1>
      <div className="mt-8">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}>
          <AboutContent />
        </Suspense>
      </div>
    </div>
  );
}

async function AboutContent() {
  await connection(); // rendu à la demande : données gérées en administration
  const s = await getSettings();
  return (
    <Card className="p-6">
      <h2 className="text-lg font-bold text-navy-950">{s.brandName}</h2>
      <p className="mt-1 text-sm text-accent-600 font-medium">{s.brandTagline}</p>
      <p className="mt-4 text-sm leading-relaxed whitespace-pre-line text-slate-600">{s.aboutText || s.brandDescription}</p>
      {s.contactAddress && <p className="mt-6 text-sm text-slate-500">📍 {s.contactAddress}</p>}
      {s.contactHours && <p className="mt-1 text-sm text-slate-500">🕘 {s.contactHours}</p>}
    </Card>
  );
}
