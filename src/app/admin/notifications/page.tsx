import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, CardHeader, Badge, Table, inputClass, PageHeader, Alert } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { updateTemplateAction } from "@/app/actions/config";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const [templates, outbox] = await Promise.all([
    db.notificationTemplate.findMany({ orderBy: [{ eventKey: "asc" }, { channel: "asc" }] }),
    db.notification.findMany({ orderBy: { createdAt: "desc" }, take: 50 }),
  ]);
  const smtpConfigured = Boolean(process.env.SMTP_HOST);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        subtitle="Modèles de messages et journal d'envoi (e-mail, espace client, WhatsApp/SMS)"
      />
      {!smtpConfigured && (
        <Alert tone="warning">
          SMTP non configuré (SMTP_HOST vide) : les e-mails sont journalisés avec le statut « SKIPPED » mais pas réellement envoyés.
          Configurez SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS et SMTP_FROM dans le fichier .env.
        </Alert>
      )}

      <Card>
        <CardHeader title={`Modèles (${templates.length})`} />
        <div className="divide-y divide-slate-50">
          {templates.map((t) => (
            <details key={t.id} className="px-5 py-4">
              <summary className="flex cursor-pointer flex-wrap items-center gap-3">
                <span className="font-mono text-xs font-semibold text-navy-800">{t.eventKey}</span>
                <Badge tone={t.channel === "IN_APP" ? "navy" : t.channel === "EMAIL" ? "blue" : "green"}>{t.channel}</Badge>
                {t.enabled ? <Badge tone="green">actif</Badge> : <Badge tone="red">désactivé</Badge>}
                <span className="text-xs text-slate-400">{t.subject}</span>
              </summary>
              <div className="mt-4 max-w-2xl">
                <ActionForm action={updateTemplateAction} submitLabel="Enregistrer le modèle">
                  <input type="hidden" name="id" value={t.id} />
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 uppercase">Objet</span>
                    <input name="subject" defaultValue={t.subject} className={inputClass} />
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-600 uppercase">Corps (variables : {"{{trackingNumber}}, {{statusLabel}}, {{trackingUrl}}, {{brandName}}, {{invoiceNumber}}, {{amount}}…"})</span>
                    <textarea name="body" rows={6} defaultValue={t.body} className={inputClass + " font-mono text-xs"} />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    <input type="checkbox" name="enabled" defaultChecked={t.enabled} className="h-4 w-4" />
                    Modèle actif
                  </label>
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="Journal d'envoi (50 dernières)" />
        <Table head={["Date", "Canal", "Événement", "Destinataire", "Objet", "Statut", "Détail"]}>
          {outbox.length === 0 && (
            <tr><td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-500">Aucune notification envoyée pour le moment.</td></tr>
          )}
          {outbox.map((n) => (
            <tr key={n.id}>
              <td className="px-4 py-2.5 text-xs text-slate-500">{formatDateTime(n.createdAt)}</td>
              <td className="px-4 py-2.5 text-xs">{n.channel}</td>
              <td className="px-4 py-2.5 font-mono text-xs text-slate-500">{n.eventKey}</td>
              <td className="px-4 py-2.5 text-xs text-slate-500">{n.to ?? (n.userId ? "espace client" : "—")}</td>
              <td className="px-4 py-2.5 text-xs text-slate-700">{n.subject}</td>
              <td className="px-4 py-2.5">
                <Badge tone={n.status === "SENT" ? "green" : n.status === "FAILED" ? "red" : "amber"}>{n.status}</Badge>
              </td>
              <td className="px-4 py-2.5 max-w-56 truncate text-xs text-slate-400" title={n.error ?? ""}>{n.error ?? ""}</td>
            </tr>
          ))}
        </Table>
      </Card>
    </div>
  );
}
