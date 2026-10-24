"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { nextShipmentRef, isUniqueViolation } from "@/lib/numbering";
import { addShipmentEvent, attachPackage, detachPackage } from "@/lib/shipments";
import { saveUploadedDocument } from "@/lib/documents";
import { FormState, zodFieldErrors, optionalString, optionalNumber, optionalDate } from "@/lib/form";

// ---------------------------------------------------------------------------
// Création / modification d'expédition
// ---------------------------------------------------------------------------

const shipmentSchema = z.object({
  type: z.enum(["AIR", "SEA"]),
  groupage: z.boolean().optional(),
  originCountry: z.string().trim().max(80).optional().or(z.literal("")),
  originCity: z.string().trim().max(80).optional().or(z.literal("")),
  originCode: z.string().trim().max(12).optional().or(z.literal("")),
  destCountry: z.string().trim().max(80).optional().or(z.literal("")),
  destCity: z.string().trim().max(80).optional().or(z.literal("")),
  destCode: z.string().trim().max(12).optional().or(z.literal("")),
  providerId: z.string().optional().or(z.literal("")),
  flightNumber: z.string().trim().max(40).optional().or(z.literal("")),
  vesselName: z.string().trim().max(120).optional().or(z.literal("")),
  voyageNumber: z.string().trim().max(40).optional().or(z.literal("")),
  containerNumber: z.string().trim().max(40).optional().or(z.literal("")),
  containerType: z.string().trim().max(40).optional().or(z.literal("")),
  awbNumber: z.string().trim().max(40).optional().or(z.literal("")),
  blNumber: z.string().trim().max(40).optional().or(z.literal("")),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

export async function createShipmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const parsed = shipmentSchema.safeParse({
      ...Object.fromEntries(formData.entries()),
      groupage: formData.get("groupage") === "on" || formData.get("groupage") === "true",
    });
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;
    const type = d.type;

    let created: { id: string; reference: string } | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5 && !created; attempt++) {
      const reference = await nextShipmentRef(db, type);
      try {
        created = await db.shipment.create({
          data: {
            reference, type,
            status: "PLANNED",
            groupage: d.groupage ?? false,
            originCountry: d.originCountry || null,
            originCity: d.originCity || null,
            originCode: d.originCode || null,
            destCountry: d.destCountry || null,
            destCity: d.destCity || null,
            destCode: d.destCode || null,
            providerId: d.providerId || null,
            flightNumber: type === "AIR" ? d.flightNumber || null : null,
            vesselName: type === "SEA" ? d.vesselName || null : null,
            voyageNumber: type === "SEA" ? d.voyageNumber || null : null,
            containerNumber: type === "SEA" ? d.containerNumber || null : null,
            containerType: type === "SEA" ? d.containerType || null : null,
            awbNumber: type === "AIR" ? d.awbNumber || null : null,
            blNumber: type === "SEA" ? d.blNumber || null : null,
            notes: d.notes || null,
            createdBy: user.id,
          },
          select: { id: true, reference: true },
        });
      } catch (e) {
        if (isUniqueViolation(e)) { lastError = e; continue; }
        throw e;
      }
    }
    if (!created) throw lastError ?? new Error("Création impossible.");

    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "Shipment", entityId: created.id, after: { reference: created.reference, ...d } });
    revalidatePath("/admin/expeditions");
    return { ok: true, message: `Expédition ${created.reference} créée.`, redirectTo: `/admin/expeditions/${created.id}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function updateShipmentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const id = String(formData.get("id") ?? "");
    const before = await db.shipment.findUnique({ where: { id } });
    if (!before) return { error: "Expédition introuvable." };

    const after = {
      originCountry: optionalString(formData, "originCountry"),
      originCity: optionalString(formData, "originCity"),
      originCode: optionalString(formData, "originCode"),
      destCountry: optionalString(formData, "destCountry"),
      destCity: optionalString(formData, "destCity"),
      destCode: optionalString(formData, "destCode"),
      providerId: optionalString(formData, "providerId"),
      flightNumber: optionalString(formData, "flightNumber"),
      vesselName: optionalString(formData, "vesselName"),
      voyageNumber: optionalString(formData, "voyageNumber"),
      containerNumber: optionalString(formData, "containerNumber"),
      containerType: optionalString(formData, "containerType"),
      awbNumber: optionalString(formData, "awbNumber"),
      blNumber: optionalString(formData, "blNumber"),
      notes: optionalString(formData, "notes"),
      plannedDepartureAt: optionalDate(formData, "plannedDepartureAt"),
      etaAt: optionalDate(formData, "etaAt"),
      currency: optionalString(formData, "currency") ?? before.currency,
      freightCost: optionalNumber(formData, "freightCost"),
      handlingCost: optionalNumber(formData, "handlingCost"),
      portFees: optionalNumber(formData, "portFees"),
      customsFees: optionalNumber(formData, "customsFees"),
      storageCost: optionalNumber(formData, "storageCost"),
      otherFees: optionalNumber(formData, "otherFees"),
    };
    await db.shipment.update({ where: { id }, data: after });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "Shipment", entityId: id, before, after });
    revalidatePath(`/admin/expeditions/${id}`);
    return { ok: true, message: "Expédition mise à jour." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Événements d'expédition (avec propagation groupage)
// ---------------------------------------------------------------------------

export async function addShipmentEventAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const shipmentId = String(formData.get("shipmentId") ?? "");
    const status = String(formData.get("status") ?? "");
    const occurredAt = optionalString(formData, "occurredAt");
    if (!status || !occurredAt) return { error: "Statut et date requis." };

    const result = await addShipmentEvent({
      shipmentId,
      status,
      occurredAt: new Date(occurredAt),
      location: optionalString(formData, "location"),
      description: optionalString(formData, "description") ?? undefined,
      agent: { id: user.id, name: user.name },
      applyToPackages: formData.get("applyToPackages") === "on" || formData.get("applyToPackages") === "true",
    });
    if (!result.ok) return { error: result.error };

    revalidatePath(`/admin/expeditions/${shipmentId}`);
    revalidatePath("/admin");
    return {
      ok: true,
      message: result.updatedPackages > 0
        ? `Événement enregistré et propagé à ${result.updatedPackages} colis du groupage.`
        : "Événement d'expédition enregistré.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Colis du groupage
// ---------------------------------------------------------------------------

export async function attachPackageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const shipmentId = String(formData.get("shipmentId") ?? "");
    const trackingNumber = optionalString(formData, "trackingNumber");
    if (!trackingNumber) return { error: "Numéro de suivi requis." };

    const pkg = await db.package.findUnique({ where: { trackingNumber: trackingNumber.toUpperCase() } });
    if (!pkg) return { error: `Colis ${trackingNumber} introuvable.` };

    const result = await attachPackage(shipmentId, pkg.id, { id: user.id, name: user.name });
    if (!result.ok) return { error: result.error };
    revalidatePath(`/admin/expeditions/${shipmentId}`);
    return { ok: true, message: `Colis ${pkg.trackingNumber} rattaché au groupage — il reste suivi individuellement.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function detachPackageAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const packageId = String(formData.get("packageId") ?? "");
    const shipmentId = String(formData.get("shipmentId") ?? "");
    await detachPackage(packageId, { id: user.id, name: user.name });
    revalidatePath(`/admin/expeditions/${shipmentId}`);
    return { ok: true, message: "Colis détaché du groupage." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function uploadShipmentDocumentAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const shipmentId = String(formData.get("shipmentId") ?? "");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier sélectionné." };
    const result = await saveUploadedDocument({
      file,
      kind: String(formData.get("kind") ?? "OTHER"),
      title: optionalString(formData, "title") ?? file.name,
      visibility: formData.get("visibility") === "CLIENT" ? "CLIENT" : "STAFF",
      shipmentId,
      uploadedById: user.id,
    });
    if (!result.ok) return { error: result.error };
    revalidatePath(`/admin/expeditions/${shipmentId}`);
    return { ok: true, message: "Document ajouté à l'expédition." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
