/**
 * Seed XTER Transit — données de fondation :
 * - paramètres par défaut (identité, tracking, devises…)
 * - compte super-administrateur (depuis .env)
 * - modèles de notifications
 * - référentiel destinations (pays, aéroports, ports) — données factuelles de référence
 *
 * Aucune donnée métier fictive (colis, livraisons, paiements…) n'est créée.
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { randomBytes, scryptSync } from "node:crypto";
import { createPrismaClient } from "../src/lib/db-factory";

const prisma = createPrismaClient({ log: true }) as PrismaClient;

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

const SETTINGS: Record<string, string> = {
  brandName: "XTER Transit",
  brandTagline: "Vos colis, notre destination",
  brandDescription:
    "Transitaire international : réception, expédition et suivi de vos colis et marchandises par fret aérien et maritime, vers et depuis le monde entier.",
  contactPhone: "",
  contactPhone2: "",
  contactEmail: "",
  contactAddress: "Douala, Cameroun",
  contactHours: "Lundi – Vendredi : 8h00 – 17h00 · Samedi : 9h00 – 13h00",
  whatsappNumber: "", // ex: 2376XXXXXXXX
  currencies: "XAF,EUR,USD",
  defaultCurrency: "XAF",
  trackingPrefix: "XTER",
  trackingPattern: "{PREFIX}-{YYYY}-{SEQ}", // {PREFIX} {YYYY} {SEQ} (séquence sur 6 chiffres)
  volumetricDivisor: "6000", // poids volumétrique aérien : L×l×H (cm) / diviseur
  seaGroupageMinM3: "1", // volume minimal facturé en groupage maritime (m³)
  showPublicTarifs: "false",
  legalCGV: "À compléter : conditions générales de vente de l'entreprise.",
  legalTransport: "À compléter : conditions de transport.",
  legalPrivacy:
    "À compléter : politique de confidentialité (données collectées, finalités, durée de conservation, contact).",
  aboutText:
    "Présentation de l'entreprise à compléter dans les paramètres. XTER Transit organise l'acheminement de colis et marchandises partout dans le monde, par fret aérien et maritime.",
  dataRetentionMonths: "60",
};

const NOTIFICATION_TEMPLATES: Array<{
  eventKey: string;
  channel: string;
  subject: string;
  body: string;
}> = [
  { eventKey: "package_registered", channel: "IN_APP", subject: "Colis enregistré {{trackingNumber}}", body: "Votre colis {{trackingNumber}} a été enregistré. Suivez-le sur notre page de suivi." },
  { eventKey: "package_registered", channel: "EMAIL", subject: "[{{brandName}}] Colis enregistré : {{trackingNumber}}", body: "Bonjour,\n\nVotre colis {{trackingNumber}} a été enregistré dans notre système.\nVous pouvez suivre son acheminement à tout moment : {{trackingUrl}}\n\nCordialement,\n{{brandName}}" },
  { eventKey: "package_received_warehouse", channel: "IN_APP", subject: "Colis réceptionné {{trackingNumber}}", body: "Votre colis {{trackingNumber}} a été réceptionné à notre entrepôt." },
  { eventKey: "package_received_warehouse", channel: "EMAIL", subject: "[{{brandName}}] Colis réceptionné : {{trackingNumber}}", body: "Bonjour,\n\nVotre colis {{trackingNumber}} a été réceptionné à notre entrepôt.\nSuivi : {{trackingUrl}}\n\nCordialement,\n{{brandName}}" },
  { eventKey: "package_shipped", channel: "IN_APP", subject: "Colis expédié {{trackingNumber}}", body: "Votre colis {{trackingNumber}} a été expédié ({{mode}})." },
  { eventKey: "package_shipped", channel: "EMAIL", subject: "[{{brandName}}] Colis expédié : {{trackingNumber}}", body: "Bonjour,\n\nVotre colis {{trackingNumber}} a quitté notre entrepôt (mode : {{mode}}).\nSuivi : {{trackingUrl}}\n\nCordialement,\n{{brandName}}" },
  { eventKey: "customs_cleared", channel: "IN_APP", subject: "Dédouanement terminé {{trackingNumber}}", body: "Le dédouanement de votre colis {{trackingNumber}} est terminé." },
  { eventKey: "package_available", channel: "IN_APP", subject: "Colis disponible {{trackingNumber}}", body: "Votre colis {{trackingNumber}} est disponible pour retrait." },
  { eventKey: "package_available", channel: "EMAIL", subject: "[{{brandName}}] Colis disponible : {{trackingNumber}}", body: "Bonjour,\n\nVotre colis {{trackingNumber}} est arrivé et disponible pour retrait.\nSuivi : {{trackingUrl}}\n\nCordialement,\n{{brandName}}" },
  { eventKey: "package_delivered", channel: "IN_APP", subject: "Colis livré {{trackingNumber}}", body: "Votre colis {{trackingNumber}} a été livré." },
  { eventKey: "package_delivered", channel: "EMAIL", subject: "[{{brandName}}] Colis livré : {{trackingNumber}}", body: "Bonjour,\n\nVotre colis {{trackingNumber}} a été livré.\nMerci de votre confiance.\n\n{{brandName}}" },
  { eventKey: "delay_reported", channel: "IN_APP", subject: "Retard signalé {{trackingNumber}}", body: "Un retard a été signalé pour votre colis {{trackingNumber}}." },
  { eventKey: "document_missing", channel: "IN_APP", subject: "Document manquant {{trackingNumber}}", body: "Un document manque pour votre colis {{trackingNumber}}. Merci de nous contacter." },
  { eventKey: "payment_received", channel: "IN_APP", subject: "Paiement reçu — facture {{invoiceNumber}}", body: "Votre paiement a été enregistré pour la facture {{invoiceNumber}}." },
  { eventKey: "payment_received", channel: "EMAIL", subject: "[{{brandName}}] Paiement reçu : facture {{invoiceNumber}}", body: "Bonjour,\n\nNous avons bien reçu votre paiement pour la facture {{invoiceNumber}}.\nMontant : {{amount}}.\n\nCordialement,\n{{brandName}}" },
  { eventKey: "quote_sent", channel: "EMAIL", subject: "[{{brandName}}] Votre devis {{quoteNumber}}", body: "Bonjour,\n\nVeuillez trouver votre devis {{quoteNumber}}.\nMontant : {{amount}}.\nValidité : {{validUntil}}.\n\nCordialement,\n{{brandName}}" },
];

const COUNTRIES: Array<[string, string]> = [
  ["CM", "Cameroun"], ["FR", "France"], ["CN", "Chine"], ["TR", "Turquie"],
  ["BE", "Belgique"], ["DE", "Allemagne"], ["ES", "Espagne"], ["IT", "Italie"],
  ["GB", "Royaume-Uni"], ["NL", "Pays-Bas"], ["AE", "Émirats arabes unis"],
  ["US", "États-Unis"], ["CA", "Canada"], ["MA", "Maroc"], ["SN", "Sénégal"],
  ["CI", "Côte d'Ivoire"], ["GA", "Gabon"], ["CG", "Congo"], ["CD", "RD Congo"],
  ["TD", "Tchad"], ["CF", "Centrafrique"], ["NG", "Nigéria"], ["GH", "Ghana"],
  ["IN", "Inde"], ["HK", "Hong Kong"], ["SG", "Singapour"], ["SA", "Arabie saoudite"],
];

const HUBS: Array<{ type: string; code: string; name: string; country: string; countryCode: string }> = [
  { type: "AIRPORT", code: "DLA", name: "Aéroport international de Douala", country: "Cameroun", countryCode: "CM" },
  { type: "AIRPORT", code: "NSI", name: "Aéroport international de Yaoundé Nsimalen", country: "Cameroun", countryCode: "CM" },
  { type: "PORT", code: "CMDLA", name: "Port autonome de Douala", country: "Cameroun", countryCode: "CM" },
  { type: "PORT", code: "CMKRI", name: "Port de Kribi", country: "Cameroun", countryCode: "CM" },
  { type: "AIRPORT", code: "CDG", name: "Paris Charles-de-Gaulle", country: "France", countryCode: "FR" },
  { type: "AIRPORT", code: "ORY", name: "Paris Orly", country: "France", countryCode: "FR" },
  { type: "PORT", code: "FRLEH", name: "Port du Havre", country: "France", countryCode: "FR" },
  { type: "PORT", code: "FRMRS", name: "Port de Marseille", country: "France", countryCode: "FR" },
  { type: "AIRPORT", code: "CAN", name: "Aéroport de Guangzhou Baiyun", country: "Chine", countryCode: "CN" },
  { type: "AIRPORT", code: "PVG", name: "Aéroport de Shanghai Pudong", country: "Chine", countryCode: "CN" },
  { type: "PORT", code: "CNNGO", name: "Port de Ningbo-Zhoushan", country: "Chine", countryCode: "CN" },
  { type: "PORT", code: "CNSHA", name: "Port de Shanghai", country: "Chine", countryCode: "CN" },
  { type: "AIRPORT", code: "IST", name: "Aéroport d'Istanbul", country: "Turquie", countryCode: "TR" },
  { type: "AIRPORT", code: "DXB", name: "Aéroport de Dubaï", country: "Émirats arabes unis", countryCode: "AE" },
  { type: "PORT", code: "AEJEA", name: "Port de Jebel Ali", country: "Émirats arabes unis", countryCode: "AE" },
  { type: "PORT", code: "BEANR", name: "Port d'Anvers", country: "Belgique", countryCode: "BE" },
  { type: "PORT", code: "DEHAM", name: "Port de Hambourg", country: "Allemagne", countryCode: "DE" },
  { type: "AIRPORT", code: "BRU", name: "Aéroport de Bruxelles", country: "Belgique", countryCode: "BE" },
  { type: "WAREHOUSE", code: "CM-DLA-01", name: "Entrepôt Douala (siège)", country: "Cameroun", countryCode: "CM" },
];

/** Compagnies aériennes exploitant du fret — préfixes IATA cargo publics (données factuelles de référence). */
const CARGO_AIRLINES: Array<{ name: string; awbPrefix: string; country: string }> = [
  { name: "Air France", awbPrefix: "057", country: "France" },
  { name: "KLM", awbPrefix: "074", country: "Pays-Bas" },
  { name: "Lufthansa", awbPrefix: "020", country: "Allemagne" },
  { name: "Emirates SkyCargo", awbPrefix: "176", country: "Émirats arabes unis" },
  { name: "Turkish Airlines", awbPrefix: "235", country: "Turquie" },
  { name: "Ethiopian Airlines", awbPrefix: "071", country: "Éthiopie" },
  { name: "Brussels Airlines", awbPrefix: "082", country: "Belgique" },
  { name: "Cargolux", awbPrefix: "172", country: "Luxembourg" },
];

async function main() {
  // Paramètres
  for (const [key, value] of Object.entries(SETTINGS)) {
    await prisma.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  console.log("✓ Paramètres par défaut");

  // Super-admin
  const email = (process.env.ADMIN_EMAIL ?? "admin@xter-transit.local").toLowerCase();
  const existingAdmin = await prisma.user.findUnique({ where: { email } });
  if (!existingAdmin) {
    await prisma.user.create({
      data: {
        email,
        name: process.env.ADMIN_NAME ?? "Administrateur",
        passwordHash: hashPassword(process.env.ADMIN_PASSWORD ?? "Admin@2026!"),
        role: "SUPER_ADMIN",
        mustChangePassword: true,
      },
    });
    console.log(`✓ Super-administrateur créé : ${email} (changez le mot de passe à la première connexion)`);
  } else {
    console.log("• Super-administrateur déjà présent");
  }

  // Modèles de notifications
  for (const t of NOTIFICATION_TEMPLATES) {
    await prisma.notificationTemplate.upsert({
      where: { eventKey_channel: { eventKey: t.eventKey, channel: t.channel } },
      update: {},
      create: t,
    });
  }
  console.log(`✓ ${NOTIFICATION_TEMPLATES.length} modèles de notifications`);

  // Destinations
  let created = 0;
  for (const [code, name] of COUNTRIES) {
    await prisma.destination.upsert({
      where: { type_name_country: { type: "COUNTRY", name, country: name } },
      update: {},
      create: { type: "COUNTRY", code, name, country: name, countryCode: code },
    });
    created++;
  }
  for (const h of HUBS) {
    await prisma.destination.upsert({
      where: { type_name_country: { type: h.type, name: h.name, country: h.country } },
      update: {},
      create: { type: h.type, code: h.code, name: h.name, country: h.country, countryCode: h.countryCode },
    });
    created++;
  }
  // Compagnies aériennes (préfixes AWB pour l'assistant)
  for (const a of CARGO_AIRLINES) {
    const existing = await prisma.transportProvider.findFirst({ where: { name: a.name, type: "AIR_CARRIER" } });
    if (!existing) {
      await prisma.transportProvider.create({
        data: { name: a.name, type: "AIR_CARRIER", country: a.country, awbPrefix: a.awbPrefix, active: true },
      });
    }
  }
  console.log(`✓ ${CARGO_AIRLINES.length} compagnies aériennes (préfixes AWB IATA)`);

  console.log(`✓ ${created} entrées destinations (pays, aéroports, ports, entrepôts)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
