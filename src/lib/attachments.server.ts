// Server-only helpers for request attachments (photos).
// Never import from client-reachable modules at top level.
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_FILES = 2;
export const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per file
export const MAX_TOTAL_SIZE = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const BUCKET = "request-attachments";
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export type SniffedMime = "image/jpeg" | "image/png" | "image/webp" | null;

/** Detect real MIME type from magic bytes. Ignores the client-provided type/extension. */
export function sniffMime(bytes: Uint8Array): SniffedMime {
  if (bytes.length < 12) return null;
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  // WebP: RIFF....WEBP
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return "image/webp";
  }
  return null;
}

export function extensionForMime(mime: SniffedMime): string {
  if (mime === "image/jpeg") return "jpg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "bin";
}

/** Strip path components and keep a safe display-only base name. */
export function sanitizeDisplayName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() || "photo";
  const cleaned = base.replace(/[^\p{L}\p{N}._\- ]/gu, "_").slice(0, 120);
  return cleaned || "photo";
}

export interface ValidatedFile {
  bytes: Uint8Array;
  mime: "image/jpeg" | "image/png" | "image/webp";
  size: number;
  displayName: string;
  ext: string;
}

export class AttachmentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AttachmentValidationError";
  }
}

export async function validateFiles(files: File[]): Promise<ValidatedFile[]> {
  if (files.length === 0) return [];
  if (files.length > MAX_FILES) {
    throw new AttachmentValidationError(`Vous pouvez joindre ${MAX_FILES} photos maximum.`);
  }
  const results: ValidatedFile[] = [];
  let total = 0;
  for (const f of files) {
    if (f.size === 0) throw new AttachmentValidationError("Un fichier est vide.");
    if (f.size > MAX_SIZE) {
      throw new AttachmentValidationError(
        `Chaque photo doit faire moins de 5 Mo (« ${sanitizeDisplayName(f.name)} »).`,
      );
    }
    total += f.size;
    if (total > MAX_TOTAL_SIZE) throw new AttachmentValidationError("Poids total des photos trop élevé.");
    const buf = new Uint8Array(await f.arrayBuffer());
    const mime = sniffMime(buf);
    if (!mime) throw new AttachmentValidationError("Format non supporté. Formats acceptés : JPEG, PNG, WebP.");
    results.push({
      bytes: buf,
      mime,
      size: f.size,
      displayName: sanitizeDisplayName(f.name),
      ext: extensionForMime(mime),
    });
  }
  return results;
}

function randomUuid(): string {
  return crypto.randomUUID();
}

/** Store validated files under <type>/<request_id>/<uuid>.<ext>. Rollback on partial failure. */
export async function storeAttachments(
  supabase: SupabaseClient<any, any>,
  params: { requestType: "quote" | "appointment"; requestId: string; files: ValidatedFile[] },
): Promise<
  Array<{ id: string; storage_path: string; original_filename: string; mime_type: string; size_bytes: number }>
> {
  const uploaded: string[] = [];
  const insertedIds: string[] = [];
  const rows: Array<{
    id: string;
    storage_path: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
  }> = [];
  try {
    for (const f of params.files) {
      const path = `${params.requestType}/${params.requestId}/${randomUuid()}.${f.ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f.bytes, {
        contentType: f.mime,
        upsert: false,
      });
      if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);
      uploaded.push(path);
      const { data: inserted, error: dbErr } = await supabase
        .from("request_attachments")
        .insert({
          request_id: params.requestId,
          request_type: params.requestType,
          storage_path: path,
          original_filename: f.displayName,
          mime_type: f.mime,
          size_bytes: f.size,
        })
        .select("id")
        .single();
      if (dbErr || !inserted) throw new Error(`DB insert failed: ${dbErr?.message}`);
      insertedIds.push(inserted.id);
      rows.push({
        id: inserted.id,
        storage_path: path,
        original_filename: f.displayName,
        mime_type: f.mime,
        size_bytes: f.size,
      });
    }
    return rows;
  } catch (err) {
    // Rollback: remove any objects and rows we already wrote.
    if (uploaded.length > 0) {
      await supabase.storage
        .from(BUCKET)
        .remove(uploaded)
        .catch(() => undefined);
    }
    if (insertedIds.length > 0) {
      await supabase
        .from("request_attachments")
        .delete()
        .in("id", insertedIds)
        .then(
          () => undefined,
          () => undefined,
        );
    }
    throw err;
  }
}

export async function deleteStagedAttachments(
  supabase: SupabaseClient<any, any>,
  params: {
    requestType: "quote" | "appointment";
    uploadToken: string;
  },
): Promise<number> {
  /*
   * On ne recherche que les fichiers encore associés au token temporaire.
   * Après envoi du formulaire, request_id est remplacé par l'identifiant
   * définitif de la demande : cette route ne pourra donc plus les supprimer.
   */
  const { data: rows, error: selectError } = await supabase
    .from("request_attachments")
    .select("id, storage_path")
    .eq("request_id", params.uploadToken)
    .eq("request_type", params.requestType)
    .like(
      "storage_path",
      `${params.requestType}/${params.uploadToken}/%`,
    );

  if (selectError) {
    throw new Error(
      `Impossible de rechercher les pièces jointes : ${selectError.message}`,
    );
  }

  if (!rows || rows.length === 0) {
    // Suppression idempotente : le lot est peut-être déjà supprimé.
    return 0;
  }

  const storagePaths = rows.map((row) => row.storage_path);
  const rowIds = rows.map((row) => row.id);

  /*
   * On supprime d'abord les vrais objets du Storage.
   * On ne supprime les lignes SQL que si cette opération réussit.
   */
  const { error: storageError } = await supabase.storage
    .from(BUCKET)
    .remove(storagePaths);

  if (storageError) {
    throw new Error(
      `Impossible de supprimer les fichiers : ${storageError.message}`,
    );
  }

  const { error: databaseError } = await supabase
    .from("request_attachments")
    .delete()
    .in("id", rowIds);

  if (databaseError) {
    throw new Error(
      `Impossible de supprimer les pièces jointes : ${databaseError.message}`,
    );
  }

  return rows.length;
}

/** Build signed URLs (7 days) for the artisan notification email. */
export async function buildSignedLinks(
  supabase: SupabaseClient<any, any>,
  rows: Array<{ storage_path: string; original_filename: string; mime_type: string; size_bytes: number }>,
): Promise<Array<{ url: string; filename: string; size: number; mime: string }>> {
  if (rows.length === 0) return [];
  const paths = rows.map((r) => r.storage_path);
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) {
    console.error("createSignedUrls failed", error);
    return [];
  }
  return rows
    .map((r, i) => ({
      url: data[i]?.signedUrl || "",
      filename: r.original_filename,
      size: r.size_bytes,
      mime: r.mime_type,
    }))
    .filter((a) => a.url);
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
}
