import Link from "next/link";
import type { Permission } from "@/lib/constants";
import { can } from "@/lib/constants";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  permission?: Permission;
}

export const ADMIN_NAV: Array<{ section: string; items: NavItem[] }> = [
  {
    section: "Pilotage",
    items: [
      { href: "/admin", label: "Tableau de bord", icon: "▦" },
      { href: "/admin/recherche", label: "Recherche globale", icon: "⌕" },
    ],
  },
  {
    section: "Opérations",
    items: [
      { href: "/admin/clients", label: "Clients", icon: "◉", permission: "customers:manage" },
      { href: "/admin/colis", label: "Colis", icon: "▣", permission: "packages:manage" },
      { href: "/admin/expeditions", label: "Expéditions", icon: "✈", permission: "shipments:manage" },
      { href: "/admin/livraisons", label: "Livraisons", icon: "➤", permission: "deliveries:execute" },
    ],
  },
  {
    section: "Commercial",
    items: [
      { href: "/admin/devis", label: "Devis", icon: "▤", permission: "quotes:manage" },
      { href: "/admin/factures", label: "Factures & paiements", icon: "₣", permission: "finance:manage" },
    ],
  },
  {
    section: "Référentiels",
    items: [
      { href: "/admin/destinations", label: "Destinations", icon: "⌖", permission: "destinations:manage" },
      { href: "/admin/partenaires", label: "Partenaires", icon: "⇄", permission: "destinations:manage" },
      { href: "/admin/integrations", label: "Intégrations transporteurs", icon: "⇅", permission: "integrations:manage" },
    ],
  },
  {
    section: "Administration",
    items: [
      { href: "/admin/notifications", label: "Notifications", icon: "◔", permission: "notifications:manage" },
      { href: "/admin/utilisateurs", label: "Utilisateurs & rôles", icon: "☺", permission: "users:manage" },
      { href: "/admin/parametres", label: "Paramètres", icon: "⚙", permission: "settings:manage" },
      { href: "/admin/audit", label: "Journal d'audit", icon: "☰", permission: "audit:view" },
    ],
  },
];

export function AdminSidebar({ role, brandName }: { role: string; brandName: string }) {
  return (
    <aside className="flex w-full shrink-0 flex-col bg-navy-950 text-navy-100 lg:w-64">
      <Link href="/admin" className="border-b border-navy-900 px-5 py-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo-white.png" alt={brandName} className="h-9 w-auto" />
        <span className="mt-2 block text-[10px] text-navy-300">Console d'administration</span>
      </Link>
      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {ADMIN_NAV.map((group) => {
          const items = group.items.filter((i) => !i.permission || can(role, i.permission));
          if (items.length === 0) return null;
          return (
            <div key={group.section}>
              <p className="px-3 pb-2 text-[10px] font-bold tracking-widest text-navy-400 uppercase">{group.section}</p>
              <ul className="space-y-0.5">
                {items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-navy-200 transition hover:bg-navy-800 hover:text-white"
                    >
                      <span className="w-4 text-center text-xs opacity-70">{item.icon}</span>
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
