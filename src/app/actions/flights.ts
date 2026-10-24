"use server";

import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { FormState, optionalString } from "@/lib/form";
import { isValidAwb } from "@/lib/awb";

// ---------------------------------------------------------------------------
// Appliquer un vol réel trouvé via l'API Amadeus à une expédition aérienne
// ---------------------------------------------------------------------------

export async function applyFlightAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const shipmentId = String(formData.get("shipmentId") ?? "");
    const flightNumber = optionalString(formData, "flightNumber");
    const departAt = optionalString(formData, "departAt");
    const arriveAt = optionalString(formData, "arriveAt");
    if (!shipmentId || !flightNumber) return { error: "Vol invalide." };

    const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return { error: "Expédition introuvable." };
    if (shipment.type !== "AIR") return { error: "Réservé aux expéditions aériennes." };

    // Les infos de vol proviennent de l'API Amadeus = source vérifiée
    const after = {
      flightNumber,
      plannedDepartureAt: departAt ? new Date(departAt) : shipment.plannedDepartureAt,
      etaAt: arriveAt ? new Date(arriveAt) : shipment.etaAt,
      volSource: "Amadeus (API)",
    };
    await db.shipment.update({
      where: { id: shipmentId },
      data: {
        flightNumber,
        plannedDepartureAt: after.plannedDepartureAt,
        etaAt: after.etaAt,
      },
    });
    await logAudit({
      userId: user.id, userName: user.name, action: "FLIGHT_APPLIED", entity: "Shipment", entityId: shipmentId,
      before: { flightNumber: shipment.flightNumber, plannedDepartureAt: shipment.plannedDepartureAt, etaAt: shipment.etaAt },
      after,
    });
    revalidatePath(`/admin/expeditions/${shipmentId}`);
    return { ok: true, message: `Vol ${flightNumber} appliqué à l'expédition (source : Amadeus). Pensez à sélectionner la compagnie transporteur ci-dessous.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Assistant AWB — la clé de contrôle et la validation (règle IATA) sont dans
// src/lib/awb.ts (utilisable côté client et serveur).
// Le numéro définitif reste attribué par la compagnie lors de la réservation.
// ---------------------------------------------------------------------------

export async function saveAwbAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("shipments:manage");
    const shipmentId = String(formData.get("shipmentId") ?? "");
    const awb = (optionalString(formData, "awb") ?? "").replace(/[-\s]/g, "");
    if (!/^(\d{3})(\d{8})(\d)$/.test(awb)) {
      return { error: "Format AWB invalide : 3 chiffres (préfixe) + 8 chiffres (série) + clé de contrôle." };
    }
    if (!isValidAwb(awb)) {
      return { error: "Clé de contrôle incorrecte : elle doit être égale au reste de la division du n° de série par 7 (règle IATA)." };
    }
    const formatted = `${awb.slice(0, 3)}-${awb.slice(3)}`;
    const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
    if (!shipment) return { error: "Expédition introuvable." };

    const duplicate = await db.shipment.findFirst({ where: { awbNumber: formatted, id: { not: shipmentId } } });
    if (duplicate) return { error: `Ce n° AWB est déjà utilisé par l'expédition ${duplicate.reference}.` };

    await db.shipment.update({ where: { id: shipmentId }, data: { awbNumber: formatted } });
    await logAudit({
      userId: user.id, userName: user.name, action: "AWB_SAVED", entity: "Shipment", entityId: shipmentId,
      before: { awbNumber: shipment.awbNumber }, after: { awbNumber: formatted },
    });
    revalidatePath(`/admin/expeditions/${shipmentId}`);
    return { ok: true, message: `AWB maître ${formatted} enregistré.` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

/** Prochain n° de série disponible pour un préfixe donné — d'après les AWB déjà saisis dans NOTRE base. */
export async function suggestNextAwbAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    await actionUser("shipments:manage");
    const prefix = (optionalString(formData, "prefix") ?? "").replace(/\D/g, "");
    if (!/^\d{3}$/.test(prefix)) return { error: "Préfixe à 3 chiffres requis (ex : 057)." };

    const last = await db.shipment.findFirst({
      where: { awbNumber: { startsWith: `${prefix}-` } },
      orderBy: { awbNumber: "desc" },
      select: { awbNumber: true },
    });
    const lastSerial = last ? Number(last.awbNumber!.slice(4, 12)) : 0;
    const nextSerial = String(lastSerial + 1).padStart(8, "0");
    const check = Number(nextSerial) % 7;
    return {
      ok: true,
      message: `${prefix}-${nextSerial}${check}`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
