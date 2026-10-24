"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { nextTrackingNumber, isUniqueViolation } from "@/lib/numbering";
import { addTrackingEvent, correctTrackingEvent } from "@/lib/tracking";
import { saveUploadedDocument } from "@/lib/documents";
import { volumetricWeight } from "@/lib/format";
import { FormState, zodFieldErrors, optionalString, optionalNumber } from "@/lib/form";

// ---------------------------------------------------------------------------
// Création d'un colis (avec numéro de suivi unique)
// ---------------------------------------------------------------------------

const packageSchema = z.object({
  customerId: z.string().min(1, "Client requis"),
  mode: z.enum(["AIR", "SEA"]),
  reference: z.string().trim().max(80).optional().or(z.literal("")),
  contentDescription: z.string().trim().max(500).optional().or(z.literal("")),
  natureOfGoods: z.string().trim().max(200).optional().or(z.literal("")),
  pieces: z.coerce.number().int().positive().max(10000).optional(),
  weightKg: z.coerce.number().positive("Poids invalide").max(100000).optional(),
  lengthCm: z.coerce.number().positive().max(2000).optional(),
  widthCm: z.coerce.number().positive().max(2000).optional(),
  heightCm: z.coerce.number().positive().max(2000).optional(),
  declaredValue: z.coerce.number().min(0).max(1e9).optional(),
  declaredCurrency: z.string().trim().max(8).optional().or(z.literal("")),
  senderAddressId: z.string().optional().or(z.literal("")),
  recipientAddressId: z.string().optional().or(z.literal("")),
  handlingInstructions: z.string().trim().max(1000).optional().or(z.literal("")),
  initialStatus: z.string().optional(),
});

export async function createPackageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("packages:manage");
    const parsed = packageSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;

    const customer = await db.customer.findUnique({ where: { id: d.customerId } });
    if (!customer) return { error: "Client introuvable." };

    const settings = await getSettings();
    const vol = volumetricWeight(d.lengthCm, d.widthCm, d.heightCm, settings.volumetricDivisor);
    const taxable = d.mode === "AIR" && d.weightKg != null ? Math.max(d.weightKg, vol ?? 0) : null;

    // Tentatives de création : la contrainte unique protège les numéros concurrents
    let created: { id: string; trackingNumber: string } | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const trackingNumber = await nextTrackingNumber(db, {
        prefix: settings.trackingPrefix,
        pattern: settings.trackingPattern,
      });
      try {
        created = await db.package.create({
          data: {
            trackingNumber,
            customerId: d.customerId,
            mode: d.mode,
            status: "REQUEST_RECEIVED",
            reference: d.reference || null,
            contentDescription: d.contentDescription || null,
            natureOfGoods: d.natureOfGoods || null,
            pieces: d.pieces ?? null,
            weightKg: d.weightKg ?? null,
            lengthCm: d.lengthCm ?? null,
            widthCm: d.widthCm ?? null,
            heightCm: d.heightCm ?? null,
            volumetricWeightKg: vol,
            taxableWeightKg: taxable,
            declaredValue: d.declaredValue ?? null,
            declaredCurrency: d.declaredCurrency || null,
            senderAddressId: d.senderAddressId || null,
            recipientAddressId: d.recipientAddressId || null,
            handlingInstructions: d.handlingInstructions || null,
            createdBy: user.id,
          },
          select: { id: true, trackingNumber: true },
        });
      } catch (e) {
        if (isUniqueViolation(e)) { lastError = e; continue; }
        throw e;
      }
    }
    if (!created) throw lastError ?? new Error("Création impossible.");

    // Événement initial (réel : l'enregistrement vient d'être effectué)
    await addTrackingEvent({
      packageId: created.id,
      status: "REQUEST_RECEIVED",
      occurredAt: new Date(),
      location: "Plateforme",
      description: "Colis enregistré dans le système.",
      source: "MANUAL",
      agentId: user.id,
    });

    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "Package", entityId: created.id, after: { trackingNumber: created.trackingNumber, ...d } });
    revalidatePath("/admin/colis");
    return { ok: true, message: `Colis ${created.trackingNumber} enregistré.`, redirectTo: `/admin/colis/${created.id}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Modification / archivage
// ---------------------------------------------------------------------------

export async function updatePackageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("packages:manage");
    const id = String(formData.get("id") ?? "");
    const before = await db.package.findUnique({ where: { id } });
    if (!before) return { error: "Colis introuvable." };

    const settings = await getSettings();
    const lengthCm = optionalNumber(formData, "lengthCm") ?? before.lengthCm;
    const widthCm = optionalNumber(formData, "widthCm") ?? before.widthCm;
    const heightCm = optionalNumber(formData, "heightCm") ?? before.heightCm;
    const weightKg = optionalNumber(formData, "weightKg") ?? before.weightKg;
    const mode = String(formData.get("mode") ?? before.mode) as "AIR" | "SEA";
    const vol = volumetricWeight(lengthCm, widthCm, heightCm, settings.volumetricDivisor);
    const taxable = mode === "AIR" && weightKg != null ? Math.max(weightKg, vol ?? 0) : null;

    const after = {
      mode,
      reference: optionalString(formData, "reference"),
      contentDescription: optionalString(formData, "contentDescription"),
      natureOfGoods: optionalString(formData, "natureOfGoods"),
      pieces: optionalNumber(formData, "pieces"),
      weightKg,
      lengthCm, widthCm, heightCm,
      declaredValue: optionalNumber(formData, "declaredValue"),
      declaredCurrency: optionalString(formData, "declaredCurrency"),
      senderAddressId: optionalString(formData, "senderAddressId"),
      recipientAddressId: optionalString(formData, "recipientAddressId"),
      handlingInstructions: optionalString(formData, "handlingInstructions"),
      volumetricWeightKg: vol,
      taxableWeightKg: taxable,
    };
    await db.package.update({ where: { id }, data: after });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "Package", entityId: id, before, after });
    revalidatePath(`/admin/colis/${id}`);
    return { ok: true, message: "Colis mis à jour." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function archivePackageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("packages:manage");
    const id = String(formData.get("id") ?? "");
    const pkg = await db.package.findUnique({ where: { id } });
    if (!pkg) return { error: "Colis introuvable." };
    if (pkg.archivedAt) {
      await db.package.update({ where: { id }, data: { archivedAt: null } });
      await logAudit({ userId: user.id, userName: user.name, action: "UNARCHIVE", entity: "Package", entityId: id });
      revalidatePath(`/admin/colis/${id}`);
      return { ok: true, message: "Colis désarchivé." };
    }
    await db.package.update({ where: { id }, data: { archivedAt: new Date() } });
    await logAudit({ userId: user.id, userName: user.name, action: "ARCHIVE", entity: "Package", entityId: id });
    revalidatePath(`/admin/colis/${id}`);
    return { ok: true, message: "Colis archivé (conservé dans l'historique et les exports)." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Tracking manuel
// ---------------------------------------------------------------------------

const eventSchema = z.object({
  targetId: z.string().min(1),
  status: z.string().min(2),
  occurredAt: z.string().min(4, "Date requise"),
  location: z.string().trim().max(160).optional().or(z.literal("")),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  visiblePublic: z.boolean().optional(),
});

export async function addPackageEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("tracking:manage");
    const parsed = eventSchema.safeParse({
      ...Object.fromEntries(formData.entries()),
      visiblePublic: formData.get("visiblePublic") === "on" || formData.get("visiblePublic") === "true",
    });
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;

    const result = await addTrackingEvent({
      packageId: d.targetId,
      status: d.status,
      occurredAt: new Date(d.occurredAt),
      location: d.location || null,
      description: d.description || undefined as unknown as string,
      source: "MANUAL",
      agentId: user.id,
      visiblePublic: d.visiblePublic,
    });
    if (!result.ok) return { error: result.error };
    if (result.duplicate) return { ok: true, message: "Événement déjà existant (doublon ignoré)." };

    await logAudit({
      userId: user.id, userName: user.name, action: "TRACKING_EVENT", entity: "Package", entityId: d.targetId,
      after: { status: d.status, occurredAt: d.occurredAt },
    });
    revalidatePath(`/admin/colis/${d.targetId}`);
    revalidatePath("/admin");
    return { ok: true, message: "Événement de suivi enregistré." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function correctEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("tracking:manage");
    const eventId = String(formData.get("eventId") ?? "");
    const packageId = String(formData.get("packageId") ?? "");
    const reason = String(formData.get("reason") ?? "").trim();
    if (reason.length < 5) return { error: "Une justification (5 caractères minimum) est requise pour corriger un événement." };

    const fix: Parameters<typeof correctTrackingEvent>[2] = {};
    const status = optionalString(formData, "status");
    if (status) fix.status = status;
    const occurredAt = optionalString(formData, "occurredAt");
    if (occurredAt) fix.occurredAt = new Date(occurredAt);
    const location = optionalString(formData, "location");
    if (location !== null) fix.location = location;
    const description = optionalString(formData, "description");
    if (description) fix.description = description;

    const result = await correctTrackingEvent(eventId, { id: user.id, name: user.name }, fix, reason);
    if (!result.ok) return { error: result.error };

    revalidatePath(`/admin/colis/${packageId}`);
    return { ok: true, message: "Correction enregistrée — l'événement initial est conservé et tracé." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export async function uploadPackageDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("packages:manage");
    const packageId = String(formData.get("packageId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier sélectionné." };

    const result = await saveUploadedDocument({
      file,
      kind: String(formData.get("kind") ?? "OTHER"),
      title: optionalString(formData, "title") ?? file.name,
      visibility: formData.get("visibility") === "CLIENT" ? "CLIENT" : "STAFF",
      packageId,
      uploadedById: user.id,
    });
    if (!result.ok) return { error: result.error };
    await logAudit({ userId: user.id, userName: user.name, action: "UPLOAD", entity: "Document", entityId: result.documentId, after: { packageId, title: file.name } });
    revalidatePath(`/admin/colis/${packageId}`);
    return { ok: true, message: "Document ajouté." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Rattachement expédition
// ---------------------------------------------------------------------------

export async function setPackageShipmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("packages:manage");
    const packageId = String(formData.get("packageId") ?? "");
    const shipmentId = optionalString(formData, "shipmentId");

    if (shipmentId) {
      const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
      if (!shipment) return { error: "Expédition introuvable." };
      if (["CLOSED", "CANCELLED"].includes(shipment.status)) return { error: "Expédition clôturée ou annulée." };
      await db.package.update({ where: { id: packageId }, data: { shipmentId, mode: shipment.type } });
    } else {
      await db.package.update({ where: { id: packageId }, data: { shipmentId: null } });
    }
    await logAudit({
      userId: user.id, userName: user.name, action: "UPDATE", entity: "Package", entityId: packageId,
      after: { shipmentId },
    });
    revalidatePath(`/admin/colis/${packageId}`);
    return { ok: true, message: shipmentId ? "Colis rattaché à l'expédition." : "Colis détaché de son expédition." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
