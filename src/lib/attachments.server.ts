// Server-only helpers for request attachments (photos).
// Never import from client-reachable modules at top level.
import type { SupabaseClient } from "@supabase/supabase-js";

export const MAX_FILES = 2;
export const MAX_SIZE = 5 * 1024 * 1024; // 5 MB per file
export const MAX_TOTAL_SIZE = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const BUCKET = "request-attachments";
export const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days
export const PREVIEW_URL_TTL_SECONDS = 60 * 10; // 10 minutes
export const TEMP_RETENTION_HOURS = 24;

export type EntityType = "quote_request" | "appointment" | "contact_request";

const ENTITY_PREFIX: Record<EntityType, string> = {
  quote_request: "quote-requests",
  appointment: "appointments",
  contact_request: "contact-requests",
};

/** request_attachments keeps its legacy vocabulary. */
const LEGACY_REQUEST_TYPE: Partial<Record<EntityType, "quote" | "appointment">> = {
  quote_request: "quote",
  appointment: "appointment",
};

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

function randomUuid(): string {
  return crypto.randomUUID();
}

export interface StoredTempFile {
  id: string;
  filename: string;
  size: number;
  mime: string;
  previewUrl: string | null;
}

/**
 * Upload validated files under temporary/<sessionId>/<uuid>.<ext> and track them
 * in uploaded_files with status='temporary'. Storage objects whose DB row fails
 * to insert are removed immediately so no orphan can survive the request.
 */
export async function storeTemporaryFiles(
  supabase: SupabaseClient<any, any>,
  params: { uploadSessionId: string; files: ValidatedFile[] },
): Promise<StoredTempFile[]> {
  const stored: StoredTempFile[] = [];
  for (const f of params.files) {
    const path = `temporary/${params.uploadSessionId}/${randomUuid()}.${f.ext}`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, f.bytes, {
      contentType: f.mime,
      upsert: false,
    });
    if (upErr) throw new Error(`Storage upload failed: ${upErr.message}`);

    const { data: inserted, error: dbErr } = await supabase
      .from("uploaded_files")
      .insert({
        storage_path: path,
        original_filename: f.displayName,
        mime_type: f.mime,
        size_bytes: f.size,
        upload_session_id: params.uploadSessionId,
        status: "temporary",
      })
      .select("id")
      .single();

    if (dbErr || !inserted) {
      // Orphan guard: drop the object we just wrote.
      await supabase.storage
        .from(BUCKET)
        .remove([path])
        .catch(() => undefined);
      throw new Error(`DB insert failed: ${dbErr?.message ?? "unknown"}`);
    }

    let previewUrl: string | null = null;
    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(path, PREVIEW_URL_TTL_SECONDS);
    previewUrl = signed?.signedUrl ?? null;

    stored.push({
      id: inserted.id,
      filename: f.displayName,
      size: f.size,
      mime: f.mime,
      previewUrl,
    });
  }
  return stored;
}

/** How many live (temporary or confirmed) files a session already holds. */
export async function countSessionFiles(
  supabase: SupabaseClient<any, any>,
  uploadSessionId: string,
): Promise<number> {
  const { count } = await supabase
    .from("uploaded_files")
    .select("id", { count: "exact", head: true })
    .eq("upload_session_id", uploadSessionId)
    .in("status", ["temporary", "confirmed", "deleting"]);
  return count ?? 0;
}

/**
 * Idempotent removal of a single temporary file owned by the given session.
 * Returns true when the file is gone (already deleted counts as success).
 */
export async function deleteTemporaryFile(
  supabase: SupabaseClient<any, any>,
  params: { uploadSessionId: string; fileId: string },
): Promise<boolean> {
  const { data: row, error } = await supabase
    .from("uploaded_files")
    .select("id, storage_path, status")
    .eq("id", params.fileId)
    .eq("upload_session_id", params.uploadSessionId)
    .maybeSingle();

  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (!row) return true; // unknown id or foreign session: nothing to expose
  if (row.status === "deleted") return true;
  if (row.status === "confirmed") return false; // already attached to a request

  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
  if (rmErr) {
    await supabase
      .from("uploaded_files")
      .update({ status: "delete_failed" })
      .eq("id", row.id)
      .then(
        () => undefined,
        () => undefined,
      );
    throw new Error(`Storage delete failed: ${rmErr.message}`);
  }

  await supabase
    .from("uploaded_files")
    .update({ status: "deleted", deleted_at: new Date().toISOString() })
    .eq("id", row.id);
  return true;
}

/** Best-effort cleanup of every temporary file of a session (form abandoned). */
export async function abandonUploadSession(
  supabase: SupabaseClient<any, any>,
  uploadSessionId: string,
): Promise<number> {
  const { data: rows } = await supabase
    .from("uploaded_files")
    .select("id")
    .eq("upload_session_id", uploadSessionId)
    .eq("status", "temporary");
  if (!rows || rows.length === 0) return 0;

  let removed = 0;
  for (const r of rows) {
    try {
      if (await deleteTemporaryFile(supabase, { uploadSessionId, fileId: r.id })) removed += 1;
    } catch (err) {
      console.error("abandonUploadSession: delete failed", err);
    }
  }
  return removed;
}

/**
 * Attach the session's temporary files to a persisted request: copy each object
 * to its final path, verify the copy, drop the temporary object, then flip the
 * row to 'confirmed'. A failed copy leaves the row temporary (the purge will
 * reclaim it) and never blocks the submission.
 */
export async function confirmSessionFiles(
  supabase: SupabaseClient<any, any>,
  params: { uploadSessionId: string; entityType: EntityType; entityId: string },
): Promise<Array<{ storage_path: string; original_filename: string; mime_type: string; size_bytes: number }>> {
  const { data: rows, error } = await supabase
    .from("uploaded_files")
    .select("id, storage_path, original_filename, mime_type, size_bytes")
    .eq("upload_session_id", params.uploadSessionId)
    .eq("status", "temporary")
    .is("entity_id", null);

  if (error) {
    console.error("confirmSessionFiles: lookup failed", error);
    return [];
  }
  if (!rows || rows.length === 0) return [];

  const confirmed: Array<{
    storage_path: string;
    original_filename: string;
    mime_type: string;
    size_bytes: number;
  }> = [];

  for (const row of rows) {
    const ext = row.storage_path.split(".").pop() || "bin";
    const finalPath = `${ENTITY_PREFIX[params.entityType]}/${params.entityId}/${row.id}.${ext}`;
    try {
      const { error: copyErr } = await supabase.storage
        .from(BUCKET)
        .copy(row.storage_path, finalPath);
      if (copyErr) throw new Error(copyErr.message);

      // Verify the copy really landed before we touch anything else.
      const { error: verifyErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(finalPath, 60);
      if (verifyErr) throw new Error(`copy verification failed: ${verifyErr.message}`);

      // Residual temporary object is not fatal — the purge sweeps it later.
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
      if (rmErr) console.error("confirmSessionFiles: temp removal failed", rmErr);

      const { error: updErr } = await supabase
        .from("uploaded_files")
        .update({
          storage_path: finalPath,
          status: "confirmed",
          entity_type: params.entityType,
          entity_id: params.entityId,
          confirmed_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .eq("status", "temporary");
      if (updErr) throw new Error(updErr.message);

      const legacyType = LEGACY_REQUEST_TYPE[params.entityType];
      if (legacyType) {
        await supabase
          .from("request_attachments")
          .insert({
            request_id: params.entityId,
            request_type: legacyType,
            storage_path: finalPath,
            original_filename: row.original_filename,
            mime_type: row.mime_type ?? "application/octet-stream",
            size_bytes: row.size_bytes ?? 0,
          })
          .then(
            () => undefined,
            () => undefined,
          );
      }

      confirmed.push({
        storage_path: finalPath,
        original_filename: row.original_filename,
        mime_type: row.mime_type ?? "application/octet-stream",
        size_bytes: Number(row.size_bytes ?? 0),
      });
    } catch (err) {
      console.error("confirmSessionFiles: file confirmation failed", err);
      // Leave the row temporary so the scheduled purge can reclaim it.
    }
  }

  return confirmed;
}

export interface PurgeResult {
  scanned: number;
  deleted: number;
  failed: number;
}

/**
 * Reclaim temporary files older than the retention window. Concurrency-safe:
 * the conditional temporary -> deleting transition claims each row exactly once.
 */
export async function purgeExpiredTemporaryFiles(
  supabase: SupabaseClient<any, any>,
  options?: { retentionHours?: number; limit?: number },
): Promise<PurgeResult> {
  const retentionHours = options?.retentionHours ?? TEMP_RETENTION_HOURS;
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();

  const { data: candidates, error } = await supabase
    .from("uploaded_files")
    .select("id, storage_path")
    .eq("status", "temporary")
    .lt("created_at", cutoff)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) throw new Error(`Purge lookup failed: ${error.message}`);
  if (!candidates || candidates.length === 0) return { scanned: 0, deleted: 0, failed: 0 };

  let deleted = 0;
  let failed = 0;

  for (const row of candidates) {
    // Claim the row; a concurrent run gets 0 rows back and skips it.
    const { data: claimed } = await supabase
      .from("uploaded_files")
      .update({ status: "deleting" })
      .eq("id", row.id)
      .eq("status", "temporary")
      .select("id")
      .maybeSingle();
    if (!claimed) continue;

    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([row.storage_path]);
    if (rmErr) {
      failed += 1;
      console.error("purgeExpiredTemporaryFiles: storage delete failed", row.storage_path, rmErr);
      await supabase.from("uploaded_files").update({ status: "delete_failed" }).eq("id", row.id);
      continue;
    }
    await supabase
      .from("uploaded_files")
      .update({ status: "deleted", deleted_at: new Date().toISOString() })
      .eq("id", row.id);
    deleted += 1;
  }

  return { scanned: candidates.length, deleted, failed };
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
