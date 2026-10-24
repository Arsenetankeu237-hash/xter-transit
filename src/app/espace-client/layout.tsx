import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/app/actions/auth";
import { getSettings } from "@/lib/settings";

export default function EspaceClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <Suspense fallback={<div className="h-14 bg-navy-950" />}>
        <ClientHeader />
      </Suspense>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}

async function ClientHeader() {
  const user = await getSessionUser();
  if (!user) redirect("/connexion?next=/espace-client");
  if (user.role !== "CLIENT") redirect("/admin");
  const settings = await getSettings();
  return (
    <header className="bg-navy-950 text-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/espace-client" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt={settings.brandName + " — Espace client"} className="h-8 w-auto" />
          <span className="text-sm font-semibold text-navy-200">Espace client</span>
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="hidden text-navy-200 sm:block">{user.name}</span>
          <Link href="/espace-client/mot-de-passe" className="text-navy-200 hover:text-white">Mot de passe</Link>
          <Link href="/" className="text-navy-200 hover:text-white">Site</Link>
          <form action={logoutAction}>
            <button className="rounded-lg border border-navy-600 px-3 py-1.5 text-xs font-semibold hover:bg-navy-800">
              Déconnexion
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
