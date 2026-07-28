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

export interface StoredTempFile {
  id: string;
  filename: string;
  size: number;
  mime: string;
  previewUrl: string | null;
}

/** Progressive backoff between storage-deletion retries. */
const RETRY_DELAYS_MINUTES = [15, 60, 240, 720, 1440];
export const MAX_DELETE_ATTEMPTS = RETRY_DELAYS_MINUTES.length;

function nextRetryAt(attempts: number): string {
  const idx = Math.min(Math.max(attempts, 1), RETRY_DELAYS_MINUTES.length) - 1;
  return new Date(Date.now() + RETRY_DELAYS_MINUTES[idx] * 60 * 1000).toISOString();
}

/** Record a failed storage deletion with backoff, without ever throwing. */
async function recordDeleteFailure(
  supabase: SupabaseClient<any, any>,
  params: { id: string; attempts: number; message: string; markFailed: boolean },
): Promise<void> {
  const attempts = params.attempts + 1;
  const patch: Record<string, unknown> = {
    delete_attempts: attempts,
    last_delete_error: params.message.slice(0, 500),
    next_delete_retry_at: nextRetryAt(attempts),
  };
  if (params.markFailed) patch.status = "delete_failed";
  try {
    await supabase.from("uploaded_files").update(patch).eq("id", params.id);
  } catch (err) {
    console.error("recordDeleteFailure: bookkeeping update failed", err);
  }
}

/**
 * Reserve slots transactionally (advisory lock on the session id), then upload
 * each object to its reserved path. The DB row exists before the storage write,
 * so a crashed request can never leave an untracked object behind.
 */
export async function storeTemporaryFiles(
  supabase: SupabaseClient<any, any>,
  params: { uploadSessionId: string; files: ValidatedFile[] },
): Promise<StoredTempFile[]> {
  if (params.files.length === 0) return [];

  const { data: reserved, error: rpcErr } = await supabase.rpc("reserve_upload_files", {
    _upload_session_id: params.uploadSessionId,
    _files: params.files.map((f) => ({
      ext: f.ext,
      filename: f.displayName,
      mime: f.mime,
      size: f.size,
    })),
    _max_files: MAX_FILES,
  });

  if (rpcErr) {
    if ((rpcErr.message || "").includes("too_many_files")) {
      throw new AttachmentValidationError(
        `Vous pouvez joindre ${MAX_FILES} photos maximum.`,
      );
    }
    throw new Error(`Reservation failed: ${rpcErr.message}`);
  }

  const slots = (reserved ?? []) as Array<{ id: string; storage_path: string }>;
  if (slots.length !== params.files.length) {
    throw new Error("Reservation returned an unexpected number of slots");
  }

  const stored: StoredTempFile[] = [];
  for (let i = 0; i < params.files.length; i += 1) {
    const f = params.files[i];
    const slot = slots[i];

    await supabase
      .from("uploaded_files")
      .update({ status: "uploading" })
      .eq("id", slot.id)
      .eq("status", "reserved");

    const { error: upErr } = await supabase.storage.from(BUCKET).upload(slot.storage_path, f.bytes, {
      contentType: f.mime,
      upsert: false,
    });

    if (upErr) {
      // Free the slot immediately: the reservation must not hold a place.
      await supabase.storage
        .from(BUCKET)
        .remove([slot.storage_path])
        .then(
          () => undefined,
          () => undefined,
        );
      await supabase
        .from("uploaded_files")
        .update({ status: "upload_failed", last_delete_error: upErr.message.slice(0, 500) })
        .eq("id", slot.id);
      throw new Error(`Storage upload failed: ${upErr.message}`);
    }

    const { error: liveErr } = await supabase
      .from("uploaded_files")
      .update({ status: "temporary", reservation_expires_at: null })
      .eq("id", slot.id)
      .in("status", ["reserved", "uploading"]);
    if (liveErr) {
      await supabase.storage
        .from(BUCKET)
        .remove([slot.storage_path])
        .then(
          () => undefined,
          () => undefined,
        );
      throw new Error(`DB update failed: ${liveErr.message}`);
    }

    const { data: signed } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(slot.storage_path, PREVIEW_URL_TTL_SECONDS);

    stored.push({
      id: slot.id,
      filename: f.displayName,
      size: f.size,
      mime: f.mime,
      previewUrl: signed?.signedUrl ?? null,
    });
  }
  return stored;
}

/** How many live files a session already holds (informational). */
export async function countSessionFiles(
  supabase: SupabaseClient<any, any>,
  uploadSessionId: string,
): Promise<number> {
  const { count } = await supabase
    .from("uploaded_files")
    .select("id", { count: "exact", head: true })
    .eq("upload_session_id", uploadSessionId)
    .in("status", ["reserved", "uploading", "temporary", "confirming", "confirmed", "deleting"]);
  return count ?? 0;
}

export type DeleteOutcome = "deleted" | "already_gone" | "locked" | "failed";

/**
 * Idempotent removal of a single temporary file owned by the given session.
 * Only 'temporary' rows can be claimed: a file being confirmed or already
 * attached to a request is never touched.
 */
export async function deleteTemporaryFileDetailed(
  supabase: SupabaseClient<any, any>,
  params: { uploadSessionId: string; fileId: string },
): Promise<DeleteOutcome> {
  const { data: row, error } = await supabase
    .from("uploaded_files")
    .select("id, storage_path, status, delete_attempts")
    .eq("id", params.fileId)
    .eq("upload_session_id", params.uploadSessionId)
    .maybeSingle();

  if (error) throw new Error(`Lookup failed: ${error.message}`);
  if (!row) return "already_gone"; // unknown id or foreign session: reveal nothing
  if (row.status === "deleted") return "already_gone";
  if (["confirming", "confirmed", "reserved", "uploading"].includes(row.status)) return "locked";
  if (row.status === "deleting") return "already_gone"; // another worker owns it

  // Claim atomically; a concurrent caller gets nothing back.
  const { data: claimed } = await supabase
    .from("uploaded_files")
    .update({ status: "deleting" })
    .eq("id", row.id)
    .in("status", ["temporary", "delete_failed"])
    .select("id, storage_path, delete_attempts")
    .maybeSingle();
  if (!claimed) return "already_gone";

  const { error: rmErr } = await supabase.storage.from(BUCKET).remove([claimed.storage_path]);
  if (rmErr) {
    await recordDeleteFailure(supabase, {
      id: claimed.id,
      attempts: Number(claimed.delete_attempts ?? 0),
      message: rmErr.message,
      markFailed: true,
    });
    return "failed";
  }

  await supabase
    .from("uploaded_files")
    .update({
      status: "deleted",
      deleted_at: new Date().toISOString(),
      temporary_storage_path: null,
      next_delete_retry_at: null,
      last_delete_error: null,
    })
    .eq("id", claimed.id);
  return "deleted";
}

/** Backwards-compatible wrapper: true when the file is gone. */
export async function deleteTemporaryFile(
  supabase: SupabaseClient<any, any>,
  params: { uploadSessionId: string; fileId: string },
): Promise<boolean> {
  const outcome = await deleteTemporaryFileDetailed(supabase, params);
  if (outcome === "failed") throw new Error("Storage delete failed");
  return outcome !== "locked";
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
      const outcome = await deleteTemporaryFileDetailed(supabase, {
        uploadSessionId,
        fileId: r.id,
      });
      if (outcome === "deleted") removed += 1;
    } catch (err) {
      console.error("abandonUploadSession: delete failed", err);
    }
  }
  return removed;
}

/** True when the object really exists in the bucket. */
async function objectExists(
  supabase: SupabaseClient<any, any>,
  path: string,
): Promise<boolean> {
  const slash = path.lastIndexOf("/");
  const dir = slash >= 0 ? path.slice(0, slash) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  const { data, error } = await supabase.storage.from(BUCKET).list(dir, {
    limit: 100,
    search: name,
  });
  if (error) throw new Error(`existence check failed: ${error.message}`);
  return (data ?? []).some((o: { name: string }) => o.name === name);
}

/**
 * Attach the session's temporary files to a persisted request. Strict order:
 * claim (temporary -> confirming), copy, verify, transactional finalization
 * (row + request_attachments), and only then drop the temporary object.
 * Never throws: a failed attachment must not break a saved submission.
 */
export async function confirmSessionFiles(
  supabase: SupabaseClient<any, any>,
  params: { uploadSessionId: string; entityType: EntityType; entityId: string },
): Promise<Array<{ storage_path: string; original_filename: string; mime_type: string; size_bytes: number }>> {
  const { data: rows, error } = await supabase
    .from("uploaded_files")
    .select("id")
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

  for (const candidate of rows) {
    // 1. Atomic claim — nothing else may delete this file from now on.
    const { data: row, error: claimErr } = await supabase
      .from("uploaded_files")
      .update({ status: "confirming" })
      .eq("id", candidate.id)
      .eq("status", "temporary")
      .select("id, storage_path, original_filename, mime_type, size_bytes")
      .maybeSingle();
    if (claimErr) {
      console.error("confirmSessionFiles: claim failed", claimErr);
      continue;
    }
    if (!row) continue; // already claimed elsewhere

    // 2. Remember the temporary path before anything else.
    const temporaryPath: string = row.storage_path;
    const ext = temporaryPath.split(".").pop() || "bin";
    const finalPath = `${ENTITY_PREFIX[params.entityType]}/${params.entityId}/${row.id}.${ext}`;
    let finalCreated = false;

    try {
      // 3. Copy to the final location (idempotent when re-running).
      const { error: copyErr } = await supabase.storage.from(BUCKET).copy(temporaryPath, finalPath);
      if (copyErr && !/exists/i.test(copyErr.message)) throw new Error(copyErr.message);
      finalCreated = true;

      // 4. Verify the object really landed.
      if (!(await objectExists(supabase, finalPath))) {
        throw new Error("copy verification failed: final object missing");
      }

      // 5. Transactional finalization: row + request_attachments together.
      const { data: ok, error: finErr } = await supabase.rpc("finalize_uploaded_file", {
        _file_id: row.id,
        _final_path: finalPath,
        _temporary_path: temporaryPath,
        _entity_type: params.entityType,
        _entity_id: params.entityId,
        _legacy_request_type: LEGACY_REQUEST_TYPE[params.entityType] ?? null,
      });
      if (finErr) throw new Error(`finalization failed: ${finErr.message}`);
      if (ok !== true) throw new Error("finalization did not claim the row");

      // 6. Only now: drop the temporary object.
      const { error: rmErr } = await supabase.storage.from(BUCKET).remove([temporaryPath]);
      if (rmErr) {
        console.error("confirmSessionFiles: temp removal failed", temporaryPath, rmErr);
        await recordDeleteFailure(supabase, {
          id: row.id,
          attempts: 0,
          message: rmErr.message,
          markFailed: false,
        });
      } else {
        await supabase
          .from("uploaded_files")
          .update({
            temporary_storage_path: null,
            delete_attempts: 0,
            last_delete_error: null,
            next_delete_retry_at: null,
          })
          .eq("id", row.id);
      }

      confirmed.push({
        storage_path: finalPath,
        original_filename: row.original_filename,
        mime_type: row.mime_type ?? "application/octet-stream",
        size_bytes: Number(row.size_bytes ?? 0),
      });
    } catch (err) {
      console.error("confirmSessionFiles: file confirmation failed", err);
      // Roll back: remove the orphan final object, release the claim.
      if (finalCreated) {
        await supabase.storage
          .from(BUCKET)
          .remove([finalPath])
          .then(
            () => undefined,
            () => undefined,
          );
      }
      await supabase
        .from("uploaded_files")
        .update({ status: "temporary", storage_path: temporaryPath })
        .eq("id", row.id)
        .eq("status", "confirming")
        .then(
          () => undefined,
          () => undefined,
        );
    }
  }

  return confirmed;
}

export interface PurgeResult {
  scanned: number;
  deleted: number;
  failed: number;
  residues: number;
  reservations: number;
}

interface PurgeRow {
  id: string;
  storage_path: string;
  temporary_storage_path: string | null;
  status: string;
  delete_attempts: number | null;
}

/**
 * Reclaim abandoned uploads. Handles expired reservations, abandoned temporary
 * files, retried delete_failed rows and leftover temporary objects of already
 * confirmed files. 'confirming' and final objects are never touched.
 */
export async function purgeExpiredTemporaryFiles(
  supabase: SupabaseClient<any, any>,
  options?: { retentionHours?: number; limit?: number },
): Promise<PurgeResult> {
  const retentionHours = options?.retentionHours ?? TEMP_RETENTION_HOURS;
  const limit = Math.min(Math.max(options?.limit ?? 100, 1), 200);
  const cutoff = new Date(Date.now() - retentionHours * 60 * 60 * 1000).toISOString();
  const nowIso = new Date().toISOString();
  const cols = "id, storage_path, temporary_storage_path, status, delete_attempts";

  const [abandoned, retryable, expiredReservations, residues] = await Promise.all([
    supabase
      .from("uploaded_files")
      .select(cols)
      .eq("status", "temporary")
      .lt("created_at", cutoff)
      .order("created_at", { ascending: true })
      .limit(limit),
    supabase
      .from("uploaded_files")
      .select(cols)
      .eq("status", "delete_failed")
      .lt("delete_attempts", MAX_DELETE_ATTEMPTS)
      .lte("next_delete_retry_at", nowIso)
      .limit(limit),
    supabase
      .from("uploaded_files")
      .select(cols)
      .in("status", ["reserved", "uploading", "upload_failed"])
      .lt("reservation_expires_at", nowIso)
      .limit(limit),
    supabase
      .from("uploaded_files")
      .select(cols)
      .eq("status", "confirmed")
      .not("temporary_storage_path", "is", null)
      .lt("delete_attempts", MAX_DELETE_ATTEMPTS)
      .or(`next_delete_retry_at.is.null,next_delete_retry_at.lte.${nowIso}`)
      .limit(limit),
  ]);

  for (const r of [abandoned, retryable, expiredReservations, residues]) {
    if (r.error) throw new Error(`Purge lookup failed: ${r.error.message}`);
  }

  let deleted = 0;
  let failed = 0;
  let residueCleared = 0;
  let reservationsCleared = 0;

  const claimable = [
    ...((abandoned.data ?? []) as PurgeRow[]),
    ...((retryable.data ?? []) as PurgeRow[]),
    ...((expiredReservations.data ?? []) as PurgeRow[]),
  ];

  for (const row of claimable) {
    const { data: claimed } = await supabase
      .from("uploaded_files")
      .update({ status: "deleting" })
      .eq("id", row.id)
      .eq("status", row.status)
      .select("id, storage_path, delete_attempts")
      .maybeSingle();
    if (!claimed) continue;

    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([claimed.storage_path]);
    if (rmErr) {
      failed += 1;
      console.error("purge: storage delete failed", claimed.storage_path, rmErr);
      await recordDeleteFailure(supabase, {
        id: claimed.id,
        attempts: Number(claimed.delete_attempts ?? 0),
        message: rmErr.message,
        markFailed: true,
      });
      continue;
    }
    await supabase
      .from("uploaded_files")
      .update({
        status: "deleted",
        deleted_at: new Date().toISOString(),
        temporary_storage_path: null,
        next_delete_retry_at: null,
        last_delete_error: null,
      })
      .eq("id", claimed.id);
    deleted += 1;
    if (["reserved", "uploading", "upload_failed"].includes(row.status)) reservationsCleared += 1;
  }

  // Leftover temporary objects of confirmed files: only the temporary path.
  for (const row of (residues.data ?? []) as PurgeRow[]) {
    const tempPath = row.temporary_storage_path;
    if (!tempPath || tempPath === row.storage_path) continue;
    const { error: rmErr } = await supabase.storage.from(BUCKET).remove([tempPath]);
    if (rmErr) {
      failed += 1;
      await recordDeleteFailure(supabase, {
        id: row.id,
        attempts: Number(row.delete_attempts ?? 0),
        message: rmErr.message,
        markFailed: false,
      });
      continue;
    }
    await supabase
      .from("uploaded_files")
      .update({
        temporary_storage_path: null,
        delete_attempts: 0,
        last_delete_error: null,
        next_delete_retry_at: null,
      })
      .eq("id", row.id)
      .eq("status", "confirmed");
    residueCleared += 1;
  }

  return {
    scanned: claimable.length + (residues.data?.length ?? 0),
    deleted,
    failed,
    residues: residueCleared,
    reservations: reservationsCleared,
  };
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
