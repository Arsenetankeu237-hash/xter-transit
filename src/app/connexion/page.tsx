import { Suspense } from "react";
import Link from "next/link";
import { LoginForm } from "@/components/login-form";
import { Card } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Connexion" };

export default function ConnexionPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; changed?: string }>;
}) {
  return (
    <Suspense fallback={null}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ next?: string; changed?: string }> }) {
  const { next, changed } = await searchParams;
  return (
    <div className="flex min-h-screen items-center justify-center bg-navy-950 px-4 py-12">
      <div className="w-full max-w-md">
        <Suspense fallback={<div className="h-16 animate-pulse rounded-xl bg-navy-900" />}>
          <BrandHeader />
        </Suspense>
        <Card className="mt-6 p-6">
          {changed && (
            <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Mot de passe modifié avec succès. Reconnectez-vous.
            </div>
          )}
          <h1 className="text-lg font-bold text-navy-950">Espace client & équipe</h1>
          <p className="mt-1 mb-6 text-xs text-slate-500">
            Clients : suivez vos colis, factures et documents. Équipe : espace de gestion.
          </p>
          <LoginForm next={next} />
          <p className="mt-6 text-center text-xs text-slate-400">
            Pas encore de compte client ? <Link href="/contact" className="font-semibold text-accent-600">Contactez-nous</Link>
          </p>
        </Card>
      </div>
    </div>
  );
}

async function BrandHeader() {
  const s = await getSettings();
  return (
    <div className="text-center text-white">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/logo-white.png" alt={s.brandName} className="mx-auto h-16 w-auto" />
      <p className="mt-3 text-xs text-navy-300">{s.brandTagline}</p>
    </div>
  );
}
