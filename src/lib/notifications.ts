/**
 * Notifications multi-canaux.
 * - IN_APP : toujours journalisée dans l'espace client ;
 * - EMAIL : envoyée si SMTP configuré, sinon marquée SKIPPED (jamais de faux envoi) ;
 * - WHATSAPP / SMS : architecture prête, marqués SKIPPED tant que le prestataire
 *   officiel n'est pas configuré (voir README §Intégrations).
 */
import { db } from "./db";
import { getSettings } from "./settings";

export type Placeholders = Record<string, string | number | null | undefined>;

export interface DispatchOptions {
  customerId?: string | null;
  userIds?: string[];
  to?: string;
  relatedPackageId?: string | null;
}

function render(template: string, values: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => values[key] ?? "");
}

export async function dispatchNotifications(
  eventKey: string,
  placeholders: Placeholders,
  opts: DispatchOptions
): Promise<void> {
  const settings = await getSettings();
  const templates = await db.notificationTemplate.findMany({
    where: { eventKey, enabled: true },
  });
  if (templates.length === 0) return;

  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(placeholders)) {
    values[k] = v == null ? "" : String(v);
  }
  values.brandName = settings.brandName;

  for (const template of templates) {
    const subject = render(template.subject, values);
    const body = render(template.body, values);

    if (template.channel === "IN_APP") {
      const targets = opts.userIds?.length ? opts.userIds : [];
      for (const userId of targets) {
        await db.notification.create({
          data: {
            channel: "IN_APP", eventKey, userId, customerId: opts.customerId ?? null,
            subject, body, status: "SENT", sentAt: new Date(),
            relatedPackageId: opts.relatedPackageId ?? null,
          },
        });
      }
      continue;
    }

    if (template.channel === "EMAIL") {
      const to = opts.to;
      if (!to) {
        await db.notification.create({
          data: { channel: "EMAIL", eventKey, customerId: opts.customerId ?? null, subject, body, status: "SKIPPED", error: "Aucune adresse e-mail destinataire", relatedPackageId: opts.relatedPackageId ?? null },
        });
        continue;
      }
      if (!process.env.SMTP_HOST) {
        await db.notification.create({
          data: { channel: "EMAIL", eventKey, customerId: opts.customerId ?? null, to, subject, body, status: "SKIPPED", error: "SMTP non configuré (SMTP_HOST vide) — message journalisé uniquement", relatedPackageId: opts.relatedPackageId ?? null },
        });
        continue;
      }
      try {
        const nodemailer = await import("nodemailer");
        const transport = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: Number(process.env.SMTP_PORT ?? 587),
          secure: Number(process.env.SMTP_PORT) === 465,
          auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
        });
        await transport.sendMail({
          from: process.env.SMTP_FROM ?? settings.brandName + " <no-reply@" + (process.env.SMTP_HOST ?? "localhost") + ">",
          to,
          subject,
          text: body,
        });
        await db.notification.create({
          data: { channel: "EMAIL", eventKey, customerId: opts.customerId ?? null, to, subject, body, status: "SENT", sentAt: new Date(), relatedPackageId: opts.relatedPackageId ?? null },
        });
      } catch (e) {
        await db.notification.create({
          data: { channel: "EMAIL", eventKey, customerId: opts.customerId ?? null, to, subject, body, status: "FAILED", error: e instanceof Error ? e.message : String(e), attempts: 1, relatedPackageId: opts.relatedPackageId ?? null },
        });
      }
      continue;
    }

    // WHATSAPP / SMS : prestataire officiel requis, non simulé.
    await db.notification.create({
      data: {
        channel: template.channel, eventKey, customerId: opts.customerId ?? null,
        to: opts.to ?? null, subject, body, status: "SKIPPED",
        error: `Canal ${template.channel} non configuré — intégration officielle requise (voir README)`,
        relatedPackageId: opts.relatedPackageId ?? null,
      },
    });
  }
}
