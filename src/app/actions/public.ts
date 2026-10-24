"use server";

/**
 * Server actions publiques : demande de devis et message de contact.
 * Protégées par validation Zod + limitation de débit.
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { nextQuoteNumber } from "@/lib/numbering";
import { dispatchNotifications } from "@/lib/notifications";
import { rateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";

const quoteSchema = z.object({
  contactName: z.string().trim().min(2, "Nom requis").max(120),
  contactEmail: z.string().trim().email("E-mail invalide").max(190),
  contactPhone: z.string().trim().max(40).optional().or(z.literal("")),
  mode: z.enum(["AIR", "SEA"]),
  originCountry: z.string().trim().min(2, "Pays de départ requis").max(80),
  originCity: z.string().trim().max(80).optional().or(z.literal("")),
  destCountry: z.string().trim().min(2, "Pays de destination requis").max(80),
  destCity: z.string().trim().max(80).optional().or(z.literal("")),
  weightKg: z.coerce.number().positive("Poids invalide").max(100000).optional(),
  lengthCm: z.coerce.number().positive().max(2000).optional(),
  widthCm: z.coerce.number().positive().max(2000).optional(),
  heightCm: z.coerce.number().positive().max(2000).optional(),
  volumeM3: z.coerce.number().positive("Volume invalide").max(200).optional(),
  cargoType: z.string().trim().max(200).optional().or(z.literal("")),
  isUrgent: z.coerce.boolean().optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export interface FormState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
}

async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  } catch {
    return "local";
  }
}

export async function submitQuoteRequest(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`quote:${ip}`, 5, 10 * 60_000).ok) {
    return { error: "Trop de demandes. Merci de réessayer plus tard." };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = quoteSchema.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Merci de corriger les champs signalés.", fieldErrors };
  }
  const data = parsed.data;

  const number = await nextQuoteNumber(db);
  const quote = await db.quote.create({
    data: {
      number,
      mode: data.mode,
      status: "NEW",
      source: "PUBLIC",
      contactName: data.contactName,
      contactEmail: data.contactEmail,
      contactPhone: data.contactPhone || null,
      originCountry: data.originCountry,
      originCity: data.originCity || null,
      destCountry: data.destCountry,
      destCity: data.destCity || null,
      weightKg: data.weightKg ?? null,
      lengthCm: data.lengthCm ?? null,
      widthCm: data.widthCm ?? null,
      heightCm: data.heightCm ?? null,
      volumeM3: data.volumeM3 ?? null,
      cargoType: data.cargoType || null,
      isUrgent: data.isUrgent ?? false,
      notes: data.notes || null,
    },
    select: { id: true, number: true },
  });

  // Notification interne (journalisée) vers les administrateurs
  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"] }, active: true },
    select: { id: true },
  });
  for (const a of admins) {
    await db.notification.create({
      data: {
        channel: "IN_APP", eventKey: "quote_request", userId: a.id,
        subject: `Nouvelle demande de devis ${quote.number}`,
        body: `${data.contactName} (${data.contactEmail}) — ${data.mode === "AIR" ? "Fret aérien" : "Fret maritime"} de ${data.originCountry} vers ${data.destCountry}.`,
        status: "SENT", sentAt: new Date(),
      },
    });
  }

  return {
    ok: true,
    message: `Votre demande a bien été enregistrée sous la référence ${quote.number}. Notre équipe vous répondra dans les plus brefs délais.`,
  };
}

const contactSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(120),
  email: z.string().trim().email("E-mail invalide").max(190),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  subject: z.string().trim().min(2, "Objet requis").max(150),
  message: z.string().trim().min(10, "Message trop court").max(4000),
});

export async function submitContactMessage(_prev: FormState, formData: FormData): Promise<FormState> {
  const ip = await clientIp();
  if (!rateLimit(`contact:${ip}`, 5, 10 * 60_000).ok) {
    return { error: "Trop de messages. Merci de réessayer plus tard." };
  }

  const parsed = contactSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { error: "Merci de corriger les champs signalés.", fieldErrors };
  }
  const data = parsed.data;

  // Journalisation : notification IN_APP vers les administrateurs (+ e-mail si SMTP configuré)
  const admins = await db.user.findMany({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN"] }, active: true },
    select: { id: true, email: true },
  });
  for (const a of admins) {
    await db.notification.create({
      data: {
        channel: "IN_APP", eventKey: "contact_message", userId: a.id,
        subject: `Message de contact : ${data.subject}`,
        body: `${data.name} (${data.email}${data.phone ? ", " + data.phone : ""}) — ${data.message}`,
        status: "SENT", sentAt: new Date(),
      },
    });
  }
  await dispatchNotifications(
    "contact_message",
    { contactName: data.name, contactEmail: data.email, contactPhone: data.phone ?? "", subject: data.subject, messageBody: data.message },
    { to: admins.find((a) => a.email)?.email ?? undefined }
  ).catch(() => null);

  return { ok: true, message: "Votre message a bien été transmis. Nous vous répondrons rapidement." };
}
