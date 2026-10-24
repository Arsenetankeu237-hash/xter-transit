import { Suspense } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { Card, PageHeader, Table, EmptyState, inputClass, Field, btnPrimary } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { createCustomerAction } from "@/app/actions/customers";
import { formatDate } from "@/lib/format";
import { CUSTOMER_TYPES } from "@/lib/constants";

export const metadata = { title: "Clients" };

export default function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams;
  return (
    <div>
      <PageHeader title="Clients" subtitle="Répertoire des clients, particuliers et entreprises" />
      <form method="get" className="mb-6 flex gap-2">
        <input name="q" defaultValue={q ?? ""} placeholder="Rechercher par nom, code, téléphone ou e-mail…" className={inputClass + " max-w-md"} />
        <button className={btnPrimary}>Rechercher</button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
        <ClientList q={q} />

        <Card className="h-fit p-6">
          <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Nouveau client</h2>
          <ActionForm action={createCustomerAction} submitLabel="Créer le client">
            <Field label="Nom / Raison sociale *">
              <input name="name" required className={inputClass} />
            </Field>
            <Field label="Type *">
              <select name="type" className={inputClass} defaultValue="INDIVIDUAL">
                {Object.entries(CUSTOMER_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Téléphone">
                <input name="phone" className={inputClass} />
              </Field>
              <Field label="E-mail">
                <input name="email" type="email" className={inputClass} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Pays">
                <input name="country" className={inputClass} />
              </Field>
              <Field label="Ville">
                <input name="city" className={inputClass} />
              </Field>
            </div>
            <Field label="Adresse">
              <input name="addressLine" className={inputClass} />
            </Field>
          </ActionForm>
        </Card>
      </div>
    </div>
  );
}

async function ClientList({ q }: { q?: string }) {
  const where = q?.trim()
    ? {
        OR: [
          { name: { contains: q.trim() } },
          { code: { contains: q.trim() } },
          { phone: { contains: q.trim() } },
          { email: { contains: q.trim() } },
        ],
      }
    : {};
  const customers = await db.customer.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { packages: true, invoices: true } } },
  });

  if (customers.length === 0) {
    return <EmptyState title="Aucun client" hint={q ? "Aucun résultat pour cette recherche." : "Créez votre premier client avec le formulaire ci-contre."} />;
  }

  return (
    <Card>
      <Table head={["Code", "Nom", "Type", "Contact", "Colis", "Client depuis", ""]}>
        {customers.map((c) => (
          <tr key={c.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-mono text-xs font-semibold text-navy-800">{c.code}</td>
            <td className="px-4 py-3">
              <Link href={`/admin/clients/${c.id}`} className="font-medium text-navy-900 hover:text-accent-600">{c.name}</Link>
              {!c.active && <span className="ml-2 text-xs text-red-500">(inactif)</span>}
            </td>
            <td className="px-4 py-3 text-sm text-slate-500">{CUSTOMER_TYPES[c.type as keyof typeof CUSTOMER_TYPES]}</td>
            <td className="px-4 py-3 text-xs text-slate-500">
              {c.phone && <div>{c.phone}</div>}
              {c.email && <div>{c.email}</div>}
            </td>
            <td className="px-4 py-3 text-sm font-semibold text-navy-800">{c._count.packages}</td>
            <td className="px-4 py-3 text-xs text-slate-400">{formatDate(c.createdAt)}</td>
            <td className="px-4 py-3 text-right">
              <Link href={`/admin/clients/${c.id}`} className="text-xs font-semibold text-accent-600">Ouvrir</Link>
            </td>
          </tr>
        ))}
      </Table>
    </Card>
  );
}
