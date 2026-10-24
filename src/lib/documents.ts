/**
 * Stockage privé des documents — fichiers jamais servis statiquement.
 * Accès exclusivement via /api/documents/[id] après contrôle d'autorisation.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile } from "node:fs/promises";
import path from "node:path";
import { db } from "./db";

const STORAGE_DIR = process.env.STORAGE_DIR
  ? path.resolve(process.env.STORAGE_DIR)
  : path.join(process.cwd(), "storage");

const ALLOWED_MIME: Record<string, string> = {
  "application/pdf": ".pdf",
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "text/csv": ".csv",
};
const MAX_SIZE = 10 * 1024 * 1024; // 10 Mo

export function storageDir(): string {
  return STORAGE_DIR;
}

async function ensureDir(): Promise<void> {
  await mkdir(STORAGE_DIR, { recursive: true });
}

export interface SaveDocParams {
  file: File;
  kind: string;
  title: string;
  visibility?: "STAFF" | "CLIENT";
  packageId?: string | null;
  shipmentId?: string | null;
  invoiceId?: string | null;
  quoteId?: string | null;
  customerId?: string | null;
  uploadedById?: string | null;
}

export async function saveUploadedDocument(params: SaveDocParams): Promise<{ ok: boolean; documentId?: string; error?: string }> {
  const { file } = params;
  const ext = ALLOWED_MIME[file.type];
  if (!ext) return { ok: false, error: `Type de fichier non autorisé (${file.type || "inconnu"}). Autorisés : PDF, PNG, JPEG, WebP, CSV.` };
  if (file.size > MAX_SIZE) return { ok: false, error: "Fichier trop volumineux (maximum 10 Mo)." };

  await ensureDir();
  const storedName = randomUUID() + ext;
  const buffer = Buffer.from(await file.arrayBuffer());
  await writeFile(path.join(STORAGE_DIR, storedName), buffer);

  const doc = await db.document.create({
    data: {
      kind: params.kind,
      title: params.title || file.name,
      fileName: sanitizeFileName(file.name),
      storedName,
      mime: file.type,
      sizeBytes: file.size,
      visibility: params.visibility ?? "STAFF",
      packageId: params.packageId ?? null,
      shipmentId: params.shipmentId ?? null,
      invoiceId: params.invoiceId ?? null,
      quoteId: params.quoteId ?? null,
      customerId: params.customerId ?? null,
      uploadedById: params.uploadedById ?? null,
    },
    select: { id: true },
  });
  return { ok: true, documentId: doc.id };
}

/** Enregistre une image dataURL (signature, capture) comme document. */
export async function saveDataUrlDocument(params: {
  dataUrl: string;
  kind: string;
  title: string;
  visibility?: "STAFF" | "CLIENT";
  packageId?: string | null;
  uploadedById?: string | null;
}): Promise<{ ok: boolean; documentId?: string; error?: string }> {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(params.dataUrl);
  if (!match) return { ok: false, error: "Format d'image invalide." };
  const [, mime, base64] = match;
  const buffer = Buffer.from(base64, "base64");
  if (buffer.length > MAX_SIZE) return { ok: false, error: "Image trop volumineuse." };

  await ensureDir();
  const storedName = randomUUID() + ALLOWED_MIME[mime];
  await writeFile(path.join(STORAGE_DIR, storedName), buffer);

  const doc = await db.document.create({
    data: {
      kind: params.kind,
      title: params.title,
      fileName: sanitizeFileName(params.title) + ALLOWED_MIME[mime],
      storedName,
      mime,
      sizeBytes: buffer.length,
      visibility: params.visibility ?? "STAFF",
      packageId: params.packageId ?? null,
      uploadedById: params.uploadedById ?? null,
    },
    select: { id: true },
  });
  return { ok: true, documentId: doc.id };
}

export async function readDocumentFile(storedName: string): Promise<Buffer> {
  // stockés par nom UUID généré — pas de traversal possible
  if (!/^[0-9a-f-]{36}\.(pdf|png|jpg|webp|csv)$/.test(storedName)) {
    throw new Error("Nom de fichier invalide.");
  }
  return readFile(path.join(STORAGE_DIR, storedName));
}

function sanitizeFileName(name: string): string {
  return name.replace(/[^\w\s.\-()àâäéèêëîïôöùûüç]/gi, "_").slice(0, 120) || "document";
}
