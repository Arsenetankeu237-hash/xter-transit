import Link from "next/link";
import { connection } from "next/server";
import { getSettings } from "@/lib/settings";
import { SubmitButton } from "@/components/submit-button";
import { btnAccent } from "@/components/ui";

const NAV = [
  { href: "/", label: "Accueil" },
  { href: "/#services", label: "Services" },
  { href: "/destinations", label: "Destinations" },
  { href: "/suivi", label: "Suivi de colis" },
  { href: "/tarifs", label: "Tarifs indicatifs" },
  { href: "/a-propos", label: "À propos" },
  { href: "/contact", label: "Contact" },
];

export async function SiteNav() {
  await connection(); // rendu à la demande : données gérées en administration
  const settings = await getSettings();
  const wa = settings.whatsappNumber.replace(/[^\d]/g, "");
  return (
    <header className="sticky top-0 z-40 border-b border-navy-900/40 bg-navy-950/95 text-white backdrop-blur print-hidden">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt={settings.brandName} className="h-9 w-auto sm:h-10" />
        </Link>
        <nav className="hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-navy-100 transition hover:bg-navy-800 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          {wa && (
            <a
              href={`https://wa.me/${wa}`}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 sm:inline-flex"
            >
              WhatsApp
            </a>
          )}
          <Link href="/connexion" className="rounded-lg border border-navy-600 px-3 py-2 text-sm font-semibold text-navy-100 transition hover:bg-navy-800">
            Espace client
          </Link>
        </div>
      </div>
      <nav className="flex gap-1 overflow-x-auto border-t border-navy-900 px-4 py-2 lg:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="rounded-lg px-3 py-1.5 text-xs font-medium whitespace-nowrap text-navy-200 hover:bg-navy-800">
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export async function TrackWidget({ compact = false }: { compact?: boolean }) {
  return (
    <form action="/suivi" method="get" className={`flex w-full gap-2 ${compact ? "" : "max-w-xl"}`}>
      <input
        name="numero"
        required
        placeholder="Entrez votre numéro de suivi"
        className="w-full rounded-lg border border-navy-700 bg-navy-900/60 px-4 py-3 text-sm text-white placeholder-navy-300 outline-none focus:border-accent-400"
        aria-label="Numéro de suivi"
      />
      <SubmitButton className={btnAccent + " px-5"} pendingLabel="Recherche…">
        Suivre mon colis
      </SubmitButton>
    </form>
  );
}

export async function SiteFooter() {
  await connection(); // pied de page rendu à la demande (année courante + paramètres)
  const settings = await getSettings();
  return (
    <footer className="mt-auto bg-navy-950 text-navy-200 print-hidden">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo-white.png" alt={settings.brandName} className="h-11 w-auto" />
          <p className="mt-3 text-xs leading-relaxed">{settings.brandTagline}</p>
          {settings.contactAddress && <p className="mt-2 text-xs">{settings.contactAddress}</p>}
          {settings.contactHours && <p className="mt-1 text-xs">{settings.contactHours}</p>}
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-white uppercase">Navigation</p>
          <ul className="mt-3 space-y-1.5 text-xs">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="hover:text-white">{n.label}</Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-white uppercase">Contact</p>
          <ul className="mt-3 space-y-1.5 text-xs">
            {settings.contactPhone && <li>Tél : {settings.contactPhone}</li>}
            {settings.contactPhone2 && <li>Tél : {settings.contactPhone2}</li>}
            {settings.contactEmail && <li>E-mail : {settings.contactEmail}</li>}
            {settings.whatsappNumber && (
              <li>
                <a href={`https://wa.me/${settings.whatsappNumber.replace(/[^\d]/g, "")}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">
                  WhatsApp
                </a>
              </li>
            )}
          </ul>
        </div>
        <div>
          <p className="text-xs font-semibold tracking-wide text-white uppercase">Informations légales</p>
          <ul className="mt-3 space-y-1.5 text-xs">
            <li><Link href="/conditions-generales" className="hover:text-white">Conditions générales</Link></li>
            <li><Link href="/conditions-transport" className="hover:text-white">Conditions de transport</Link></li>
            <li><Link href="/confidentialite" className="hover:text-white">Politique de confidentialité</Link></li>
            <li><Link href="/connexion" className="hover:text-white">Espace client</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-navy-900 py-4 text-center text-[11px] text-navy-400">
        © {new Date().getFullYear()} {settings.brandName}. Tous droits réservés.
      </div>
    </footer>
  );
}
