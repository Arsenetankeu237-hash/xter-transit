/**
 * Authentification : sessions persistées en base (jeton aléatoire, hash stocké),
 * cookie HttpOnly, garde des rôles/permissions.
 */
import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";
import { verifyPassword } from "./password";
import { can, type Permission, type Role } from "./constants";
import { logAudit } from "./audit";
import { rateLimit } from "./rate-limit";

export const SESSION_COOKIE = "xter_session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 h

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  customerId: string | null;
  mustChangePassword: boolean;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function requestMeta(): Promise<{ ip?: string; userAgent?: string }> {
  try {
    const h = await headers();
    return {
      ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined,
      userAgent: h.get("user-agent") ?? undefined,
    };
  } catch {
    return {};
  }
}

/** Utilisateur de la session courante (mémoïsé par requête). */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date() || !session.user.active) return null;
  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role as Role,
    customerId: session.user.customerId,
    mustChangePassword: session.user.mustChangePassword,
  };
});

/** Exige une session valide (redirige vers /connexion sinon). */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/connexion");
  return user;
}

/** Exige un membre du personnel (tout rôle sauf CLIENT). */
export async function requireStaff(): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "CLIENT") redirect("/espace-client");
  return user;
}

/** Exige une permission précise ; sinon 403 via redirection. */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const user = await requireUser();
  if (user.role === "CLIENT") redirect("/espace-client");
  if (!can(user.role, permission)) redirect("/admin/acces-refuse?perm=" + encodeURIComponent(permission));
  return user;
}

/** Pour les server actions : renvoie une erreur au lieu de rediriger. */
export async function actionUser(permission?: Permission): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new Error("Session expirée. Reconnectez-vous.");
  if (user.role === "CLIENT") throw new Error("Accès refusé.");
  if (permission && !can(user.role, permission)) throw new Error("Accès refusé : permission manquante (" + permission + ").");
  return user;
}

// ---------------------------------------------------------------------------
// Connexion / déconnexion
// ---------------------------------------------------------------------------

export async function login(email: string, password: string): Promise<{ ok: boolean; error?: string }> {
  const meta = await requestMeta();
  const normalized = email.trim().toLowerCase();

  const rl = rateLimit(`login:${meta.ip ?? normalized}`, 8, 5 * 60_000);
  if (!rl.ok) return { ok: false, error: `Trop de tentatives. Réessayez dans ${rl.retryAfterSec} s.` };

  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user || !user.active || !verifyPassword(password, user.passwordHash)) {
    await logAudit({
      action: "LOGIN_FAILED",
      entity: "User",
      entityId: user?.id ?? null,
      after: { email: normalized },
      ...meta,
    });
    return { ok: false, error: "Identifiants incorrects." };
  }

  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: {
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      ip: meta.ip ?? null,
      userAgent: meta.userAgent ?? null,
    },
  });
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });

  await logAudit({ userId: user.id, userName: user.name, action: "LOGIN", entity: "User", entityId: user.id, ...meta });
  return { ok: true };
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.session.deleteMany({ where: { tokenHash: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

export async function changePassword(userId: string, current: string, next: string): Promise<{ ok: boolean; error?: string }> {
  const user = await db.user.findUnique({ where: { id: userId } });
  if (!user) return { ok: false, error: "Utilisateur introuvable." };
  if (!verifyPassword(current, user.passwordHash)) return { ok: false, error: "Mot de passe actuel incorrect." };
  if (next.length < 8) return { ok: false, error: "Le nouveau mot de passe doit contenir au moins 8 caractères." };
  const { hashPassword } = await import("./password");
  await db.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(next), mustChangePassword: false },
  });
  await db.session.deleteMany({ where: { userId } }); // invalide les autres sessions
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  await logAudit({ userId, userName: user.name, action: "PASSWORD_CHANGED", entity: "User", entityId: userId });
  return { ok: true };
}
