import { Suspense } from "react";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { ROLES } from "@/lib/constants";
import { logoutAction } from "@/app/actions/auth";
import { AdminSidebar } from "@/components/admin-sidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50 lg:flex-row">
      <Suspense fallback={<div className="h-14 w-full bg-navy-950 lg:h-full lg:w-64" />}>
        <Sidebar />
      </Suspense>
      <div className="flex min-w-0 flex-1 flex-col">
        <Suspense fallback={<div className="h-14 border-b border-slate-200 bg-white" />}>
          <Topbar />
        </Suspense>
        <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}

async function Sidebar() {
  const user = await getSessionUser();
  if (!user) redirect("/connexion?next=/admin");
  if (user.role === "CLIENT") redirect("/espace-client");
  const settings = await getSettings();
  return <AdminSidebar role={user.role} brandName={settings.brandName} />;
}

async function Topbar() {
  const user = await getSessionUser();
  if (!user || user.role === "CLIENT") return null;
  const settings = await getSettings();
  return (
    <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3 print-hidden">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-navy-950">{settings.brandName}</p>
        <p className="text-xs text-slate-400">{ROLES[user.role as keyof typeof ROLES] ?? user.role}</p>
      </div>
      <div className="flex items-center gap-3">
        <Link href="/" className="text-xs font-medium text-slate-500 hover:text-navy-800">Voir le site</Link>
        <span className="hidden rounded-full bg-navy-100 px-3 py-1 text-xs font-semibold text-navy-800 sm:block">
          {user.name}
        </span>
        <form action={logoutAction}>
          <button className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            Déconnexion
          </button>
        </form>
      </div>
    </header>
  );
}
