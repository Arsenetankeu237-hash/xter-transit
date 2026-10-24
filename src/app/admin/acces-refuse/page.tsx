import { Suspense } from "react";
import Link from "next/link";
import { PageHeader, Card } from "@/components/ui";
import { getSessionUser } from "@/lib/auth";
import { can } from "@/lib/constants";

export const metadata = { title: "Accès refusé" };

export default function AccessDeniedPage({
  searchParams,
}: {
  searchParams: Promise<{ perm?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ perm?: string }> }) {
  const { perm } = await searchParams;
  const user = await getSessionUser();
  return (
    <div className="mx-auto max-w-2xl py-12">
      <Card className="p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-2xl">⛔</div>
        <h1 className="mt-4 text-xl font-bold text-navy-950">Accès refusé</h1>
        <p className="mt-2 text-sm text-slate-500">
          Votre rôle{user ? ` (${user.name})` : ""} ne dispose pas de la permission nécessaire
          {perm ? ` : ${perm}` : ""} pour cette action.
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {user && can(user.role, "audit:view")
            ? "Si vous pensez qu'il s'agit d'une erreur, contactez le super administrateur."
            : "Contactez un administrateur si vous avez besoin de cet accès."}
        </p>
        <Link href="/admin" className="mt-6 inline-block rounded-lg bg-navy-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-navy-700">
          Retour au tableau de bord
        </Link>
      </Card>
    </div>
  );
}
