/**
 * Journal d'audit — toute opération sensible y est consignée.
 * Ne supprime jamais l'historique ; les corrections créent de nouveaux enregistrements.
 */
import { db } from "./db";

export interface AuditEntry {
  userId?: string | null;
  userName?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  before?: unknown;
  after?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        userName: entry.userName ?? null,
        action: entry.action,
        entity: entry.entity,
        entityId: entry.entityId ?? null,
        before: entry.before === undefined ? null : JSON.stringify(entry.before),
        after: entry.after === undefined ? null : JSON.stringify(entry.after),
        ip: entry.ip ?? null,
        userAgent: entry.userAgent ?? null,
      },
    });
  } catch (e) {
    // L'audit ne doit jamais interrompre l'opération métier, mais l'erreur est tracée.
    console.error("[audit] échec d'écriture :", e);
  }
}
