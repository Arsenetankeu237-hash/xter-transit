import { Suspense } from "react";
import { connection } from "next/server";
import { db } from "@/lib/db";
import { Card, CardHeader, Badge, inputClass, Field, PageHeader, Alert, Table } from "@/components/ui";
import { ActionForm } from "@/components/action-form";
import { upsertIntegrationAction, syncIntegrationAction, importCsvAction } from "@/app/actions/config";
import { ADAPTERS } from "@/lib/integrations";
import { formatDateTime } from "@/lib/format";

export const metadata = { title: "Intégrations transporteurs" };

export default function IntegrationsPage() {
  return (
    <Suspense fallback={<div className="h-96 animate-pulse rounded-xl bg-slate-100" />}>
      <Content />
    </Suspense>
  );
}

async function Content() {
  await connection(); // page dynamique : données et session à la demande
  const [providers, integrations] = await Promise.all([
    db.transportProvider.findMany({ where: { active: true }, orderBy: { name: "asc" }, select: { id: true, name: true, type: true } }),
    db.providerIntegration.findMany({
      include: {
        provider: { select: { name: true } },
        syncLogs: { orderBy: { startedAt: "desc" }, take: 3 },
      },
    }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Intégrations transporteurs"
        subtitle="Connexion aux APIs officielles et webhooks partenaires. Sans intégration active, la plateforme fonctionne intégralement en suivi manuel."
      />

      <Alert tone="info">
        <strong>Principe de sécurité :</strong> les clés API et secrets ne sont jamais stockés en base — chaque intégration référence une
        variable d'environnement (<code>.env</code>) qui contient la vraie clé. Aucune clé n'est inventée ni pré-remplie.
      </Alert>

      {/* Adaptateurs disponibles */}
      <Card>
        <CardHeader title="Adaptateurs disponibles" />
        <ul className="divide-y divide-slate-50">
          {ADAPTERS.map((a) => (
            <li key={a.key} className="px-5 py-4">
              <p className="text-sm font-bold text-navy-900">{a.label} <span className="ml-2 font-mono text-xs text-slate-400">{a.key}</span></p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{a.description}</p>
              <p className="mt-2 text-xs text-slate-400">
                Paramètres : {a.configFields.map((f) => f.name).join(", ")}
              </p>
            </li>
          ))}
          <li className="px-5 py-4">
            <p className="text-sm font-bold text-navy-900">Import CSV manuel <span className="ml-2 font-mono text-xs text-slate-400">csv-import</span></p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Import ponctuel d'un fichier fourni par un partenaire : colonnes <code>trackingNumber,status,occurredAt,location,description</code> (statuts externes normalisés, doublons ignorés).
            </p>
          </li>
        </ul>
      </Card>

      {/* Intégrations configurées */}
      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <div className="space-y-4">
          {integrations.length === 0 && (
            <Card className="p-6">
              <p className="text-sm text-slate-500">
                Aucune intégration configurée. Créez-en une ci-contre après avoir ajouté le transporteur dans « Partenaires ».
              </p>
            </Card>
          )}
          {integrations.map((i) => (
            <Card key={i.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-navy-900">
                    {i.provider.name} — {i.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Adaptateur : <span className="font-mono">{i.adapterKey}</span> ·{" "}
                    {i.enabled ? <Badge tone="green">activée</Badge> : <Badge tone="red">désactivée</Badge>}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Dernière sync : {formatDateTime(i.lastSyncAt)} · {i.lastSyncStatus ?? "jamais"} {i.lastSyncMessage ? `— ${i.lastSyncMessage}` : ""}
                  </p>
                  {i.adapterKey === "generic-webhook" && i.enabled && (
                    <p className="mt-2 rounded-lg bg-slate-50 px-3 py-2 font-mono text-xs break-all text-slate-600">
                      POST {(process.env.APP_URL ?? "https://votre-domaine") + "/api/webhooks/tracking/" + i.id}
                    </p>
                  )}
                </div>
                {i.adapterKey !== "generic-webhook" && (
                  <ActionForm action={syncIntegrationAction} submitLabel="Synchroniser" buttonClassName="rounded-lg bg-navy-800 px-4 py-2 text-sm font-semibold text-white hover:bg-navy-700">
                    <input type="hidden" name="id" value={i.id} />
                  </ActionForm>
                )}
              </div>

              {i.syncLogs.length > 0 && (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase">Derniers journaux</p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {i.syncLogs.map((l) => (
                      <li key={l.id} className="flex items-center justify-between gap-2 text-slate-500">
                        <span>{formatDateTime(l.startedAt)} · {l.trigger}</span>
                        <span className="flex items-center gap-2">
                          <Badge tone={l.status === "SUCCESS" ? "green" : l.status === "ERROR" ? "red" : "amber"}>{l.status}</Badge>
                          {l.imported > 0 && <span>{l.imported} importés</span>}
                          {l.duplicates > 0 && <span>{l.duplicates} doublons</span>}
                          {l.failed > 0 && <span>{l.failed} échecs</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-accent-600">Modifier la configuration</summary>
                <div className="mt-3">
                  <ActionForm action={upsertIntegrationAction} submitLabel="Enregistrer">
                    <input type="hidden" name="id" value={i.id} />
                    <input type="hidden" name="providerId" value={i.providerId} />
                    <input type="hidden" name="adapterKey" value={i.adapterKey} />
                    <Field label="Nom">
                      <input name="name" defaultValue={i.name} className={inputClass} />
                    </Field>
                    <Field label="Configuration JSON" hint='Ex : {"baseUrl":"https://api.partenaire.com/v1/tracking","apiKeyEnvVar":"PARTENAIRE_API_KEY"} ou {"secretEnvVar":"PARTENAIRE_WEBHOOK_SECRET"} + "statusMapping":{"custom_status":"IN_TRANSIT"}'>
                      <textarea name="config" rows={6} defaultValue={i.config} className={inputClass + " font-mono text-xs"} />
                    </Field>
                    <label className="flex items-center gap-2 text-sm text-slate-600">
                      <input type="checkbox" name="enabled" defaultChecked={i.enabled} className="h-4 w-4" />
                      Intégration activée
                    </label>
                  </ActionForm>
                </div>
              </details>
            </Card>
          ))}
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-sm font-semibold text-navy-900 uppercase">Nouvelle intégration</h2>
            <ActionForm action={upsertIntegrationAction} submitLabel="Créer l'intégration">
              <Field label="Transporteur / partenaire *">
                <select name="providerId" required className={inputClass}>
                  <option value="">— Sélectionner —</option>
                  {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <Field label="Adaptateur *">
                <select name="adapterKey" required className={inputClass}>
                  {ADAPTERS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </Field>
              <Field label="Nom de l'intégration *">
                <input name="name" required className={inputClass} placeholder="Ex : Sync API Atlantic Pacific" />
              </Field>
              <Field label="Configuration JSON" hint="Noms de variables d'environnement uniquement — jamais les secrets eux-mêmes.">
                <textarea name="config" rows={5} defaultValue="{}" className={inputClass + " font-mono text-xs"} />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input type="checkbox" name="enabled" className="h-4 w-4" />
                Activer immédiatement
              </label>
            </ActionForm>
          </Card>

          <Card className="p-6">
            <h2 className="mb-2 text-sm font-semibold text-navy-900 uppercase">Import CSV manuel</h2>
            <p className="mb-4 text-xs text-slate-400">En-tête : trackingNumber,status,occurredAt,location,description (ISO 8601). Les statuts externes sont normalisés ; les événements inconnus sont ignorés et journalisés.</p>
            <ActionForm action={importCsvAction} submitLabel="Importer le fichier">
              <Field label="Fichier CSV *">
                <input type="file" name="file" required accept=".csv" className={inputClass} />
              </Field>
            </ActionForm>
          </Card>

          <Card className="p-6">
            <h2 className="mb-2 text-sm font-semibold text-navy-900 uppercase">Transporteurs connus — prérequis</h2>
            <Table head={["Transporteur", "Prérequis"]}>
              <tr><td className="px-4 py-2 text-sm">DHL Express</td><td className="px-4 py-2 text-xs text-slate-500">Compte développeur DHL (API REST, clé + secret)</td></tr>
              <tr><td className="px-4 py-2 text-sm">FedEx</td><td className="px-4 py-2 text-xs text-slate-500">Clé API FedEx (production après validation)</td></tr>
              <tr><td className="px-4 py-2 text-sm">Maersk</td><td className="px-4 py-2 text-xs text-slate-500">Portail développeur Maersk — clé API track & trace</td></tr>
              <tr><td className="px-4 py-2 text-sm">MSC / CMA CGM</td><td className="px-4 py-2 text-xs text-slate-500">Accès partenaire à obtenir auprès de la compagnie</td></tr>
            </Table>
            <p className="mt-3 text-xs text-slate-400">
              Chacun nécessite un contrat et des identifiants propres fournis par le transporteur. L'adaptateur générique « API REST partenaire » convient dès que le partenaire expose le contrat JSON documenté dans le README.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
