import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, CardHeader, Table, Badge, inputClass, Field, PageHeader } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createUserAction, updateUserAction } from "@/app/actions/config";
import { ROLES } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Utilisateurs & rôles" };

export default function UsersPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { customer: { select: { name: true, code: true } } },
  });
  const customers = await db.customer.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, code: true } });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Utilisateurs & rôles"
        subtitle="Comptes équipe et clients — permissions granulaires, journalisation des actions sensibles"
      />

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <Card>
          <CardHeader title={`Comptes (${users.length})`} />
          <Table head={["Nom", "E-mail", "Rôle", "Client lié", "Dernière connexion", "Statut", ""]}>
            {users.map((u) => (
              <tr key={u.id} className="align-top hover:bg-slate-50">
                <td className="px-4 py-3 text-sm font-medium text-navy-900">
                  {u.name}
                  {u.mustChangePassword && <span className="ml-2"><Badge tone="amber">MDP à changer</Badge></span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{u.email}</td>
                <td className="px-4 py-3 text-xs">{ROLES[u.role as keyof typeof ROLES] ?? u.role}</td>
                <td className="px-4 py-3 text-xs text-slate-500">{u.customer ? `${u.customer.code} — ${u.customer.name}` : "—"}</td>
                <td className="px-4 py-3 text-xs text-slate-400">{u.lastLoginAt ? formatDateTime(u.lastLoginAt) : "jamais"}</td>
                <td className="px-4 py-3">{u.active ? <Badge tone="green">Actif</Badge> : <Badge tone="red">Désactivé</Badge>}</td>
                <td className="px-4 py-3">
                  <details>
                    <summary className="cursor-pointer text-xs font-semibold text-accent-600">Modifier</summary>
                    <div className="mt-3 w-72 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <ActionForm action={updateUserAction} submitLabel="Appliquer">
                        <input type="hidden" name="id" value={u.id} />
                        <Field label="Rôle">
                          <select name="role" defaultValue={u.role} className={inputClass}>
                            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                          </select>
                        </Field>
                        <Field label="Nouveau mot de passe" hint="Laisser vide pour conserver l'actuel.">
                          <input name="password" type="text" className={inputClass} placeholder="(inchangé)" />
                        </Field>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" name="active" defaultChecked={u.active} className="h-4 w-4" />
                          Compte actif
                        </label>
                      </ActionForm>
                    </div>
                  </details>
                </td>
              </tr>
            ))}
          </Table>
        </Card>

        <Card className="h-fit p-6">
          <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Nouveau compte</h2>
          <ActionForm action={createUserAction} submitLabel="Créer le compte">
            <Field label="Nom *">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="E-mail *">
              <input name="email" type="email" required className={inputClass} />
            </Field>
            <Field label="Rôle *">
              <select name="role" required defaultValue="AGENT_TRANSIT" className={inputClass}>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <Field label="Client lié (rôle Client uniquement)">
              <select name="customerId" defaultValue="" className={inputClass}>
                <option value="">—</option>
                {customers.map((c) => <option key={c.id} value={c.id}>{c.code} — {c.name}</option>)}
              </select>
            </Field>
            <Field label="Mot de passe provisoire *" hint="8 caractères minimum — changement forcé à la première connexion.">
              <input name="password" type="text" required minLength={8} className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}
