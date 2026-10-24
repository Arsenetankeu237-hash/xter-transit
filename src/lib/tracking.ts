/**
 * Moteur de tracking — cœur de la plateforme.
 *
 * - Événements rattachés à un colis et/ou à une expédition ;
 * - sources : MANUEL (agent), API (transporteur), IMPORT (fichier) ;
 * - anti-doublons par empreinte unique pour les sources automatiques ;
 * - corrections tracées (jamais de suppression silencieuse) ;
 * - notifications déclenchées uniquement pour des événements réellement enregistrés.
 */
import { createHash } from "node:crypto";
import { db } from "./db";
import { isPackageStatus, statusLabel } from "./constants";
import { logAudit } from "./audit";
import { dispatchNotifications } from "./notifications";

export interface AddEventParams {
  packageId?: string;
  shipmentId?: string;
  trackingNumber?: string;
  status: string;
  occurredAt: Date;
  location?: string | null;
  description: string;
  source: "MANUAL" | "API" | "IMPORT";
  agentId?: string | null;
  providerId?: string | null;
  integrationId?: string | null;
  externalRef?: string | null;
  visiblePublic?: boolean;
}

export interface AddEventResult {
  ok: boolean;
  duplicate?: boolean;
  eventId?: string;
  error?: string;
}

/** Empreinte anti-doublon : intégration + référence externe + colis + statut + date d'occurrence. */
function computeFingerprint(p: {
  integrationId?: string | null;
  providerId?: string | null;
  externalRef?: string | null;
  scopeId: string;
  status: string;
  occurredAt: Date;
}): string {
  return createHash("sha256")
    .update(
      [p.integrationId ?? "", p.providerId ?? "", p.externalRef ?? "", p.scopeId, p.status, p.occurredAt.toISOString()].join("|")
    )
    .digest("hex");
}

/**
 * Enregistre un événement de tracking.
 * Pour les sources automatiques (API/IMPORT), un doublon détecté n'est pas réinséré.
 */
export async function addTrackingEvent(params: AddEventParams): Promise<AddEventResult> {
  if (!isPackageStatus(params.status)) {
    return { ok: false, error: `Statut inconnu : ${params.status}` };
  }

  // Résolution de la cible
  let packageId = params.packageId ?? null;
  let shipmentId = params.shipmentId ?? null;
  if (!packageId && !shipmentId && params.trackingNumber) {
    const pkg = await db.package.findUnique({ where: { trackingNumber: params.trackingNumber.trim().toUpperCase() } });
    if (pkg) packageId = pkg.id;
    else {
      const shipment = await db.shipment.findUnique({ where: { reference: params.trackingNumber.trim().toUpperCase() } });
      if (shipment) shipmentId = shipment.id;
    }
  }
  if (!packageId && !shipmentId) {
    return { ok: false, error: "Aucun colis ou expédition correspondant." };
  }

  const fingerprint =
    params.source === "MANUAL"
      ? null
      : computeFingerprint({
          integrationId: params.integrationId,
          providerId: params.providerId,
          externalRef: params.externalRef,
          scopeId: packageId ?? `shipment:${shipmentId}`,
          status: params.status,
          occurredAt: params.occurredAt,
        });

  let eventId: string;
  try {
    const created = await db.trackingEvent.create({
      data: {
        packageId,
        shipmentId,
        status: params.status,
        occurredAt: params.occurredAt,
        location: params.location ?? null,
        description: params.description,
        source: params.source,
        agentId: params.source === "MANUAL" ? params.agentId ?? null : null,
        providerId: params.providerId ?? null,
        integrationId: params.integrationId ?? null,
        externalRef: params.externalRef ?? null,
        fingerprint,
        visiblePublic: params.visiblePublic ?? true,
      },
      select: { id: true },
    });
    eventId = created.id;
  } catch (e) {
    if (fingerprint && typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002") {
      return { ok: true, duplicate: true };
    }
    throw e;
  }

  // Le statut actuel du colis suit le dernier événement qui lui est propre
  if (packageId) {
    await db.package.update({
      where: { id: packageId },
      data: {
        status: params.status,
        statusUpdatedAt: new Date(),
        holdFlag: ["DELAYED", "MISSING_DOCUMENT", "AWAITING_REGULARIZATION", "SUSPENDED"].includes(params.status),
      },
    });
  }

  // Notifications — uniquement pour des événements réellement enregistrés
  if (packageId) {
    await notifyForPackage(packageId, params.status);
  }

  return { ok: true, eventId };
}

/** Mapping statut → événement de notification. */
const STATUS_EVENT_KEYS: Record<string, string> = {
  RECEIVED_WAREHOUSE: "package_received_warehouse",
  SHIPPED: "package_shipped",
  VESSEL_DEPARTED: "package_shipped",
  CUSTOMS_CLEARED: "customs_cleared",
  AVAILABLE_PICKUP: "package_available",
  DELIVERED: "package_delivered",
  DELAYED: "delay_reported",
  MISSING_DOCUMENT: "document_missing",
};

async function notifyForPackage(packageId: string, status: string): Promise<void> {
  const eventKey = STATUS_EVENT_KEYS[status];
  if (!eventKey) return;
  try {
    const pkg = await db.package.findUnique({
      where: { id: packageId },
      include: { customer: { include: { users: { where: { active: true } }, } } },
    });
    if (!pkg) return;
    const baseUrl = process.env.APP_URL ?? "";
    await dispatchNotifications(eventKey, {
      trackingNumber: pkg.trackingNumber,
      statusLabel: statusLabel(status),
      mode: pkg.mode,
      trackingUrl: baseUrl ? `${baseUrl}/suivi?numero=${pkg.trackingNumber}` : `/suivi?numero=${pkg.trackingNumber}`,
    }, {
      customerId: pkg.customerId,
      userIds: pkg.customer.users.map((u) => u.id),
      to: pkg.customer.email ?? undefined,
      relatedPackageId: pkg.id,
    });
  } catch (e) {
    console.error("[tracking] notification échouée :", e);
  }
}

// ---------------------------------------------------------------------------
// Correction d'événement (tracée, sans suppression)
// ---------------------------------------------------------------------------

export async function correctTrackingEvent(
  eventId: string,
  agent: { id: string; name: string },
  fix: { status?: string; occurredAt?: Date; location?: string | null; description?: string; visiblePublic?: boolean },
  reason: string
): Promise<AddEventResult> {
  const original = await db.trackingEvent.findUnique({ where: { id: eventId } });
  if (!original) return { ok: false, error: "Événement introuvable." };
  if (original.corrected) return { ok: false, error: "Cet événement a déjà été corrigé." };
  if (fix.status && !isPackageStatus(fix.status)) return { ok: false, error: "Statut inconnu." };

  const replacement = await db.trackingEvent.create({
    data: {
      packageId: original.packageId,
      shipmentId: original.shipmentId,
      status: fix.status ?? original.status,
      occurredAt: fix.occurredAt ?? original.occurredAt,
      location: fix.location !== undefined ? fix.location : original.location,
      description: fix.description ?? original.description,
      source: "MANUAL",
      agentId: agent.id,
      visiblePublic: fix.visiblePublic ?? original.visiblePublic,
    },
    select: { id: true },
  });

  await db.trackingEvent.update({
    where: { id: eventId },
    data: { corrected: true, supersededById: replacement.id, correctionReason: reason },
  });

  // Le statut du colis reprend le dernier événement non corrigé
  if (original.packageId) {
    const last = await db.trackingEvent.findFirst({
      where: { packageId: original.packageId, corrected: false },
      orderBy: { occurredAt: "desc" },
    });
    if (last) {
      await db.package.update({
        where: { id: original.packageId },
        data: { status: last.status, statusUpdatedAt: new Date() },
      });
    }
  }

  await logAudit({
    userId: agent.id,
    userName: agent.name,
    action: "TRACKING_CORRECTION",
    entity: "TrackingEvent",
    entityId: eventId,
    before: {
      status: original.status, occurredAt: original.occurredAt, location: original.location,
      description: original.description, visiblePublic: original.visiblePublic,
    },
    after: { ...fix, replacementId: replacement.id, reason },
  });

  return { ok: true, eventId: replacement.id };
}

// ---------------------------------------------------------------------------
// Chronologies
// ---------------------------------------------------------------------------

export interface TimelineItem {
  id: string;
  status: string;
  occurredAt: Date;
  location: string | null;
  description: string;
  source: string;
  agentName: string | null;
  externalRef: string | null;
  visiblePublic: boolean;
  corrected: boolean;
  shipmentRef: string | null;
  scope: "package" | "shipment";
}

/** Chronologie complète d'un colis : ses événements + ceux de son expédition (groupage). */
export async function packageTimeline(packageId: string): Promise<TimelineItem[]> {
  const pkg = await db.package.findUnique({ where: { id: packageId }, select: { shipmentId: true } });
  const events = await db.trackingEvent.findMany({
    where: {
      OR: [{ packageId }, ...(pkg?.shipmentId ? [{ shipmentId: pkg.shipmentId }] : [])],
    },
    include: { agent: { select: { name: true } }, shipment: { select: { reference: true } } },
    orderBy: { occurredAt: "desc" },
  });
  return events.map((e) => ({
    id: e.id,
    status: e.status,
    occurredAt: e.occurredAt,
    location: e.location,
    description: e.description,
    source: e.source,
    agentName: e.agent?.name ?? null,
    externalRef: e.externalRef,
    visiblePublic: e.visiblePublic,
    corrected: e.corrected,
    shipmentRef: e.shipment?.reference ?? null,
    scope: e.packageId === packageId ? "package" : "shipment",
  }));
}

/** Chronologie publique d'un colis (événements visibles uniquement). */
export async function publicTimeline(packageId: string): Promise<TimelineItem[]> {
  const all = await packageTimeline(packageId);
  return all.filter((e) => e.visiblePublic && !e.corrected);
}

// ---------------------------------------------------------------------------
// Suivi public (données non sensibles uniquement)
// ---------------------------------------------------------------------------

export interface PublicTrackResult {
  trackingNumber: string;
  reference: string | null;
  mode: string;
  status: string;
  statusLabel: string;
  origin: string | null;
  destination: string | null;
  receivedAt: Date | null;
  shippedAt: Date | null;
  eta: Date | null;
  lastEvent: { label: string; occurredAt: Date; location: string | null } | null;
  timeline: Array<{ label: string; occurredAt: Date; location: string | null; description: string; scope: "package" | "shipment" }>;
  shipmentRef: string | null;
}

/** Suivi public par numéro : n'expose aucune donnée personnelle (adresses, noms, contacts). */
export async function publicTrack(trackingNumber: string): Promise<PublicTrackResult | null> {
  const number = trackingNumber.trim().toUpperCase();
  const pkg = await db.package.findUnique({
    where: { trackingNumber: number },
    include: {
      shipment: { select: { reference: true, originCountry: true, originCity: true, destCountry: true, destCity: true, plannedDepartureAt: true, etaAt: true } },
      events: { where: { visiblePublic: true, corrected: false }, orderBy: { occurredAt: "desc" } },
    },
  });
  if (!pkg || pkg.archivedAt) return null;

  const shipmentOrigin = pkg.shipment ? `${pkg.shipment.originCity ?? ""} ${pkg.shipment.originCountry ?? ""}`.trim() : null;
  const shipmentDest = pkg.shipment ? `${pkg.shipment.destCity ?? ""} ${pkg.shipment.destCountry ?? ""}`.trim() : null;

  const sender = await db.address.findUnique({ where: { id: pkg.senderAddressId ?? "" }, select: { country: true, city: true } }).catch(() => null);
  const recipient = await db.address.findUnique({ where: { id: pkg.recipientAddressId ?? "" }, select: { country: true, city: true } }).catch(() => null);

  const timeline = await publicTimeline(pkg.id);

  const receivedEvent = [...timeline].reverse().find((e) => e.status === "RECEIVED_WAREHOUSE");
  const shippedEvent = timeline.find((e) => e.status === "SHIPPED" || e.status === "VESSEL_DEPARTED");

  return {
    trackingNumber: pkg.trackingNumber,
    reference: pkg.reference,
    mode: pkg.mode,
    status: pkg.status,
    statusLabel: statusLabel(pkg.status),
    origin: shipmentOrigin || (sender ? `${sender.city}, ${sender.country}` : null),
    destination: shipmentDest || (recipient ? `${recipient.city}, ${recipient.country}` : null),
    receivedAt: receivedEvent?.occurredAt ?? null,
    shippedAt: shippedEvent?.occurredAt ?? null,
    eta: pkg.shipment?.etaAt ?? null,
    lastEvent: timeline[0]
      ? { label: statusLabel(timeline[0].status), occurredAt: timeline[0].occurredAt, location: timeline[0].location }
      : null,
    timeline: timeline.map((e) => ({
      label: statusLabel(e.status),
      occurredAt: e.occurredAt,
      location: e.location,
      description: e.description,
      scope: e.scope,
    })),
    shipmentRef: pkg.shipment?.reference ?? null,
  };
}
