"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { addTrackingEvent } from "@/lib/tracking";
import { saveDataUrlDocument, saveUploadedDocument } from "@/lib/documents";
import { FormState, optionalString, optionalDate } from "@/lib/form";

// ---------------------------------------------------------------------------
// Affectation d'une livraison
// ---------------------------------------------------------------------------

export async function assignDeliveryAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("deliveries:manage");
    const packageId = String(formData.get("packageId") ?? "");
    const agentId = optionalString(formData, "agentId");
    const scheduledFor = optionalDate(formData, "scheduledFor");

    const pkg = await db.package.findUnique({ where: { id: packageId } });
    if (!pkg) return { error: "Colis introuvable." };
    if (["DELIVERED", "RETURNED_TO_SENDER", "CANCELLED"].includes(pkg.status)) {
      return { error: "Colis déjà livré, retourné ou annulé." };
    }

    // une seule livraison active par colis
    const active = await db.delivery.findFirst({
      where: { packageId, status: { in: ["ASSIGNED", "IN_PROGRESS", "RESCHEDULED"] } },
    });
    if (active) return { error: "Une livraison est déjà en cours pour ce colis." };

    const delivery = await db.delivery.create({
      data: { packageId, agentId, scheduledFor, status: "ASSIGNED" },
      select: { id: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "DELIVERY_ASSIGN", entity: "Delivery", entityId: delivery.id, after: { packageId, agentId, scheduledFor } });
    revalidatePath("/admin/livraisons");
    revalidatePath(`/admin/colis/${packageId}`);
    return { ok: true, message: "Livraison affectée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Enregistrement d'une tentative / preuve de réception
// ---------------------------------------------------------------------------

export async function recordDeliveryAttemptAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("deliveries:execute");
    const deliveryId = String(formData.get("deliveryId") ?? "");
    const delivery = await db.delivery.findUnique({ where: { id: deliveryId }, include: { package: true } });
    if (!delivery) return { error: "Livraison introuvable." };
    // Un agent de livraison ne traite que ses tournées ; les admins peuvent tout traiter
    if (user.role === "DELIVERY_AGENT" && delivery.agentId && delivery.agentId !== user.id) {
      return { error: "Cette livraison n'est pas affectée à votre tournée." };
    }

    const outcome = String(formData.get("outcome") ?? "");
    if (!["DELIVERED", "FAILED", "RESCHEDULED"].includes(outcome)) return { error: "Résultat invalide." };

    const recipientName = optionalString(formData, "recipientName");
    const note = optionalString(formData, "note");
    const signatureData = optionalString(formData, "signatureData");

    // Pièces jointes : photo + signature (stockage privé)
    let photoDocId: string | null = null;
    const photo = formData.get("photo");
    if (photo instanceof File && photo.size > 0) {
      const saved = await saveUploadedDocument({
        file: photo,
        kind: "POD_PHOTO",
        title: `Preuve de livraison — ${delivery.package.trackingNumber}`,
        packageId: delivery.packageId,
        uploadedById: user.id,
      });
      if (!saved.ok) return { error: "Photo : " + saved.error };
      photoDocId = saved.documentId ?? null;
    }
    let signatureDocId: string | null = null;
    if (signatureData && signatureData.startsWith("data:image/")) {
      const saved = await saveDataUrlDocument({
        dataUrl: signatureData,
        kind: "SIGNATURE",
        title: `Signature — ${delivery.package.trackingNumber}`,
        packageId: delivery.packageId,
        uploadedById: user.id,
      });
      if (!saved.ok) return { error: "Signature : " + saved.error };
      signatureDocId = saved.documentId ?? null;
    }

    if (outcome === "DELIVERED" && !recipientName) {
      return { error: "Le nom du réceptionnaire est requis pour confirmer une livraison." };
    }

    const now = new Date();
    await db.delivery.update({
      where: { id: deliveryId },
      data: {
        status: outcome,
        attempts: { increment: 1 },
        lastAttemptAt: now,
        deliveredAt: outcome === "DELIVERED" ? now : null,
        recipientName,
        note,
        photoDocId,
        signatureDocId,
        confirmedById: outcome === "DELIVERED" ? user.id : null,
      },
    });

    // L'événement de tracking n'est créé que pour une livraison réellement enregistrée
    if (outcome === "DELIVERED") {
      await addTrackingEvent({
        packageId: delivery.packageId,
        status: "DELIVERED",
        occurredAt: now,
        location: optionalString(formData, "location"),
        description: `Livré à ${recipientName}${note ? ` — ${note}` : ""}`,
        source: "MANUAL",
        agentId: user.id,
      });
    } else if (outcome === "RESCHEDULED") {
      await db.delivery.update({
        where: { id: deliveryId },
        data: { scheduledFor: optionalDate(formData, "scheduledFor") },
      });
    }

    await logAudit({
      userId: user.id, userName: user.name,
      action: outcome === "DELIVERED" ? "DELIVERY_CONFIRMED" : "DELIVERY_ATTEMPT",
      entity: "Delivery", entityId: deliveryId,
      after: { outcome, recipientName, photoDocId, signatureDocId },
    });
    revalidatePath("/admin/livraisons");
    revalidatePath(`/admin/livraisons/${deliveryId}`);
    return {
      ok: true,
      message:
        outcome === "DELIVERED"
          ? "Livraison confirmée — événement de suivi et notification client générés."
          : outcome === "FAILED"
            ? "Échec de livraison enregistré."
            : "Nouvelle tentative programmée.",
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
