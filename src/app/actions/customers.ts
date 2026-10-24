"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { actionUser } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { db } from "@/lib/db";
import { nextCustomerCode } from "@/lib/numbering";
import { hashPassword } from "@/lib/password";
import { FormState, zodFieldErrors, optionalString } from "@/lib/form";

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------

const customerSchema = z.object({
  name: z.string().trim().min(2, "Nom requis").max(160),
  type: z.enum(["INDIVIDUAL", "COMPANY"]),
  email: z.string().trim().email("E-mail invalide").max(190).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  phone2: z.string().trim().max(40).optional().or(z.literal("")),
  country: z.string().trim().max(80).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  addressLine: z.string().trim().max(240).optional().or(z.literal("")),
  taxId: z.string().trim().max(60).optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().or(z.literal("")),
});

export async function createCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("customers:manage");
    const parsed = customerSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;

    const code = await nextCustomerCode(db);
    const customer = await db.customer.create({
      data: {
        code, name: d.name, type: d.type,
        email: d.email || null, phone: d.phone || null, phone2: d.phone2 || null,
        country: d.country || null, city: d.city || null, addressLine: d.addressLine || null,
        taxId: d.taxId || null, notes: d.notes || null,
      },
      select: { id: true, code: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "Customer", entityId: customer.id, after: d });
    revalidatePath("/admin/clients");
    return { ok: true, message: `Client ${customer.code} créé.`, redirectTo: `/admin/clients/${customer.id}` };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function updateCustomerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("customers:manage");
    const id = String(formData.get("id") ?? "");
    const parsed = customerSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;
    const active = formData.get("active") === "on" || formData.get("active") === "true";

    const before = await db.customer.findUnique({ where: { id } });
    if (!before) return { error: "Client introuvable." };

    await db.customer.update({
      where: { id },
      data: {
        name: d.name, type: d.type, active,
        email: d.email || null, phone: d.phone || null, phone2: d.phone2 || null,
        country: d.country || null, city: d.city || null, addressLine: d.addressLine || null,
        taxId: d.taxId || null, notes: d.notes || null,
      },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "Customer", entityId: id, before, after: { ...d, active } });
    revalidatePath(`/admin/clients/${id}`);
    return { ok: true, message: "Client mis à jour." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Adresses (expéditeurs / destinataires)
// ---------------------------------------------------------------------------

const addressSchema = z.object({
  customerId: z.string().min(1),
  label: z.string().trim().min(2, "Libellé requis").max(120),
  contactName: z.string().trim().min(2, "Nom du contact requis").max(160),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  email: z.string().trim().email("E-mail invalide").max(190).optional().or(z.literal("")),
  country: z.string().trim().min(2, "Pays requis").max(80),
  countryCode: z.string().trim().max(2).optional().or(z.literal("")),
  city: z.string().trim().min(2, "Ville requise").max(80),
  line1: z.string().trim().min(2, "Adresse requise").max(240),
  line2: z.string().trim().max(240).optional().or(z.literal("")),
});

export async function createAddressAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("customers:manage");
    const parsed = addressSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;
    const addr = await db.address.create({
      data: {
        customerId: d.customerId, label: d.label, contactName: d.contactName,
        phone: d.phone || null, email: d.email || null,
        country: d.country, countryCode: d.countryCode || null,
        city: d.city, line1: d.line1, line2: d.line2 || null,
      },
      select: { id: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "Address", entityId: addr.id, after: d });
    revalidatePath(`/admin/clients/${d.customerId}`);
    return { ok: true, message: "Adresse enregistrée." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

// ---------------------------------------------------------------------------
// Compte portail client
// ---------------------------------------------------------------------------

const portalSchema = z.object({
  customerId: z.string().min(1),
  name: z.string().trim().min(2, "Nom requis").max(160),
  email: z.string().trim().email("E-mail invalide").max(190),
  password: z.string().min(8, "8 caractères minimum").max(200),
});

export async function createPortalAccountAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("customers:manage");
    const parsed = portalSchema.safeParse(Object.fromEntries(formData.entries()));
    if (!parsed.success) return { error: "Champs invalides.", fieldErrors: zodFieldErrors(parsed.error) };
    const d = parsed.data;

    const existing = await db.user.findUnique({ where: { email: d.email.toLowerCase() } });
    if (existing) return { error: "Cet e-mail est déjà utilisé par un autre compte." };

    const portalUser = await db.user.create({
      data: {
        email: d.email.toLowerCase(),
        name: d.name,
        passwordHash: hashPassword(d.password),
        role: "CLIENT",
        customerId: d.customerId,
        mustChangePassword: true,
      },
      select: { id: true },
    });
    await logAudit({ userId: user.id, userName: user.name, action: "CREATE", entity: "User", entityId: portalUser.id, after: { email: d.email, role: "CLIENT", customerId: d.customerId } });
    revalidatePath(`/admin/clients/${d.customerId}`);
    return { ok: true, message: "Compte client créé — l'utilisateur devra changer son mot de passe à la première connexion." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}

export async function updateCustomerNotesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await actionUser("customers:manage");
    const id = String(formData.get("customerId") ?? "");
    const notes = optionalString(formData, "notes");
    const before = await db.customer.findUnique({ where: { id }, select: { notes: true } });
    await db.customer.update({ where: { id }, data: { notes } });
    await logAudit({ userId: user.id, userName: user.name, action: "UPDATE", entity: "Customer", entityId: id, before, after: { notes } });
    revalidatePath(`/admin/clients/${id}`);
    return { ok: true, message: "Notes enregistrées." };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Erreur inattendue." };
  }
}
