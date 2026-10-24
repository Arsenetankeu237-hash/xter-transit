import { Suspense } from "react";
import { ContactForm } from "@/components/contact-form";
import { Card } from "@/components/ui";
import { getSettings } from "@/lib/settings";

export const metadata = { title: "Contact" };

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <h1 className="text-3xl font-bold text-navy-950">Contact</h1>
      <p className="mt-2 text-sm text-slate-500">Une question sur un envoi, un devis, nos services ? Écrivez-nous.</p>
      <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
        <Card className="p-6">
          <ContactForm />
        </Card>
        <Suspense fallback={<div className="h-48 animate-pulse rounded-xl bg-slate-100" />}>
          <ContactAside />
        </Suspense>
      </div>
    </div>
  );
}

async function ContactAside() {
  const settings = await getSettings();
  const wa = settings.whatsappNumber.replace(/[^\d]/g, "");
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="text-sm font-semibold text-navy-900 uppercase">Coordonnées</h2>
        <ul className="mt-3 space-y-2 text-sm text-slate-600">
          {settings.contactAddress && <li>📍 {settings.contactAddress}</li>}
          {settings.contactPhone && <li>📞 {settings.contactPhone}</li>}
          {settings.contactPhone2 && <li>📞 {settings.contactPhone2}</li>}
          {settings.contactEmail && <li>✉️ {settings.contactEmail}</li>}
        </ul>
        <h2 className="mt-5 text-sm font-semibold text-navy-900 uppercase">Horaires</h2>
        <p className="mt-2 text-sm text-slate-600">{settings.contactHours || "Nous contacter par e-mail."}</p>
        {wa && (
          <a
            href={`https://wa.me/${wa}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full items-center justify-center rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            Discuter sur WhatsApp
          </a>
        )}
      </Card>
    </div>
  );
}
