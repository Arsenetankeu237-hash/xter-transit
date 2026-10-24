import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getSettings } from "@/lib/settings";
import { db } from "@/lib/db";
import { TrackWidget } from "@/components/site-chrome";
import { Card } from "@/components/ui";
import { btnAccent, btnGhost } from "@/components/ui";

export default function HomePage() {
  return (
    <>
      {/* Bannière */}
      <section className="relative overflow-hidden bg-navy-950 text-white">
        <div className="pointer-events-none absolute -top-32 -right-24 h-96 w-96 rounded-full bg-accent-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 -left-24 h-96 w-96 rounded-full bg-navy-600/30 blur-3xl" />
        <div className="relative mx-auto max-w-7xl px-4 py-20 sm:py-28">
          <p className="mb-4 inline-flex items-center rounded-full border border-accent-400/40 bg-accent-500/10 px-4 py-1.5 text-xs font-semibold tracking-wide text-accent-300 uppercase">
            Transit international · Vitesse et fiabilité
          </p>
          <h1 className="max-w-3xl text-4xl leading-tight font-black sm:text-5xl">
            Vos colis et marchandises, <span className="text-accent-400">par air ou par mer</span>, suivis jusqu'à la livraison.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-navy-100 sm:text-lg">
            Fret aérien pour vos envois urgents, fret maritime pour le groupage et les volumes,
            dédouanement et livraison finale — un seul numéro de suivi pour tout votre acheminement.
          </p>
          <div className="mt-8">
            <Suspense fallback={<div className="h-[52px] max-w-xl animate-pulse rounded-lg bg-navy-800/60" />}>
              <TrackWidget />
            </Suspense>
            <p className="mt-3 text-xs text-navy-300">
              Format de numéro : XTER-2026-000001 — il vous est communiqué à l'enregistrement de votre colis.
            </p>
          </div>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/devis" className={btnAccent + " px-6 py-3"}>Demander un devis</Link>
            <Link href="/contact" className={btnGhost + " border-navy-600 bg-transparent px-6 py-3 text-white hover:bg-navy-800 hover:text-white"}>
              Nous contacter
            </Link>
          </div>
        </div>
      </section>

      {/* Services */}
      <section id="services" className="mx-auto max-w-7xl px-4 py-16">
        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-100 text-2xl">✈️</div>
            <h2 className="text-lg font-bold text-navy-950">Fret aérien</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Colis, cartons, documents et marchandises urgentes. Poids volumétrique calculé selon les
              règles du transporteur, groupage aérien et suivi étape par étape.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li>• Réception, pesée et contrôle en entrepôt</li>
              <li>• Préparation des documents de transport</li>
              <li>• Dédouanement à l'arrivée</li>
            </ul>
          </Card>
          <Card className="p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-100 text-2xl">🚢</div>
            <h2 className="text-lg font-bold text-navy-950">Fret maritime</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Groupage (LCL) et conteneurs complets (FCL). Cartons, palettes et marchandises volumineuses,
              avec suivi du cycle complet du conteneur.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li>• Empotage, fermeture et départ du navire</li>
              <li>• Arrivée au port, déchargement, dédouanement</li>
              <li>• Mise à disposition ou livraison finale</li>
            </ul>
          </Card>
          <Card className="p-6">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-navy-100 text-2xl">📦</div>
            <h2 className="text-lg font-bold text-navy-950">Groupage & suivi</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Plusieurs clients partagent un même conteneur : chacun suit son propre colis avec son
              numéro dédié, du dépôt à la livraison.
            </p>
            <ul className="mt-4 space-y-1.5 text-xs text-slate-500">
              <li>• Numéro de suivi unique par colis</li>
              <li>• Historique chronologique public</li>
              <li>• Notifications à chaque étape clé</li>
            </ul>
          </Card>
        </div>
      </section>

      {/* Comment ça marche */}
      <section className="bg-white py-16">
        <div className="mx-auto max-w-7xl px-4">
          <h2 className="text-center text-2xl font-bold text-navy-950">Comment ça marche</h2>
          <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { n: "1", t: "Demande & devis", d: "Décrivez votre envoi, recevez un devis adapté au mode de transport." },
              { n: "2", t: "Réception en entrepôt", d: "Votre colis est réceptionné, contrôlé et pesé." },
              { n: "3", t: "Expédition", d: "Aérien ou maritime, avec documents préparés et acheminement suivi." },
              { n: "4", t: "Dédouanement & livraison", d: "Arrivée à destination, dédouanement, retrait ou livraison." },
            ].map((s) => (
              <div key={s.n} className="text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent-500 text-lg font-black text-white">
                  {s.n}
                </div>
                <h3 className="mt-4 text-sm font-bold text-navy-950">{s.t}</h3>
                <p className="mt-2 text-xs leading-relaxed text-slate-500">{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Destinations configurées */}
      <section className="mx-auto max-w-7xl px-4 py-16">
        <Suspense fallback={<div className="h-40 animate-pulse rounded-xl bg-slate-100" />}>
          <DestinationsSummary />
        </Suspense>
      </section>

      {/* À propos (paramétrable) */}
      <section className="bg-navy-950 py-16 text-white">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <Suspense fallback={<div className="h-24 animate-pulse rounded-xl bg-navy-900" />}>
            <AboutSummary />
          </Suspense>
          <Link href="/devis" className={btnAccent + " mt-8 px-6 py-3"}>Obtenir un devis gratuit</Link>
        </div>
      </section>
    </>
  );
}

async function DestinationsSummary() {
  await connection(); // rendu à la demande : données gérées en administration
  const countries = await db.destination.findMany({
    where: { type: "COUNTRY", enabled: true },
    orderBy: { name: "asc" },
    select: { name: true },
  });
  const hubs = await db.destination.count({ where: { type: { in: ["AIRPORT", "PORT"] }, enabled: true } });
  return (
    <div>
      <h2 className="text-2xl font-bold text-navy-950">Destinations desservies</h2>
      <p className="mt-2 text-sm text-slate-500">
        {countries.length > 0
          ? `${countries.length} pays et ${hubs} aéroports/ports configurés par notre équipe.`
          : "Les destinations actives sont publiées dès leur configuration par notre équipe."}
      </p>
      {countries.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {countries.map((c) => (
            <span key={c.name} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">
              {c.name}
            </span>
          ))}
        </div>
      )}
      <Link href="/destinations" className="mt-6 inline-block text-sm font-semibold text-accent-600 hover:text-accent-700">
        Voir toutes les destinations →
      </Link>
    </div>
  );
}

async function AboutSummary() {
  await connection(); // rendu à la demande : données gérées en administration
  const settings = await getSettings();
  return (
    <div>
      <h2 className="text-2xl font-bold">{settings.brandName}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-navy-100">{settings.brandDescription}</p>
    </div>
  );
}
