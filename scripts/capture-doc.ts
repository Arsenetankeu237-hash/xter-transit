/**
 * Captures d'écran documentaires du site XTER Transit — en 3 phases :
 *
 *   1. npx tsx scripts/capture-doc.ts setup     (SERVEUR ARRÊTÉ) crée les données démo
 *   2. npx tsx scripts/capture-doc.ts capture   (SERVEUR DÉMARRÉ) capture les pages
 *   3. npx tsx scripts/capture-doc.ts teardown  (SERVEUR ARRÊTÉ) purge les données démo
 *
 * Les données de démo sont marquées « DÉMO » et épinglées dans docs/captures/.ids.json.
 * Raison du serveur arrêté en phases 1 et 3 : SQLite/WAL n'accepte pas deux rédacteurs
 * concurrents (serveur + script) — les écritures externes seraient perdues au reset du WAL.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import path from "node:path";
import fs from "node:fs";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { chromium } from "playwright-core";
import { hashPassword } from "../src/lib/password";

const BASE = process.env.APP_URL ?? "http://localhost:3000";
const OUT = path.join(process.cwd(), "docs", "captures");
const IDS_FILE = path.join(OUT, ".ids.json");
const EDGE = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";

const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
const file = url.startsWith("file:") ? path.resolve(process.cwd(), url.slice("file:".length)) : url;
const prisma = new PrismaClient({ adapter: new PrismaBetterSqlite3({ url: "file:" + file }) });

async function setup() {
  fs.mkdirSync(OUT, { recursive: true });
  console.log("— Création des données de démonstration (serveur arrêté)");
  const { addTrackingEvent } = await import("../src/lib/tracking");
  const { addShipmentEvent, attachPackage } = await import("../src/lib/shipments");

  const customer = await prisma.customer.create({
    data: { code: "CLI-DEMO-1", name: "Client Démo — Documentation", type: "COMPANY", email: "demo@exemple.com", phone: "+237 6 99 00 00 00", country: "Cameroun", city: "Douala" },
  });
  const agent = await prisma.user.create({
    data: { email: "demo-agent@capture.local", name: "Agent Démo", passwordHash: hashPassword("x"), role: "AGENT_TRANSIT" },
  });
  const pkg1 = await prisma.package.create({
    data: { trackingNumber: "XTER-2026-000901", customerId: customer.id, mode: "AIR", status: "REQUEST_RECEIVED", reference: "CMD-1042", weightKg: 12.5, pieces: 2, contentDescription: "Cartons de pièces détachées" },
  });
  const pkg2 = await prisma.package.create({
    data: { trackingNumber: "XTER-2026-000902", customerId: customer.id, mode: "SEA", status: "REQUEST_RECEIVED", weightKg: 210, contentDescription: "Palettes de matériel électronique" },
  });
  for (const [status, when, where, what] of [
    ["REQUEST_RECEIVED", -6, "Plateforme", "Colis enregistré dans le système."],
    ["RECEIVED_WAREHOUSE", -5, "Entrepôt Douala", "Colis réceptionné à l'entrepôt."],
    ["CONTROLLED_WEIGHED", -5, "Entrepôt Douala", "Contrôle et pesée : 12,5 kg."],
    ["SHIPPED", -3, "Aéroport de Douala (DLA)", "Départ vol AF983 vers Paris."],
    ["IN_TRANSIT", -2, "Aéroport Paris-CDG", "En correspondance vers la destination finale."],
  ] as const) {
    await addTrackingEvent({
      packageId: pkg1.id, status, occurredAt: new Date(Date.now() + when * 24 * 3600 * 1000),
      location: where, description: what, source: "MANUAL", agentId: agent.id,
    });
  }
  const airCarrier = await prisma.transportProvider.findFirst({ where: { name: "Air France" } });
  const airShipment = await prisma.shipment.create({
    data: {
      reference: "EXP-A-2026-000901", type: "AIR", status: "IN_TRANSIT", groupage: false,
      originCountry: "Cameroun", originCity: "Douala", originCode: "DLA",
      destCountry: "France", destCity: "Paris", destCode: "CDG",
      providerId: airCarrier?.id, flightNumber: "AF983",
      plannedDepartureAt: new Date(Date.now() - 3 * 24 * 3600 * 1000),
      etaAt: new Date(Date.now() + 2 * 24 * 3600 * 1000),
      notes: "Expédition DÉMO (documentation) — supprimée après capture.",
    },
  });
  await attachPackage(airShipment.id, pkg1.id, { id: agent.id, name: agent.name });
  const seaCarrier = await prisma.transportProvider.create({
    data: { name: "CMA CGM (DÉMO)", type: "SEA_CARRIER", country: "France" },
  });
  const seaShipment = await prisma.shipment.create({
    data: {
      reference: "EXP-M-2026-000901", type: "SEA", status: "DEPARTED", groupage: true,
      originCountry: "Chine", originCity: "Ningbo", originCode: "CNNGO",
      destCountry: "Cameroun", destCity: "Douala", destCode: "CMDLA",
      providerId: seaCarrier.id, vesselName: "MV Démo", voyageNumber: "042W",
      containerNumber: "CMAU1234567", containerType: "40'HC",
      notes: "Groupage DÉMO (documentation).",
    },
  });
  await attachPackage(seaShipment.id, pkg2.id, { id: agent.id, name: agent.name });
  await addShipmentEvent({
    shipmentId: seaShipment.id, status: "DEPARTED", occurredAt: new Date(Date.now() - 4 * 24 * 3600 * 1000),
    location: "Port de Ningbo", description: "Départ du navire", agent: { id: agent.id, name: agent.name }, applyToPackages: true,
  });
  const invoice = await prisma.invoice.create({
    data: {
      number: "FAC-2026-000901", customerId: customer.id, status: "PARTIAL", currency: "XAF",
      lines: JSON.stringify([
        { label: "Fret aérien — 13 kg taxable × 3 500", qty: 1, unitPrice: 45500, amount: 45500 },
        { label: "Frais de dossier", qty: 1, unitPrice: 10000, amount: 10000 },
        { label: "Manutention entrepôt", qty: 1, unitPrice: 5000, amount: 5000 },
      ]),
      subtotal: 60500, total: 60500, issuedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000),
      dueAt: new Date(Date.now() + 13 * 24 * 3600 * 1000),
    },
  });
  await prisma.payment.create({
    data: { invoiceId: invoice.id, method: "MOBILE_MONEY", amount: 30000, currency: "XAF", status: "CONFIRMED", receivedAt: new Date(Date.now() - 24 * 3600 * 1000), reference: "OM-88213" },
  });

  fs.writeFileSync(IDS_FILE, JSON.stringify({ customer: customer.id, agent: agent.id, pkg1: pkg1.id, pkg2: pkg2.id, airShipment: airShipment.id, seaShipment: seaShipment.id, seaCarrier: seaCarrier.id, invoice: invoice.id }, null, 1));
  console.log("✓ Données démo créées (IDs dans docs/captures/.ids.json)");
}

async function capture() {
  const ids = JSON.parse(fs.readFileSync(IDS_FILE, "utf8"));
  console.log("— Navigateur headless (Edge)");
  const browser = await chromium.launch({ executablePath: EDGE, headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });

  async function shot(name: string, urlPath: string, opts: { fullPage?: boolean } = {}) {
    await page.goto(BASE + urlPath, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(OUT, name), fullPage: opts.fullPage ?? true });
    console.log("  ✓", name);
  }

  console.log("— Site public");
  await shot("01-accueil.png", "/");
  await shot("03-suivi-resultat.png", "/suivi?numero=XTER-2026-000901");
  await shot("04-devis.png", "/devis");
  await shot("05-contact.png", "/contact");
  await shot("06-destinations.png", "/destinations");

  console.log("— Connexion admin");
  await page.goto(BASE + "/connexion", { waitUntil: "domcontentloaded" });
  await page.fill('input[name="email"]', process.env.ADMIN_EMAIL ?? "admin@xter-transit.local");
  await page.fill('input[name="password"]', process.env.ADMIN_PASSWORD ?? "Admin@2026!");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/admin", { timeout: 15000 });
  await page.waitForTimeout(2000);

  console.log("— Console admin");
  await shot("07-tableau-de-bord.png", "/admin");
  await shot("08-colis-detail.png", `/admin/colis/${ids.pkg1}`);
  await shot("09-etiquette-qr.png", `/admin/colis/${ids.pkg1}/etiquette`);
  await shot("10-expedition-aerienne.png", `/admin/expeditions/${ids.airShipment}`);

  // Assistant AWB : démonstration du calcul de clé (préfixe 057 + série 12345675 → clé 5)
  await page.goto(BASE + `/admin/expeditions/${ids.airShipment}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);
  await page.locator("input[placeholder='057']").first().fill("057");
  await page.locator("input[placeholder='12345675']").first().fill("12345675");
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(OUT, "11-assistant-awb.png"), fullPage: true });
  console.log("  ✓ 11-assistant-awb.png");

  await shot("12-groupage-maritime.png", `/admin/expeditions/${ids.seaShipment}`);
  await shot("13-factures.png", "/admin/factures");
  await shot("14-facture-impression.png", `/api/invoices/${ids.invoice}/print`);

  console.log("— Mobile");
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await mobile.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await mobile.waitForTimeout(2000);
  await mobile.screenshot({ path: path.join(OUT, "02-accueil-mobile.png"), fullPage: true });
  console.log("  ✓ 02-accueil-mobile.png");
  await mobile.goto(BASE + "/suivi?numero=XTER-2026-000901", { waitUntil: "domcontentloaded" });
  await mobile.waitForTimeout(1800);
  await mobile.screenshot({ path: path.join(OUT, "15-suivi-mobile.png"), fullPage: true });
  console.log("  ✓ 15-suivi-mobile.png");

  await browser.close();
  console.log("✓ Captures terminées dans", OUT);
}

async function teardown() {
  const ids = JSON.parse(fs.readFileSync(IDS_FILE, "utf8"));
  console.log("— Purge des données de démonstration");
  await prisma.$transaction([
    prisma.notification.deleteMany({ where: { OR: [{ relatedPackageId: { in: [ids.pkg1, ids.pkg2] } }] } }),
    prisma.trackingEvent.deleteMany({ where: { OR: [{ packageId: { in: [ids.pkg1, ids.pkg2] } }, { shipmentId: { in: [ids.airShipment, ids.seaShipment] } }] } }),
    prisma.payment.deleteMany({ where: { invoiceId: ids.invoice } }),
    prisma.invoice.deleteMany({ where: { id: ids.invoice } }),
    prisma.package.deleteMany({ where: { id: { in: [ids.pkg1, ids.pkg2] } } }),
    prisma.shipment.deleteMany({ where: { id: { in: [ids.airShipment, ids.seaShipment] } } }),
    prisma.transportProvider.deleteMany({ where: { id: ids.seaCarrier } }),
    prisma.customer.deleteMany({ where: { id: ids.customer } }),
    prisma.user.deleteMany({ where: { id: ids.agent } }),
  ]);
  fs.unlinkSync(IDS_FILE);
  console.log("✓ Base propre (données réelles conservées)");
}

async function run() {
  const phase = process.argv[2] ?? "";
  if (phase === "setup") {
    await setup();
  } else if (phase === "capture") {
    await capture();
  } else if (phase === "teardown") {
    await teardown();
  } else {
    console.error("Phase requise : setup | capture | teardown (voir en-tête du script)");
    process.exit(1);
  }
  await prisma.$disconnect();
}

run().catch((e) => { console.error(e); process.exit(1); });
