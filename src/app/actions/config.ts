"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/password";
import { saveSettings } from "@/lib/settings";
import { runSync, importCsvContent, getAdapter } from "@/lib/integrations";
import { FormState, zodFieldErrors, optionalString } from "@/lib/form";

// ---------------------------------------------------------------------------
// Utilisateurs & rôles
// ---------------------------------------------------------------------------

const userSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(160),
  email: z.string().trim().email("E-mail invalide").max(190),
  role: z.enum(["SUPER_ADMIN", "ADMIN", "AGENT_TRANSIT", "WAREHOUSE_MANAGER", "ACCOUNTANT", "SHIPMENT_MANAGER", "DELIVERY_AGENT", "CLIENT"]),
  password: z.string().min(8, "8 caractères minimum").max(200),
});

export async function createUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const admin = await actionUser("users:manage");
    const parsed = userSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;
    if (d.role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") {
      return { error: "Seul un super administrateur peut créer un super administrateur." };
    }
    const email = d.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) return { error: "Cet e-mail est déjà utilisé." };

    const customerId = d.role === "CLIENT" ? optionalString(formData, "customerId") : null;
    if (d.role === "CLIENT" && !customerId) return { error: "Un compte client doit être rattaché à une fiche client." };

    const user = await db.user.create({
      data: {
        name: d.name, email, role: d.role,
        passwordHash: hashPassword(d.password),
        customerId,
        mustChangePassword: true,
      },
      select: { id: true },
    });
    await logAudit({ userId: admin.id, userName: admin.name, action: "CREATE", entity: "User", entityId: user.id, after: { name: d.name, email, role: d.role } });
    revalidatePath("/admin/utilisateurs");
    return { ok: true, message: `Compte ${d.email} créé (changement de mot de passe requis à la première connexion).` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function updateUserAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const admin = await actionUser("users:manage");
    const id = String(formData.get("id") ?? "");
    const target = await db.user.findUnique({ where: { id } });
    if (!target) return { error: "Utilisateur introuvable." };
    const role = String(formData.get("role") ?? target.role);
    const active = formData.get("active") === "on" || formData.get("active") === "true";
    const newPassword = optionalString(formData, "password");
    if (role === "SUPER_ADMIN" && admin.role !== "SUPER_ADMIN") return { error: "Action réservée au super administrateur." };
    if (target.id === admin.id && (!active || role !== admin.role)) {
      return { error: "Vous ne pouvez pas modifier votre propre rôle ou désactiver votre compte." };
    }

    const data: Record<string, unknown> = { role, active };
    if (newPassword) {
      if (newPassword.length < 8) return { error: "Mot de passe : 8 caractères minimum." };
      data.passwordHash = hashPassword(newPassword);
      data.mustChangePassword = true;
    }
    await db.user.update({ where: { id }, data });
    await logAudit({ userId: admin.id, userName: admin.name, action: "UPDATE", entity: "User", entityId: id, before: { role: target.role, active: target.active }, after: { role, active, passwordReset: Boolean(newPassword) } });
    revalidatePath("/admin/utilisateurs");
    return { ok: true, message: "Utilisateur mis à jour." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Paramètres
// ---------------------------------------------------------------------------

const SETTING_KEYS = [
  "brandName", "brandTagline", "brandDescription", "contactPhone", "contactPhone2",
  "contactEmail", "contactAddress", "contactHours", "whatsappNumber",
  "currencies", "defaultCurrency", "trackingPrefix", "trackingPattern",
  "volumetricDivisor", "seaGroupageMinM3", "showPublicTarifs",
  "legalCGV", "legalTransport", "legalPrivacy", "aboutText", "dataRetentionMonths",
];

export async function saveSettingsAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("settings:manage");
    const before: Record<string, string> = {};
    const changes: Record<string, string> = {};
    for (const key of SETTING_KEYS) {
      const v = formData.get(key);
      if (typeof v === "string") {
        changes[key] = v;
      } else if (formData.has(key + "__checkbox")) {
        changes[key] = formData.get(key + "__checkbox") === "true" ? "true" : "false";
      }
    }
    // checkbox non cochée : absent du FormData
    if (formData.has("showPublicTarifs__present")) {
      changes.showPublicTarifs = formData.get("showPublicTarifs") === "on" ? "true" : "false";
    }
    for (const key of Object.keys(changes)) {
      const current = await db.setting.findUnique({ where: { key } });
      if (current) before[key] = current.value;
    }
    await saveSettings(changes);
    await logAudit({ userId: user.id, userName: user.name, action: "SETTINGS_UPDATE", entity: "Setting", before, after: changes });
    revalidatePath("/", "layout");
    return { ok: true, message: "Paramètres enregistrés." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Destinations & partenaires
// ---------------------------------------------------------------------------

export async function createDestinationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("destinations:manage");
    const schema = z.object({
      type: z.enum(["COUNTRY", "CITY", "AIRPORT", "PORT", "WAREHOUSE", "AGENCY"]),
      name: z.string().trim().min(2, "Nom requis").max(160),
    });
    const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const country = optionalString(formData, "country") ?? parsed.data.name;
    try {
      const dest = await db.destination.create({
        data: {
          type: parsed.data.type,
          name: parsed.data.name,
          code: optionalString(formData, "code"),
          country: parsed.data.type === "COUNTRY" ? parsed.data.name : country,
          countryCode: optionalString(formData, "countryCode"),
          notes: optionalString(formData, "notes"),
        },
        select: { id: true },
      });
      await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "Destination", entityId: dest.id, after: parsed.data });
      revalidatePath("/admin/destinations");
      revalidatePath("/destinations");
      return { ok: true, message: "Destination enregistrée." };
    } catch {
      return { error: "Cette destination existe déjà." };
    }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function toggleDestinationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("destinations:manage");
    const id = String(formData.get("id") ?? "");
    const dest = await db.destination.findUnique({ where: { id } });
    if (!dest) return { error: "Destination introuvable." };
    await db.destination.update({ where: { id }, data: { enabled: !dest.enabled } });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "Destination", entityId: id, after: { enabled: !dest.enabled } });
    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    return { ok: true, message: dest.enabled ? "Destination désactivée." : "Destination activée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function deleteDestinationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("destinations:manage");
    const id = String(formData.get("id") ?? "");
    const dest = await db.destination.findUnique({ where: { id } });
    if (!dest) return { error: "Destination introuvable." };
    await db.destination.delete({ where: { id } });
    await logAudit({ userId: user.id, userName: user.name, action: "DELETE", entity: "Destination", entityId: id, before: dest });
    revalidatePath("/admin/destinations");
    revalidatePath("/destinations");
    return { ok: true, message: "Destination supprimée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function createProviderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("destinations:manage");
    const schema = z.object({
      name: z.string().trim().min(2, "Nom requis").max(160),
      type: z.enum(["AIR_CARRIER", "SEA_CARRIER", "COURIER", "FORWARDER", "CUSTOMS_AGENT", "DELIVERY"]),
    });
    const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const provider = await db.transportProvider.create({
      data: {
        name: parsed.data.name,
        type: parsed.data.type,
        country: optionalString(formData, "country"),
        city: optionalString(formData, "city"),
        contactName: optionalString(formData, "contactName"),
        phone: optionalString(formData, "phone"),
        email: optionalString(formData, "email"),
        website: optionalString(formData, "website"),
        services: optionalString(formData, "services"),
        awbPrefix: (optionalString(formData, "awbPrefix") ?? "").replace(/D/g, "") || null,
        notes: optionalString(formData, "notes"),
      },
      select: { id: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "TransportProvider", entityId: provider.id, after: parsed.data });
    revalidatePath("/admin/partenaires");
    return { ok: true, message: "Partenaire enregistré." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function toggleProviderAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("destinations:manage");
    const id = String(formData.get("id") ?? "");
    const provider = await db.transportProvider.findUnique({ where: { id } });
    if (!provider) return { error: "Partenaire introuvable." };
    await db.transportProvider.update({ where: { id }, data: { active: !provider.active } });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "TransportProvider", entityId: id, after: { active: !provider.active } });
    revalidatePath("/admin/partenaires");
    return { ok: true, message: provider.active ? "Partenaire désactivé." : "Partenaire activé." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Intégrations transporteurs
// ---------------------------------------------------------------------------

export async function upsertIntegrationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("integrations:manage");
    const id = optionalString(formData, "id");
    const providerId = String(formData.get("providerId") ?? "");
    const adapterKey = String(formData.get("adapterKey") ?? "");
    const name = optionalString(formData, "name");
    if (!name) return { error: "Nom de l'intégration requis." };
    if (!getAdapter(adapterKey)) return { error: "Adaptateur inconnu." };

    // La config est un JSON libre édité par l'administrateur (jamais de secrets : uniquement des noms de variables d'env)
    let config = "{}";
    const rawConfig = optionalString(formData, "config");
    if (rawConfig) {
      try {
        const parsedConfig = JSON.parse(rawConfig);
        config = JSON.stringify(parsedConfig, null, 2);
      } catch {
        return { error: "Configuration JSON invalide." };
      }
    }
    const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";

    if (id) {
      const integration = await db.providerIntegration.findUnique({ where: { id } });
      if (!integration) return { error: "Intégration introuvable." };
      await db.providerIntegration.update({ where: { id }, data: { name, config, enabled } });
      await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "ProviderIntegration", entityId: id, before: { name: integration.name, config: integration.config, enabled: integration.enabled }, after: { name, config, enabled } });
    } else {
      const created = await db.providerIntegration.create({
        data: { providerId, adapterKey, name, config, enabled },
        select: { id: true },
      });
      await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "ProviderIntegration", entityId: created.id, after: { providerId, adapterKey, name } });
    }
    revalidatePath("/admin/integrations");
    return { ok: true, message: "Intégration enregistrée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function syncIntegrationAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("integrations:manage");
    const id = String(formData.get("id") ?? "");
    const report = await runSync(id, "MANUAL");
    revalidatePath("/admin/integrations");
    return {
      ok: !report.error,
      message: report.error
        ? `Synchronisation échouée : ${report.error} — les événements existants sont conservés.`
        : `Synchronisation terminée : ${report.imported} importé(s), ${report.duplicates} doublon(s) ignoré(s), ${report.failed} échec(s).`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function importCsvAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("integrations:manage");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Aucun fichier CSV sélectionné." };
    const content = await file.text();
    const report = await importCsvContent(content, { id: user.id, name: user.name });
    revalidatePath("/admin");
    return {
      ok: true,
      message: `Import terminé : ${report.imported} importé(s), ${report.duplicates} doublon(s), ${report.failed} échec(s).${report.errors.length ? " Détails : " + report.errors.slice(0, 3).join(" ") : ""}`,
    };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Modèles de notifications
// ---------------------------------------------------------------------------

export async function updateTemplateAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("notifications:manage");
    const id = String(formData.get("id") ?? "");
    const template = await db.notificationTemplate.findUnique({ where: { id } });
    if (!template) return { error: "Modèle introuvable." };
    const subject = String(formData.get("subject") ?? template.subject);
    const body = String(formData.get("body") ?? template.body);
    const enabled = formData.get("enabled") === "on" || formData.get("enabled") === "true";
    await db.notificationTemplate.update({ where: { id }, data: { subject, body, enabled } });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "NotificationTemplate", entityId: id, before: template, after: { subject, body, enabled } });
    revalidatePath("/admin/notifications");
    return { ok: true, message: "Modèle enregistré." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
