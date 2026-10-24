/**
 * Limitation de débit en mémoire (protection recherche tracking, connexions).
 * Instance unique : suffisant en mono-process ; en production multi-instances,
 * remplacer par un store partagé (Redis) — voir README.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfterSec: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfterSec: 0 };
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfterSec: 0 };
}

// Nettoyage périodique pour éviter la croissance de la map
if (!(globalThis as unknown as { __altRlCleanup?: boolean }).__altRlCleanup) {
  (globalThis as unknown as { __altRlCleanup?: boolean }).__altRlCleanup = true;
  setInterval(() => {
    const now = Date.now();
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }, 60_000).unref();
}
