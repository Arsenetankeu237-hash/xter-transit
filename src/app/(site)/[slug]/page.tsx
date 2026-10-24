import { Suspense } from "react";
import { connection } from "next/server";
import { notFound } from "next/navigation";
import { getSettings } from "@/lib/settings";
import { Card } from "@/components/ui";

const PAGES = {
  "conditions-generales": { title: "Conditions générales", key: "legalCGV" as const },
  "conditions-transport": { title: "Conditions de transport", key: "legalTransport" as const },
  confidentialite: { title: "Politique de confidentialité", key: "legalPrivacy" as const },
};

type Slug = keyof typeof PAGES;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  return { title: page?.title ?? "Informations légales" };
}

export default function LegalPage({ params }: { params: Promise<{ slug: string }> }) {
  return (
    <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}>
      <LegalPageContent params={params} />
    </Suspense>
  );
}

async function LegalPageContent({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = PAGES[slug as Slug];
  if (!page) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-950">{page.title}</h1>
      <div className="mt-8">
        <LegalContent pageKey={page.key} />
      </div>
    </div>
  );
}

async function LegalContent({ pageKey }: { pageKey: "legalCGV" | "legalTransport" | "legalPrivacy" }) {
  await connection(); // rendu à la demande : données gérées en administration
  const s = await getSettings();
  const text = s[pageKey];
  const isPlaceholder = !text || text.startsWith("À compléter");
  return (
    <Card className="p-6">
      <p className={`text-sm leading-relaxed whitespace-pre-line ${isPlaceholder ? "italic text-slate-400" : "text-slate-600"}`}>
        {text || "Document en cours de rédaction par l'entreprise."}
      </p>
      {isPlaceholder && (
        <p className="mt-6 rounded-lg bg-amber-50 px-4 py-3 text-xs text-amber-700">
          Ce document sera publié après finalisation par l'entreprise (Paramètres → Textes légaux).
        </p>
      )}
    </Card>
  );
}
