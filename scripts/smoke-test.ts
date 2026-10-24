/**
 * Test de fumée métier de bout en bout (critères de validation du cahier des charges §24).
 * Crée des données de test, vérifie chaque parcours, puis purge ces données.
 * Usage : npx tsx scripts/smoke-test.ts
 */
import { PrismaClient } from "../src/generated/prisma/client";
import path from "node:path";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { createHash, createHmac, randomBytes } from "node:crypto";
import { hashPassword } from "../src/lib/password";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const file = url.startsWith("file:") ? path.resolve(process.cwd(), url.slice("file:".length)) : url;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:" + file }) });

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, extra?: string) {
  if (cond) { pass++; console.log("  ✓ " + label); }
  else { fail++; console.log("  ✗ " + label + (extra ? " — " + extra : "")); }
}

async function main() {
  // Services (imports dynamiques à l'intérieur de main)
  const { addTrackingEvent, publicTrack, packageTimeline } = await import("../src/lib/tracking");
  const { addShipmentEvent, attachPackage } = await import("../src/lib/shipments");
  const { processWebhook } = await import("../src/lib/integrations");
  const { computeQuote } = await import("../src/lib/quotes");
  const { recordPayment } = await import("../src/lib/invoices");
  const { can } = await import("../src/lib/constants");
  console.log("— Parcours 1-3 : client + colis + numéro de suivi unique");
  const customer = await prisma.customer.create({
    data: { code: "CLI-TEST-1", name: "Client Test Fumée", type: "INDIVIDUAL", email: "test@example.com", phone: "+237600000000", country: "Cameroun", city: "Douala" },
  });
  const agent = await prisma.user.create({
    data: { email: "smoke-agent@test.local", name: "Agent Test", passwordHash: hashPassword("x"), role: "AGENT_TRANSIT", active: true },
  });
  const sender = await prisma.address.create({
    data: { customerId: customer.id, label: "Expéditeur", contactName: "Expéditeur Test", country: "France", city: "Paris", line1: "1 rue de Test" },
  });
  const recipient = await prisma.address.create({
    data: { customerId: customer.id, label: "Destinataire", contactName: "Destinataire Test", country: "Cameroun", city: "Douala", line1: "Akwa" },
  });
  const pkg = await prisma.package.create({
    data: {
      trackingNumber: "XTER-2026-900001", customerId: customer.id, mode: "AIR",
      status: "REQUEST_RECEIVED", weightKg: 12, lengthCm: 60, widthCm: 40, heightCm: 40,
      volumetricWeightKg: 16, taxableWeightKg: 16, senderAddressId: sender.id, recipientAddressId: recipient.id,
    },
  });
  check("Colis créé avec numéro XTER-2026-900001", pkg.trackingNumber === "XTER-2026-900001");
  const dup = await prisma.package.create({ data: { trackingNumber: "XTER-2026-900001", customerId: customer.id, mode: "AIR" } }).then(() => false).catch(() => true);
  check("Doublon de numéro de suivi rejeté par la base", dup);
  await prisma.package.deleteMany({ where: { trackingNumber: "XTER-2026-900001", id: { not: pkg.id } } });

  console.log("— Parcours 4-6 : suivi public et mises à jour agent");
  const ev1 = await addTrackingEvent({ packageId: pkg.id, status: "RECEIVED_WAREHOUSE", occurredAt: new Date(), location: "Entrepôt Douala", description: "Colis réceptionné", source: "MANUAL", agentId: agent.id });
  const ev2 = await addTrackingEvent({ packageId: pkg.id, status: "SHIPPED", occurredAt: new Date(), location: "Aéroport DLA", description: "Départ vol AF982", source: "MANUAL", agentId: agent.id });
  check("Événements manuels enregistrés", ev1.ok && ev2.ok);
  const track = await publicTrack("XTER-2026-900001");
  check("Suivi public : statut = Expédié", track?.status === "SHIPPED");
  check("Suivi public : timeline contient les 2 événements ajoutés", track?.timeline.length === 2, `len=${track?.timeline.length}`);
  check("Suivi public : aucune donnée personnelle exposée", JSON.stringify(track).indexOf("Destinataire Test") === -1 && JSON.stringify(track).indexOf("+237600000000") === -1);
  const notif = await prisma.notification.findFirst({ where: { eventKey: "package_shipped", relatedPackageId: pkg.id } });
  check("Notification IN_APP/e-mail journalisée pour l'expédition", !!notif);

  console.log("— Parcours 7-8 : expédition maritime groupage multi-clients");
  const customer2 = await prisma.customer.create({ data: { code: "CLI-TEST-2", name: "Client Test 2", type: "COMPANY" } });
  const pkg2 = await prisma.package.create({ data: { trackingNumber: "XTER-2026-900002", customerId: customer2.id, mode: "SEA", status: "REQUEST_RECEIVED" } });
  const provider = await prisma.transportProvider.create({ data: { name: "Compagnie Test", type: "SEA_CARRIER" } });
  const shipment = await prisma.shipment.create({
    data: { reference: "EXP-M-2026-900001", type: "SEA", status: "PLANNED", groupage: true, providerId: provider.id, originCountry: "Chine", originCity: "Ningbo", destCountry: "Cameroun", destCity: "Douala", containerNumber: "TEST1234567" },
  });
  await attachPackage(shipment.id, pkg.id, { id: agent.id, name: agent.name });
  await attachPackage(shipment.id, pkg2.id, { id: agent.id, name: agent.name });
  const shipEvent = await addShipmentEvent({ shipmentId: shipment.id, status: "DEPARTED", occurredAt: new Date(), description: "Départ du navire", agent: { id: agent.id, name: agent.name }, applyToPackages: true });
  check("Événement d'expédition propagé aux 2 colis du groupage", shipEvent.ok && shipEvent.updatedPackages === 2);
  const track2 = await publicTrack("XTER-2026-900002");
  check("Client 2 suit son colis dans le groupage (VESSEL_DEPARTED)", track2?.status === "VESSEL_DEPARTED");
  const timeline1 = await packageTimeline(pkg.id);
  check("Historique individuel conservé + événements d'expédition fusionnés", timeline1.some((e) => e.scope === "shipment") && timeline1.length >= 4, `len=${timeline1.length}`);

  console.log("— Parcours 9-10 : intégration transporteur (webhook) et anti-doublons");
  const secret = randomBytes(16).toString("hex");
  process.env["TEST_WEBHOOK_SECRET"] = secret;
  const integration = await prisma.providerIntegration.create({
    data: { providerId: provider.id, adapterKey: "generic-webhook", name: "Webhook Test", enabled: true, config: JSON.stringify({ secretEnvVar: "TEST_WEBHOOK_SECRET" }) },
  });
  const body = JSON.stringify({ externalId: "evt-test-1", events: [{ trackingNumber: "XTER-2026-900001", status: "in transit", occurredAt: new Date().toISOString(), location: "Istanbul", description: "Transit via hub", externalId: "evt-test-1" }] });
  const sig = "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
  const headersOk = new Headers({ "x-signature": sig });
  const headersBad = new Headers({ "x-signature": "sha256=deadbeef" });
  const rejected = await processWebhook(integration.id, body, headersBad);
  check("Webhook avec signature invalide rejeté (401)", !rejected.ok && rejected.status === 401);
  const accepted = await processWebhook(integration.id, body, headersOk);
  check("Webhook authentifié : événement importé et normalisé (in transit → IN_TRANSIT)", accepted.ok);
  const trackAfterApi = await publicTrack("XTER-2026-900001");
  check("Statut du colis mis à jour par l'événement transporteur", trackAfterApi?.status === "IN_TRANSIT");
  const replay = await processWebhook(integration.id, body, headersOk);
  check("Rejeu du webhook : doublon ignoré (aucun double événement)", replay.ok);
  const apiEvents = await prisma.trackingEvent.count({ where: { packageId: pkg.id, source: "API", externalRef: "evt-test-1" } });
  check("Exactement 1 événement importé (anti-doublon par empreinte)", apiEvents === 1);

  console.log("— Parcours 11 : devis, facture et reçu");
  await prisma.rateTable.create({
    data: {
      name: "Test Aérien FR→CM", mode: "AIR", currency: "XAF", destCountry: "Cameroun", active: true,
      lines: {
        create: [
          { basis: "PER_KG", label: "Fret aérien", unitPrice: 3500 },
          { basis: "FEE_DOSSIER", label: "Frais de dossier", fixedAmount: 10000 },
        ],
      },
    },
  });
  const quote = await computeQuote({ mode: "AIR", originCountry: "France", destCountry: "Cameroun", weightKg: 12, lengthCm: 60, widthCm: 40, heightCm: 40 }, { volumetricDivisor: 6000, seaGroupageMinM3: 1 });
  check("Devis aérien calculé : 16 kg taxable × 3500 + dossier = 66 000 FCFA", quote.total === 66000, `total=${quote.total}`);
  const quoteRow = await prisma.quote.create({ data: { number: "DEV-TEST-1", customerId: customer.id, mode: "AIR", status: "ACCEPTED", lines: JSON.stringify(quote.lines), currency: "XAF", total: quote.total, subtotal: quote.total } });
  const invoice = await prisma.invoice.create({ data: { number: "FAC-TEST-1", customerId: customer.id, quoteId: quoteRow.id, status: "ISSUED", currency: "XAF", lines: JSON.stringify(quote.lines), subtotal: quote.total, total: quote.total, issuedAt: new Date() } });
  const payment1 = await recordPayment({ invoiceId: invoice.id, method: "MOBILE_MONEY", amount: 30000, currency: "XAF", manualConfirm: true, agent: { id: agent.id, name: agent.name } });
  const invAfter1 = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  check("Paiement partiel → facture PARTIAL", payment1.ok && invAfter1.status === "PARTIAL");
  const payment2 = await recordPayment({ invoiceId: invoice.id, method: "CASH", amount: 36000, currency: "XAF", manualConfirm: true, agent: { id: agent.id, name: agent.name } });
  const invAfter2 = await prisma.invoice.findUniqueOrThrow({ where: { id: invoice.id } });
  check("Solde réglé → facture PAID", payment2.ok && invAfter2.status === "PAID");
  const over = await recordPayment({ invoiceId: invoice.id, method: "CASH", amount: 5000, currency: "XAF", manualConfirm: true, agent: { id: agent.id, name: agent.name } });
  check("Paiement supérieur au solde refusé", !over.ok);
  const paymentNotif = await prisma.notification.findFirst({ where: { eventKey: "payment_received" } });
  check("Notification de paiement reçue émise", !!paymentNotif);

  console.log("— Parcours 12 : rôles et permissions");
  check("Agent de transit : peut gérer colis, pas la finance", can("AGENT_TRANSIT", "packages:manage") && !can("AGENT_TRANSIT", "finance:manage"));
  check("Comptable : finance oui, utilisateurs non", can("ACCOUNTANT", "finance:manage") && !can("ACCOUNTANT", "users:manage"));
  check("Client : aucune permission staff", !can("CLIENT", "packages:manage") && !can("CLIENT", "finance:manage"));

  console.log("— Parcours 14 : livraison avec preuve");
  const delivery = await prisma.delivery.create({ data: { packageId: pkg2.id, agentId: agent.id, status: "ASSIGNED" } });
  await prisma.delivery.update({
    where: { id: delivery.id },
    data: { status: "DELIVERED", attempts: 1, lastAttemptAt: new Date(), deliveredAt: new Date(), recipientName: "M. Test", confirmedById: agent.id },
  });
  await addTrackingEvent({ packageId: pkg2.id, status: "DELIVERED", occurredAt: new Date(), location: "Douala", description: "Livré à M. Test", source: "MANUAL", agentId: agent.id });
  const trackDelivered = await publicTrack("XTER-2026-900002");
  check("Livraison confirmée → statut Livré au suivi public", trackDelivered?.status === "DELIVERED");
  const delivNotif = await prisma.notification.findFirst({ where: { eventKey: "package_delivered", relatedPackageId: pkg2.id } });
  check("Notification de livraison émise (événement réel uniquement)", !!delivNotif);

  console.log("— Journal d'audit");
  const audits = await prisma.auditLog.count({ where: { entity: { in: ["Package", "Shipment", "Invoice", "Payment"] } } });
  check("Opérations sensibles tracées dans l'audit", audits > 0, `count=${audits}`);

  console.log("— Nettoyage des données de test");
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { OR: [{ relatedPackageId: { in: [pkg.id, pkg2.id] } }, { subject: { contains: "test" } }] } }),
    prisma.trackingEvent.deleteMany({ where: { OR: [{ packageId: { in: [pkg.id, pkg2.id] } }, { shipmentId: shipment.id }] } }),
    prisma.delivery.deleteMany({ where: { packageId: { in: [pkg.id, pkg2.id] } } }),
    prisma.payment.deleteMany({ where: { invoice: { number: "FAC-TEST-1" } } }),
    prisma.invoice.deleteMany({ where: { number: "FAC-TEST-1" } }),
    prisma.quote.deleteMany({ where: { number: "DEV-TEST-1" } }),
    prisma.package.deleteMany({ where: { trackingNumber: { in: ["XTER-2026-900001", "XTER-2026-900002"] } } }),
    prisma.webhookEvent.deleteMany({ where: { integrationId: integration.id } }),
    prisma.trackingSyncLog.deleteMany({ where: { integrationId: integration.id } }),
    prisma.providerIntegration.deleteMany({ where: { id: integration.id } }),
    prisma.shipment.deleteMany({ where: { id: shipment.id } }),
    prisma.transportProvider.deleteMany({ where: { id: provider.id } }),
    prisma.rateTable.deleteMany({ where: { name: "Test Aérien FR→CM" } }),
    prisma.address.deleteMany({ where: { customerId: { in: [customer.id, customer2.id] } } }),
    prisma.customer.deleteMany({ where: { id: { in: [customer.id, customer2.id] } } }),
    prisma.user.deleteMany({ where: { email: "smoke-agent@test.local" } }),
  ]);
  const leftovers = await prisma.package.count({ where: { trackingNumber: { startsWith: "XTER-2026-9" } } });
  check("Données de test purgées (base propre pour l'usage réel)", leftovers === 0);

  console.log(`\nRésultat : ${pass} ✓ / ${fail} ✗`);
  await prisma.$disconnect();
  process.exit(fail > 0 ? 1 : 0);
}

main().catch(async (e) => {
  console.error("ÉCHEC DU TEST :", e);
  await prisma.$disconnect();
  process.exit(1);
});
