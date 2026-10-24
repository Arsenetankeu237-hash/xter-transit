/**
 * Constantes métier — rôles, permissions, statuts, modes, référentiels.
 * Les statuts sont volontairement en String (compatibilité SQLite → PostgreSQL) ;
 * ils sont validés par ces catalogues côté application.
 */

// ---------------------------------------------------------------------------
// Rôles & permissions
// ---------------------------------------------------------------------------

export const ROLES = {
  SUPER_ADMIN: "Super administrateur",
  ADMIN: "Administrateur",
  AGENT_TRANSIT: "Agent de transit",
  WAREHOUSE_MANAGER: "Responsable d'entrepôt",
  ACCOUNTANT: "Comptable",
  SHIPMENT_MANAGER: "Responsable des expéditions",
  DELIVERY_AGENT: "Agent de livraison",
  CLIENT: "Client",
} as const;

export type Role = keyof typeof ROLES;

export const STAFF_ROLES: Role[] = [
  "SUPER_ADMIN", "ADMIN", "AGENT_TRANSIT", "WAREHOUSE_MANAGER",
  "ACCOUNTANT", "SHIPMENT_MANAGER", "DELIVERY_AGENT",
];

export const PERMISSIONS = {
  "customers:manage": ["SUPER_ADMIN", "ADMIN", "AGENT_TRANSIT"],
  "packages:manage": ["SUPER_ADMIN", "ADMIN", "AGENT_TRANSIT", "WAREHOUSE_MANAGER", "SHIPMENT_MANAGER"],
  "tracking:manage": ["SUPER_ADMIN", "ADMIN", "AGENT_TRANSIT", "WAREHOUSE_MANAGER", "SHIPMENT_MANAGER"],
  "shipments:manage": ["SUPER_ADMIN", "ADMIN", "SHIPMENT_MANAGER", "AGENT_TRANSIT"],
  "quotes:manage": ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "AGENT_TRANSIT"],
  "finance:manage": ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT"],
  "deliveries:manage": ["SUPER_ADMIN", "ADMIN", "SHIPMENT_MANAGER", "AGENT_TRANSIT"],
  "deliveries:execute": ["SUPER_ADMIN", "ADMIN", "DELIVERY_AGENT"],
  "destinations:manage": ["SUPER_ADMIN", "ADMIN"],
  "integrations:manage": ["SUPER_ADMIN", "ADMIN"],
  "notifications:manage": ["SUPER_ADMIN", "ADMIN"],
  "users:manage": ["SUPER_ADMIN"],
  "settings:manage": ["SUPER_ADMIN", "ADMIN"],
  "audit:view": ["SUPER_ADMIN", "ADMIN"],
  "reports:view": ["SUPER_ADMIN", "ADMIN", "ACCOUNTANT", "SHIPMENT_MANAGER"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string | undefined | null, permission: Permission): boolean {
  if (!role) return false;
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

// ---------------------------------------------------------------------------
// Modes & transports
// ---------------------------------------------------------------------------

export const MODES = { AIR: "Fret aérien", SEA: "Fret maritime" } as const;
export type Mode = keyof typeof MODES;

export const CUSTOMER_TYPES = { INDIVIDUAL: "Particulier", COMPANY: "Entreprise" } as const;

export const PROVIDER_TYPES = {
  AIR_CARRIER: "Compagnie aérienne",
  SEA_CARRIER: "Compagnie maritime",
  COURIER: "Messagerie / express",
  FORWARDER: "Transitaire partenaire",
  CUSTOMS_AGENT: "Agent en douane",
  DELIVERY: "Prestataire de livraison",
} as const;

export const PAYMENT_METHODS = {
  CASH: "Espèces",
  BANK_TRANSFER: "Virement bancaire",
  MOBILE_MONEY: "Mobile Money",
  ONLINE: "Paiement en ligne",
} as const;

export const DESTINATION_TYPES = {
  COUNTRY: "Pays",
  CITY: "Ville",
  AIRPORT: "Aéroport",
  PORT: "Port",
  WAREHOUSE: "Entrepôt",
  AGENCY: "Agence",
} as const;

export const DOCUMENT_KINDS = {
  RECEPTION_FORM: "Fiche de réception",
  LABEL: "Étiquette",
  MANIFEST: "Manifeste interne",
  GROUPAGE_LIST: "Liste de groupage",
  QUOTE: "Devis",
  INVOICE: "Facture",
  RECEIPT: "Reçu",
  DELIVERY_NOTE: "Bon de livraison",
  POD_PHOTO: "Photo de preuve de livraison",
  SIGNATURE: "Signature",
  AWB: "Lettre de transport aérien (AWB)",
  BL: "Connaissement maritime (BL)",
  CUSTOMS: "Document douanier",
  OTHER: "Autre",
} as const;

// ---------------------------------------------------------------------------
// Statuts de colis (catalogue complet, adapté au mode de transport)
// ---------------------------------------------------------------------------

export interface StatusDef {
  key: string;
  label: string;
  category: "request" | "preparation" | "transit" | "customs" | "delivery" | "issue" | "return" | "end";
  modes: Mode[];
  order: number;
  problem?: boolean;
  terminal?: boolean;
}

export const PACKAGE_STATUSES: StatusDef[] = [
  { key: "REQUEST_RECEIVED", label: "Demande de transport reçue", category: "request", modes: ["AIR", "SEA"], order: 1 },
  { key: "QUOTE_PREPARATION", label: "Devis en préparation", category: "request", modes: ["AIR", "SEA"], order: 2 },
  { key: "AWAITING_CONFIRMATION", label: "En attente de confirmation", category: "request", modes: ["AIR", "SEA"], order: 3 },
  { key: "AWAITING_PAYMENT", label: "En attente de paiement", category: "request", modes: ["AIR", "SEA"], order: 4 },
  { key: "PACKAGE_ANNOUNCED", label: "Colis annoncé", category: "preparation", modes: ["AIR", "SEA"], order: 5 },
  { key: "RECEIVED_WAREHOUSE", label: "Colis réceptionné à l'entrepôt", category: "preparation", modes: ["AIR", "SEA"], order: 6 },
  { key: "CONTROLLED_WEIGHED", label: "Colis contrôlé et pesé", category: "preparation", modes: ["AIR", "SEA"], order: 7 },
  { key: "PREPARATION", label: "Colis en préparation", category: "preparation", modes: ["AIR", "SEA"], order: 8 },
  { key: "DOCS_PREPARATION", label: "Documents en préparation", category: "preparation", modes: ["AIR", "SEA"], order: 9 },
  { key: "AWAITING_DEPARTURE", label: "En attente de départ", category: "preparation", modes: ["AIR", "SEA"], order: 10 },
  { key: "SHIPPED", label: "Expédié", category: "transit", modes: ["AIR", "SEA"], order: 11 },
  { key: "IN_TRANSIT", label: "En transit", category: "transit", modes: ["AIR", "SEA"], order: 12 },
  { key: "TRANSIT_HUB", label: "Arrivé au point de transit intermédiaire", category: "transit", modes: ["AIR", "SEA"], order: 13 },
  { key: "ARRIVED_DESTINATION_COUNTRY", label: "Arrivé dans le pays de destination", category: "transit", modes: ["AIR", "SEA"], order: 14 },
  { key: "CUSTOMS_IN_PROGRESS", label: "En cours de dédouanement", category: "customs", modes: ["AIR", "SEA"], order: 15 },
  { key: "CUSTOMS_CLEARED", label: "Dédouanement terminé", category: "customs", modes: ["AIR", "SEA"], order: 16 },
  { key: "AVAILABLE_PICKUP", label: "Disponible pour retrait", category: "delivery", modes: ["AIR", "SEA"], order: 17 },
  { key: "OUT_FOR_DELIVERY", label: "En cours de livraison", category: "delivery", modes: ["AIR", "SEA"], order: 18 },
  { key: "DELIVERED", label: "Livré", category: "end", modes: ["AIR", "SEA"], order: 19, terminal: true },
  { key: "DELAYED", label: "Retard de transport", category: "issue", modes: ["AIR", "SEA"], order: 20, problem: true },
  { key: "MISSING_DOCUMENT", label: "Document manquant", category: "issue", modes: ["AIR", "SEA"], order: 21, problem: true },
  { key: "AWAITING_REGULARIZATION", label: "En attente de régularisation", category: "issue", modes: ["AIR", "SEA"], order: 22, problem: true },
  { key: "SUSPENDED", label: "Expédition suspendue", category: "issue", modes: ["AIR", "SEA"], order: 23, problem: true },
  { key: "RETURN_IN_PROGRESS", label: "Retour en cours", category: "return", modes: ["AIR", "SEA"], order: 24 },
  { key: "RETURNED_TO_SENDER", label: "Retourné à l'expéditeur", category: "return", modes: ["AIR", "SEA"], order: 25, terminal: true },
  { key: "CANCELLED", label: "Annulé", category: "end", modes: ["AIR", "SEA"], order: 26, terminal: true },
  // Spécifiques maritime (cycle conteneur)
  { key: "CONTAINER_STUFFED", label: "Conteneur empoté", category: "preparation", modes: ["SEA"], order: 10.5 },
  { key: "VESSEL_DEPARTED", label: "Départ du navire", category: "transit", modes: ["SEA"], order: 11.5 },
  { key: "VESSEL_ARRIVED", label: "Navire arrivé au port", category: "transit", modes: ["SEA"], order: 14.5 },
  { key: "CONTAINER_UNLOADED", label: "Conteneur déchargé", category: "transit", modes: ["SEA"], order: 14.6 },
];

export const STATUS_MAP: Record<string, StatusDef> = Object.fromEntries(
  PACKAGE_STATUSES.map((s) => [s.key, s])
);

export function statusLabel(key: string): string {
  return STATUS_MAP[key]?.label ?? key;
}

export function statusesForMode(mode: string): StatusDef[] {
  return PACKAGE_STATUSES.filter((s) => s.modes.includes(mode as Mode));
}

export function isPackageStatus(key: string): boolean {
  return key in STATUS_MAP;
}

// Catégories pour le style des badges
export const STATUS_CATEGORY_STYLE: Record<StatusDef["category"], string> = {
  request: "bg-slate-100 text-slate-700 ring-slate-200",
  preparation: "bg-blue-50 text-blue-700 ring-blue-200",
  transit: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  customs: "bg-amber-50 text-amber-700 ring-amber-200",
  delivery: "bg-teal-50 text-teal-700 ring-teal-200",
  issue: "bg-red-50 text-red-700 ring-red-200",
  return: "bg-orange-50 text-orange-700 ring-orange-200",
  end: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

// ---------------------------------------------------------------------------
// Statuts d'expédition (aérienne / maritime) et propagation vers les colis
// ---------------------------------------------------------------------------

export const SHIPMENT_STATUSES = [
  { key: "PLANNED", label: "Planifiée", order: 1 },
  { key: "BOOKED", label: "Réservée", order: 2 },
  { key: "LOADING", label: "Empotage / chargement", order: 3 },
  { key: "DEPARTED", label: "Partie", order: 4 },
  { key: "IN_TRANSIT", label: "En transit", order: 5 },
  { key: "ARRIVED", label: "Arrivée à destination", order: 6 },
  { key: "UNLOADING", label: "Déchargement", order: 7 },
  { key: "CUSTOMS", label: "Dédouanement", order: 8 },
  { key: "RELEASED", label: "Mise à disposition", order: 9 },
  { key: "CLOSED", label: "Clôturée", order: 10, terminal: true },
  { key: "CANCELLED", label: "Annulée", order: 11, terminal: true },
] as const;

export const SHIPMENT_STATUS_MAP = Object.fromEntries(SHIPMENT_STATUSES.map((s) => [s.key, s]));

/** Règles de propagation : un événement d'expédition peut mettre à jour les colis du groupe. */
export const SHIPMENT_PROPAGATION: Record<string, { AIR?: string; SEA?: string }> = {
  BOOKED: { AIR: "AWAITING_DEPARTURE", SEA: "AWAITING_DEPARTURE" },
  LOADING: { AIR: "PREPARATION", SEA: "CONTAINER_STUFFED" },
  DEPARTED: { AIR: "SHIPPED", SEA: "VESSEL_DEPARTED" },
  IN_TRANSIT: { AIR: "IN_TRANSIT", SEA: "IN_TRANSIT" },
  ARRIVED: { AIR: "ARRIVED_DESTINATION_COUNTRY", SEA: "VESSEL_ARRIVED" },
  UNLOADING: { AIR: "ARRIVED_DESTINATION_COUNTRY", SEA: "CONTAINER_UNLOADED" },
  CUSTOMS: { AIR: "CUSTOMS_IN_PROGRESS", SEA: "CUSTOMS_IN_PROGRESS" },
  RELEASED: { AIR: "AVAILABLE_PICKUP", SEA: "AVAILABLE_PICKUP" },
};

// ---------------------------------------------------------------------------
// Divers
// ---------------------------------------------------------------------------

export const EVENT_SOURCES = {
  MANUAL: "Manuel",
  API: "API transporteur",
  IMPORT: "Import de données",
} as const;

export const DELIVERY_STATUSES = {
  ASSIGNED: "Affectée",
  IN_PROGRESS: "En cours",
  DELIVERED: "Livrée",
  FAILED: "Échec",
  RESCHEDULED: "Reprogrammée",
  CANCELLED: "Annulée",
} as const;

export const QUOTE_STATUSES = {
  NEW: "Nouvelle demande",
  PROCESSING: "En traitement",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
  INVOICED: "Facturé",
} as const;

export const INVOICE_STATUSES = {
  DRAFT: "Brouillon",
  ISSUED: "Émise",
  PARTIAL: "Partiellement payée",
  PAID: "Payée",
  CANCELLED: "Annulée",
} as const;

export const RATE_BASES = {
  PER_KG: "Par kg (poids taxable)",
  PER_M3: "Par m³ (volume)",
  PER_SHIPMENT: "Par expédition",
  MIN_CHARGE: "Minimum facturable",
  FEE_DOSSIER: "Frais de dossier",
  FEE_HANDLING: "Frais de manutention",
  FEE_PORT: "Frais portuaires",
  FEE_CUSTOMS: "Frais de transit / douane",
  FEE_STORAGE: "Frais de stockage",
  FEE_OTHER: "Autres frais",
} as const;

export const RATE_LINE_KEYS = Object.keys(RATE_BASES);
