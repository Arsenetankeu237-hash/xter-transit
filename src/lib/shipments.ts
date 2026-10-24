/**
 * Expéditions aériennes & maritimes — cycle, événements d'expédition,
 * propagation vers les colis du groupage (sans toucher à leur historique propre).
 */
import { db } from "./db";
import { SHIPMENT_PROPAGATION, statusLabel } from "./constants";
import { addTrackingEvent } from "./tracking";
import { logAudit } from "./audit";

export async function addShipmentEvent(params: {
  shipmentId: string;
  status: string;
  occurredAt: Date;
  location?: string | null;
  description?: string;
  agent: { id: string; name: string };
  applyToPackages?: boolean;
}): Promise<{ ok: boolean; updatedPackages: number; error?: string }> {
  const shipment = await db.shipment.findUnique({
    where: { id: params.shipmentId },
    include: { packages: { select: { id: true } } },
  });
  if (!shipment) return { ok: false, updatedPackages: 0, error: "Expédition introuvable." };

  // Événement au niveau de l'expédition
  await db.trackingEvent.create({
    data: {
      shipmentId: shipment.id,
      status: params.status,
      occurredAt: params.occurredAt,
      location: params.location ?? null,
      description: params.description ?? statusLabel(params.status),
      source: "MANUAL",
      agentId: params.agent.id,
    },
  });

  // Synchronisation des dates clés de l'expédition
  const dateUpdates: Record<string, Date> = {};
  if (params.status === "DEPARTED") dateUpdates.actualDepartureAt = params.occurredAt;
  if (params.status === "ARRIVED") dateUpdates.actualArrivalAt = params.occurredAt;
  if (params.status === "LOADING") dateUpdates.loadedAt = params.occurredAt;
  if (params.status === "UNLOADING") dateUpdates.unloadedAt = params.occurredAt;
  if (params.status === "RELEASED") dateUpdates.releasedAt = params.occurredAt;
  if (Object.keys(dateUpdates).length > 0 || shipment.status !== params.status) {
    await db.shipment.update({
      where: { id: shipment.id },
      data: { status: params.status, ...dateUpdates },
    });
  }

  // Propagation optionnelle vers chaque colis du groupage
  let updated = 0;
  if (params.applyToPackages) {
    const targetStatus = SHIPMENT_PROPAGATION[params.status]?.[shipment.type as "AIR" | "SEA"];
    if (targetStatus) {
      for (const pkg of shipment.packages) {
        const res = await addTrackingEvent({
          packageId: pkg.id,
          status: targetStatus,
          occurredAt: params.occurredAt,
          location: params.location ?? null,
          description: `[${shipment.reference}] ${params.description ?? statusLabel(params.status)}`,
          source: "MANUAL",
          agentId: params.agent.id,
        });
        if (res.ok && !res.duplicate) updated++;
      }
    }
  }

  await logAudit({
    userId: params.agent.id,
    userName: params.agent.name,
    action: "SHIPMENT_EVENT",
    entity: "Shipment",
    entityId: shipment.id,
    after: { status: params.status, occurredAt: params.occurredAt, applyToPackages: params.applyToPackages ?? false, updatedPackages: updated },
  });

  return { ok: true, updatedPackages: updated };
}

/** Rattache un colis à une expédition (groupage ou complet). */
export async function attachPackage(
  shipmentId: string,
  packageId: string,
  agent: { id: string; name: string }
): Promise<{ ok: boolean; error?: string }> {
  const shipment = await db.shipment.findUnique({ where: { id: shipmentId } });
  const pkg = await db.package.findUnique({ where: { id: packageId } });
  if (!shipment || !pkg) return { ok: false, error: "Expédition ou colis introuvable." };
  if (["CLOSED", "CANCELLED"].includes(shipment.status)) {
    return { ok: false, error: "Expédition clôturée ou annulée : rattachement impossible." };
  }
  await db.package.update({
    where: { id: packageId },
    data: { shipmentId, mode: shipment.type }, // le mode suit l'expédition
  });
  await logAudit({
    userId: agent.id, userName: agent.name, action: "PACKAGE_ATTACH",
    entity: "Package", entityId: packageId, after: { shipmentId },
  });
  return { ok: true };
}

export async function detachPackage(
  packageId: string,
  agent: { id: string; name: string }
): Promise<void> {
  const pkg = await db.package.findUnique({ where: { id: packageId }, select: { shipmentId: true } });
  await db.package.update({ where: { id: packageId }, data: { shipmentId: null } });
  await logAudit({
    userId: agent.id, userName: agent.name, action: "PACKAGE_DETACH",
    entity: "Package", entityId: packageId, before: { shipmentId: pkg?.shipmentId ?? null }, after: { shipmentId: null },
  });
}
