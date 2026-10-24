/**
 * Intégrations transporteurs — architecture par adaptateurs.
 *
 * Principes :
 * - Aucune clé API inventée : chaque intégration référence des variables
 *   d'environnement (le secret ne transite jamais en base) ;
 * - Tant qu'aucun transporteur n'est configuré, la plateforme reste 100 %
 *   opérationnelle en suivi manuel ;
 * - Les événements importés sont normalisés, dédupliqués (empreinte unique) et
 *   tracés (TrackingSyncLog) ; un échec d'intégration ne supprime jamais les
 *   événements existants ;
 * - Contrôle des webhooks entrants : secret partagé ou signature HMAC.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "./db";
import { isPackageStatus, statusLabel } from "./constants";
import { addTrackingEvent } from "./tracking";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExternalEvent {
  /** Numéro de suivi XTER Transit (colis) ou référence d'expédition. */
  trackingNumber: string;
  /** Statut brut chez le transporteur (normalisé ensuite). */
  status: string;
  occurredAt: string; // ISO 8601
  location?: string;
  description?: string;
  /** Identifiant unique chez le transporteur (idempotence renforcée). */
  externalId?: string;
}

export interface AdapterConfig {
  [key: string]: string | number | boolean | undefined;
}

export interface CarrierAdapter {
  key: string;
  label: string;
  description: string;
  configFields: Array<{ name: string; label: string; type: "text" | "url" | "number"; hint?: string; required?: boolean }>;
  /** Interroge le transporteur (polling) — absent pour les adaptateurs webhook seul. */
  fetchEvents?: (config: AdapterConfig, refs: string[]) => Promise<ExternalEvent[]>;
  /** Vérifie + parse un webhook entrant. */
  parseWebhook?: (config: AdapterConfig, rawBody: string, headers: Headers) => Promise<{ ok: boolean; events?: ExternalEvent[]; error?: string }>;
}

// ---------------------------------------------------------------------------
// Normalisation des statuts externes → statuts internes
// ---------------------------------------------------------------------------

const DEFAULT_NORMALIZATION: Record<string, string> = {
  // anglicismes courants des transporteurs
  received: "RECEIVED_WAREHOUSE", pickup: "RECEIVED_WAREHOUSE", collected: "RECEIVED_WAREHOUSE",
  weighed: "CONTROLLED_WEIGHED", processed: "PREPARATION", "ready for departure": "AWAITING_DEPARTURE",
  booked: "AWAITING_DEPARTURE", departed: "SHIPPED", shipped: "SHIPPED", "flight departed": "SHIPPED",
  "in transit": "IN_TRANSIT", "linehaul": "IN_TRANSIT", "transit hub": "TRANSIT_HUB", hub: "TRANSIT_HUB",
  arrived: "ARRIVED_DESTINATION_COUNTRY", "arrival destination": "ARRIVED_DESTINATION_COUNTRY",
  customs: "CUSTOMS_IN_PROGRESS", "customs hold": "CUSTOMS_IN_PROGRESS", "under customs": "CUSTOMS_IN_PROGRESS",
  "customs released": "CUSTOMS_CLEARED", cleared: "CUSTOMS_CLEARED",
  "available for pickup": "AVAILABLE_PICKUP", ready: "AVAILABLE_PICKUP",
  "out for delivery": "OUT_FOR_DELIVERY", delivering: "OUT_FOR_DELIVERY",
  delivered: "DELIVERED", "proof of delivery": "DELIVERED",
  delayed: "DELAYED", exception: "AWAITING_REGULARIZATION", "on hold": "SUSPENDED",
  "returned to sender": "RETURNED_TO_SENDER", returned: "RETURN_IN_PROGRESS",
  cancelled: "CANCELLED", canceled: "CANCELLED",
  // maritime
  stuffed: "CONTAINER_STUFFED", loaded: "CONTAINER_STUFFED",
  "vessel departed": "VESSEL_DEPARTED", sailed: "VESSEL_DEPARTED",
  "vessel arrived": "VESSEL_ARRIVED", "berthed": "VESSEL_ARRIVED",
  discharged: "CONTAINER_UNLOADED", unloaded: "CONTAINER_UNLOADED",
  released: "AVAILABLE_PICKUP",
};

/**
 * Normalise un statut externe : 1) mapping propre à l'intégration,
 * 2) table par défaut, 3) valeur interne directe.
 * Retourne null si inconnu → l'événement est ignoré et journalisé (jamais deviné).
 */
export function normalizeStatus(
  external: string,
  customMapping?: Record<string, string>
): string | null {
  const key = external.trim().toLowerCase();
  if (customMapping && customMapping[key] && isPackageStatus(customMapping[key])) {
    return customMapping[key];
  }
  if (isPackageStatus(key.toUpperCase().replace(/[\s-]+/g, "_"))) return key.toUpperCase().replace(/[\s-]+/g, "_");
  const mapped = DEFAULT_NORMALIZATION[key];
  return mapped && isPackageStatus(mapped) ? mapped : null;
}

// ---------------------------------------------------------------------------
// Adaptateurs génériques (contrat documenté pour les partenaires)
// ---------------------------------------------------------------------------

/** Contrat JSON attendu : tableau d'objets {trackingNumber,status,occurredAt,location,description,externalId}. */
function parseEventsPayload(json: unknown): ExternalEvent[] {
  if (Array.isArray(json)) return json.filter(isExternalEvent);
  if (typeof json === "object" && json !== null && Array.isArray((json as { events?: unknown }).events)) {
    return ((json as { events: unknown[] }).events).filter(isExternalEvent);
  }
  return [];
}

function isExternalEvent(v: unknown): v is ExternalEvent {
  if (typeof v !== "object" || v === null) return false;
  const e = v as Record<string, unknown>;
  return typeof e.trackingNumber === "string" && typeof e.status === "string" && typeof e.occurredAt === "string";
}

const genericRest: CarrierAdapter = {
  key: "generic-rest",
  label: "API REST partenaire (générique)",
  description:
    "Interroge une endpoint HTTP du partenaire : GET {baseUrl}/{référence} avec en-tête Authorization: Bearer {clé}. " +
    "L'endpoint doit renvoyer un JSON {events:[{trackingNumber,status,occurredAt,location,description,externalId}]} (contrat documenté dans le README).",
  configFields: [
    { name: "baseUrl", label: "URL de base de l'API", type: "url", required: true, hint: "ex: https://api.partenaire.com/v1/tracking" },
    { name: "apiKeyEnvVar", label: "Nom de la variable d'environnement contenant la clé", type: "text", required: true, hint: "ex: TRANSPORTEUR_X_API_KEY — la clé elle-même reste dans le fichier .env, jamais en base" },
    { name: "timeoutSeconds", label: "Délai d'expiration (s)", type: "number" },
  ],
  async fetchEvents(config, refs) {
    const baseUrl = String(config.baseUrl ?? "").replace(/\/$/, "");
    const apiKey = process.env[String(config.apiKeyEnvVar ?? "")] ?? "";
    if (!baseUrl) throw new Error("URL de base manquante.");
    if (!apiKey) throw new Error(`Variable d'environnement ${String(config.apiKeyEnvVar)} non définie.`);
    const timeout = (Number(config.timeoutSeconds) || 20) * 1000;
    const all: ExternalEvent[] = [];
    for (const ref of refs.slice(0, 50)) { // limite par synchronisation
      const res = await fetch(`${baseUrl}/${encodeURIComponent(ref)}`, {
        headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
        signal: AbortSignal.timeout(timeout),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} pour ${ref}`);
      all.push(...parseEventsPayload(await res.json()));
    }
    return all;
  },
};

const genericWebhook: CarrierAdapter = {
  key: "generic-webhook",
  label: "Webhook entrant (générique)",
  description:
    "Le partenaire pousse ses événements vers l'URL fournie. Authentification : en-tête x-webhook-secret (secret partagé) " +
    "ou x-signature: sha256=HMAC(body, secret). Corps attendu : {events:[…]} (même contrat que l'API REST).",
  configFields: [
    { name: "secretEnvVar", label: "Nom de la variable d'environnement contenant le secret", type: "text", required: true },
  ],
  async parseWebhook(config, rawBody, headers) {
    const secret = process.env[String(config.secretEnvVar ?? "")] ?? "";
    if (!secret) return { ok: false, error: `Variable d'environnement ${String(config.secretEnvVar)} non définie.` };

    const providedSecret = headers.get("x-webhook-secret");
    if (providedSecret) {
      const a = Buffer.from(providedSecret);
      const b = Buffer.from(secret);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "Secret webhook invalide." };
    } else {
      const signature = headers.get("x-signature") ?? "";
      const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) return { ok: false, error: "Signature HMAC invalide." };
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return { ok: false, error: "Corps JSON invalide." };
    }
    return { ok: true, events: parseEventsPayload(json) };
  },
};

export const ADAPTERS: CarrierAdapter[] = [genericRest, genericWebhook];

export function getAdapter(key: string): CarrierAdapter | null {
  return ADAPTERS.find((a) => a.key === key) ?? null;
}

// ---------------------------------------------------------------------------
// Import d'événements (commun sync / webhook / CSV)
// ---------------------------------------------------------------------------

export interface ImportReport {
  imported: number;
  duplicates: number;
  failed: number;
  errors: string[];
}

export async function importExternalEvents(
  integrationId: string,
  providerId: string,
  events: ExternalEvent[],
  customMapping?: Record<string, string>
): Promise<ImportReport> {
  const report: ImportReport = { imported: 0, duplicates: 0, failed: 0, errors: [] };

  for (const evt of events) {
    const status = normalizeStatus(evt.status, customMapping);
    if (!status) {
      report.failed++;
      report.errors.push(`Statut externe inconnu « ${evt.status} » (${evt.trackingNumber}) — ignoré.`);
      continue;
    }
    const occurredAt = new Date(evt.occurredAt);
    if (Number.isNaN(occurredAt.getTime())) {
      report.failed++;
      report.errors.push(`Date invalide « ${evt.occurredAt} » (${evt.trackingNumber}).`);
      continue;
    }
    const res = await addTrackingEvent({
      trackingNumber: evt.trackingNumber,
      status,
      occurredAt,
      location: evt.location ?? null,
      description: evt.description?.slice(0, 500) || `Événement transporteur : ${statusLabel(status)}`,
      source: "API",
      providerId,
      integrationId,
      externalRef: evt.externalId ?? null,
    });
    if (res.ok && res.duplicate) report.duplicates++;
    else if (res.ok) report.imported++;
    else {
      report.failed++;
      report.errors.push(`${evt.trackingNumber} : ${res.error}`);
    }
  }
  return report;
}

// ---------------------------------------------------------------------------
// Synchronisation périodique (polling)
// ---------------------------------------------------------------------------

export async function runSync(integrationId: string, trigger: "MANUAL" | "CRON"): Promise<ImportReport & { logId: string; error?: string }> {
  const integration = await db.providerIntegration.findUnique({
    where: { id: integrationId },
    include: { provider: true },
  });
  if (!integration) throw new Error("Intégration introuvable.");
  if (!integration.enabled) throw new Error("Intégration désactivée.");

  const adapter = getAdapter(integration.adapterKey);
  if (!adapter?.fetchEvents) throw new Error("Cet adaptateur ne supporte pas la synchronisation (webhook uniquement).");

  const log = await db.trackingSyncLog.create({
    data: { integrationId, trigger, status: "RUNNING" },
    select: { id: true },
  });

  try {
    // Références à synchroniser : colis/expéditions non livrés liés à ce transporteur
    const config = JSON.parse(integration.config || "{}") as AdapterConfig;
    const packages = await db.package.findMany({
      where: {
        status: { notIn: ["DELIVERED", "RETURNED_TO_SENDER", "CANCELLED"] },
        shipment: { providerId: integration.providerId },
      },
      select: { trackingNumber: true },
    });
    const shipments = await db.shipment.findMany({
      where: {
        providerId: integration.providerId,
        status: { notIn: ["CLOSED", "CANCELLED"] },
      },
      select: { reference: true },
    });
    const refs = [...packages.map((p) => p.trackingNumber), ...shipments.map((s) => s.reference)];

    let report: ImportReport = { imported: 0, duplicates: 0, failed: 0, errors: [] };
    if (refs.length > 0) {
      const events = await adapter.fetchEvents(config, refs);
      report = await importExternalEvents(integrationId, integration.providerId, events);
    }

    const status = report.failed > 0 ? "PARTIAL" : "SUCCESS";
    await db.trackingSyncLog.update({
      where: { id: log.id },
      data: {
        status,
        imported: report.imported,
        duplicates: report.duplicates,
        failed: report.failed,
        details: report.errors.length ? JSON.stringify(report.errors.slice(0, 20)) : null,
        finishedAt: new Date(),
      },
    });
    await db.providerIntegration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), lastSyncStatus: status, lastSyncMessage: `${report.imported} importé(s), ${report.duplicates} doublon(s), ${report.failed} échec(s)` },
    });
    return { ...report, logId: log.id };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.trackingSyncLog.update({
      where: { id: log.id },
      data: { status: "ERROR", failed: 1, details: JSON.stringify([message]), finishedAt: new Date() },
    });
    await db.providerIntegration.update({
      where: { id: integrationId },
      data: { lastSyncAt: new Date(), lastSyncStatus: "ERROR", lastSyncMessage: message },
    });
    return { imported: 0, duplicates: 0, failed: 1, errors: [message], logId: log.id, error: message };
  }
}

// ---------------------------------------------------------------------------
// Webhooks entrants
// ---------------------------------------------------------------------------

export async function processWebhook(
  integrationId: string,
  rawBody: string,
  headers: Headers
): Promise<{ ok: boolean; status: number; message: string }> {
  const integration = await db.providerIntegration.findUnique({ where: { id: integrationId } });
  if (!integration || !integration.enabled || integration.adapterKey !== "generic-webhook") {
    return { ok: false, status: 404, message: "Intégration webhook inconnue ou désactivée." };
  }

  const adapter = getAdapter("generic-webhook")!;
  const config = JSON.parse(integration.config || "{}") as AdapterConfig;
  const parsed = await adapter.parseWebhook!(config, rawBody, headers);
  if (!parsed.ok) return { ok: false, status: 401, message: parsed.error ?? "Rejeté." };

  // Idempotence par identifiant externe global (si fourni)
  const bodyJson = JSON.parse(rawBody) as { events?: ExternalEvent[]; externalId?: string };
  const globalExternalId = bodyJson.externalId ?? bodyJson.events?.find((e) => e.externalId)?.externalId ?? null;
  if (globalExternalId) {
    const existing = await db.webhookEvent.findUnique({
      where: { integrationId_externalId: { integrationId, externalId: globalExternalId } },
    });
    if (existing) {
      return { ok: true, status: 200, message: "Événement déjà traité (doublon ignoré)." };
    }
    await db.webhookEvent.create({
      data: { integrationId, externalId: globalExternalId, payload: rawBody.slice(0, 10000), status: "PROCESSED" },
    }).catch(() => null);
  }

  const report = await importExternalEvents(integrationId, integration.providerId, parsed.events ?? []);

  if (globalExternalId) {
    await db.webhookEvent.updateMany({
      where: { integrationId, externalId: globalExternalId },
      data: { status: report.failed > 0 ? "ERROR" : "PROCESSED", error: report.errors[0] ?? null },
    }).catch(() => null);
  } else {
    await db.webhookEvent.create({
      data: { integrationId, payload: rawBody.slice(0, 10000), status: report.failed > 0 ? "ERROR" : "PROCESSED", error: report.errors[0] ?? null },
    }).catch(() => null);
  }

  await db.providerIntegration.update({
    where: { id: integrationId },
    data: {
      lastSyncAt: new Date(),
      lastSyncStatus: report.failed > 0 ? "PARTIAL" : "SUCCESS",
      lastSyncMessage: `Webhook : ${report.imported} importé(s), ${report.duplicates} doublon(s), ${report.failed} échec(s)`,
    },
  });

  return {
    ok: report.failed === 0,
    status: 200,
    message: `${report.imported} importé(s), ${report.duplicates} doublon(s)${report.failed ? `, ${report.failed} échec(s)` : ""}`,
  };
}

/** Import manuel CSV — colonnes : trackingNumber,status,occurredAt,location,description */
export async function importCsvContent(content: string, agent: { id: string; name: string }): Promise<ImportReport> {
  const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const events: ExternalEvent[] = [];
  for (const line of lines.slice(1)) { // sauter l'en-tête
    const [trackingNumber, status, occurredAt, location, description] = line.split(/[,;]/).map((c) => c?.trim() ?? "");
    if (!trackingNumber || !status || !occurredAt) continue;
    events.push({ trackingNumber, status, occurredAt, location, description });
  }
  const report = await importExternalEvents("csv-manual", "csv-manual", events);
  const { logAudit } = await import("./audit");
  await logAudit({
    userId: agent.id, userName: agent.name, action: "CSV_IMPORT", entity: "TrackingEvent",
    after: { imported: report.imported, duplicates: report.duplicates, failed: report.failed, errors: report.errors.slice(0, 10) },
  });
  return report;
}
