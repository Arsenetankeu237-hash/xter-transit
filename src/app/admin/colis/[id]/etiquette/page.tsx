import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import QRCode from "qrcode";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { statusLabel, MODES } from "@/lib/constants";
import { formatWeight, formatDate } from "@/lib/format";
import { btnGhost } from "@/components/ui";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Étiquette colis" };

export default async function LabelPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <ResolvePageParams params={params} />
    </Suspense>
  );
}

async function ResolvePageParams({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content packageId={id} />
    </Suspense>
  );
}

async function Content({ packageId }: { packageId: string }) {
  await connection(); // contenu généré à la demande (date d'impression, QR code)
  const pkg = await db.package.findUnique({
    where: { id: packageId },
    include: { customer: true, senderAddress: true, recipientAddress: true, shipment: true },
  });
  if (!pkg) notFound();
  const settings = await getSettings();

  const trackUrl = `${process.env.APP_URL ?? ""}/suivi?numero=${pkg.trackingNumber}`;
  const qrDataUrl = await QRCode.toDataURL(trackUrl, { width: 260, margin: 1, errorCorrectionLevel: "M" });

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between print-hidden">
        <Link href={`/admin/colis/${pkg.id}`} className={btnGhost}>← Retour au colis</Link>
        <p className="text-xs text-slate-400">Le QR code ouvre la page publique de suivi de ce colis.</p>
      </div>

      <div className="print-page rounded-xl border-2 border-navy-950 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between border-b-2 border-navy-950 pb-4">
          <div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt={settings.brandName} className="h-12 w-auto" />
            {settings.contactAddress && <p className="mt-1 text-xs text-slate-500">{settings.contactAddress}</p>}
            {settings.contactPhone && <p className="text-xs text-slate-500">Tél : {settings.contactPhone}</p>}
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Étiquette colis</p>
            <p className="text-xs text-slate-500">{formatDate(new Date())}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-6">
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">N° de suivi</p>
              <p className="font-mono text-2xl font-black tracking-tight text-navy-950">{pkg.trackingNumber}</p>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Client</p>
                <p className="font-semibold text-navy-900">{pkg.customer.name}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Mode</p>
                <p className="font-semibold text-navy-900">{MODES[pkg.mode as keyof typeof MODES]}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Poids</p>
                <p className="text-navy-900">{formatWeight(pkg.weightKg)}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Pièces</p>
                <p className="text-navy-900">{pkg.pieces ?? "—"}</p>
              </div>
            </div>
            {pkg.shipment && (
              <div>
                <p className="text-[10px] font-bold text-slate-400 uppercase">Expédition</p>
                <p className="font-mono text-sm text-navy-900">{pkg.shipment.reference}</p>
              </div>
            )}
          </div>
          <div className="text-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrDataUrl} alt={`QR code suivi ${pkg.trackingNumber}`} className="h-40 w-40" />
            <p className="mt-1 text-[10px] text-slate-400">Scannez pour suivre</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-200 pt-4 text-sm">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Expéditeur</p>
            <p className="mt-1 font-semibold text-navy-900">{pkg.senderAddress?.contactName ?? pkg.customer.name}</p>
            {pkg.senderAddress && (
              <p className="text-xs text-slate-500">{pkg.senderAddress.line1}, {pkg.senderAddress.city}, {pkg.senderAddress.country}</p>
            )}
          </div>
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">Destinataire</p>
            <p className="mt-1 font-semibold text-navy-900">{pkg.recipientAddress?.contactName ?? "—"}</p>
            {pkg.recipientAddress && (
              <p className="text-xs text-slate-500">{pkg.recipientAddress.line1}, {pkg.recipientAddress.city}, {pkg.recipientAddress.country}</p>
            )}
          </div>
        </div>

        <div className="mt-4 border-t border-dashed border-slate-300 pt-3">
          <p className="text-xs text-slate-500">
            Statut à l'impression : {statusLabel(pkg.status)} · {pkg.contentDescription ? `Contenu : ${pkg.contentDescription}` : ""}
          </p>
          <p className="mt-1 text-[10px] text-slate-400">
            Document interne généré par la plateforme — ne remplace pas les documents officiels de transport ou de douane.
          </p>
        </div>
      </div>

      <div className="mt-6 text-center print-hidden">
        <PrintButton />
      </div>
    </div>
  );
}
