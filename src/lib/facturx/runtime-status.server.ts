// Server-only: lifecycle of the INTERNAL self-check statuses of an invoice.
//
// These statuses describe self-checks only.
//
// Nothing here may ever touch the send state of an invoice (status, sent_at,
// email_*_status, email_*_error) — regeneration must not alter it.

import { GENERATOR_QUALIFICATION, type GeneratorQualificationStatus } from "./facturx-config.server";

export type RuntimeSelfCheckStatus = "pending" | "passed" | "failed";

/** Columns this module is allowed to write. Anything else is a bug. */
export const RUNTIME_STATUS_COLUMNS = [
  "runtime_validation_status",
  "generator_qualification_status",
  "external_validation_status",
  "facturx_validation_errors",
  "facturx_validated_at",
] as const;

/** Columns that must NEVER appear in a runtime-status update. */
export const SEND_STATE_COLUMNS = [
  "status",
  "sent_at",
  "email_client_status",
  "email_client_error",
  "email_artisan_status",
  "email_artisan_error",
] as const;

export const FACTURX_GENERATION_USER_MESSAGE = "La génération de la facture Factur-X a échoué.";
export function buildFacturxGenerationUserError(): Error {
  return new Error(FACTURX_GENERATION_USER_MESSAGE);
}

export interface RuntimeStatusUpdate {
  runtime_validation_status: RuntimeSelfCheckStatus;
  generator_qualification_status: GeneratorQualificationStatus;
  external_validation_status: "not_run";
  facturx_validation_errors: string[] | null;
  facturx_validated_at: string;
}

/** Applies the update to the invoice row; returns the raw Supabase error. */
export type RuntimeStatusWriter = (
  update: RuntimeStatusUpdate,
) => Promise<{ error: { message?: string; code?: string } | null }>;

export interface FacturxRuntimeCycleContext {
  invoiceId: string;
  operation: string;
}

export interface FacturxRuntimeCycleOptions<T> {
  write: RuntimeStatusWriter;
  context: FacturxRuntimeCycleContext;
  execute: () => Promise<T>;
  getFailureDetails?: (error: unknown) => string[];
}

export function buildRuntimeStatusUpdate(
  status: RuntimeSelfCheckStatus,
  errors: string[] = [],
  now: string = new Date().toISOString(),
): RuntimeStatusUpdate {
  return {
    runtime_validation_status: status,
    // Qualification belongs to the generator build, not to this runtime cycle.
    generator_qualification_status:
      GENERATOR_QUALIFICATION,
    external_validation_status: "not_run",
    facturx_validation_errors: errors.length ? errors : null,
    facturx_validated_at: now,
  };
}

/**
 * Persists a runtime status and fails loudly when the write is rejected.
 * Used for the initial `pending` marker and the final `failed` marker when the
 * caller can still surface the write error.
 */
export async function persistRuntimeStatus(
  write: RuntimeStatusWriter,
  status: RuntimeSelfCheckStatus,
  errors: string[] = [],
  now?: string,
): Promise<void> {
  const { assertSupabaseWriteSucceeded } = await import(
    "@/lib/supabase-write.server"
  );
  const { error } = await write(buildRuntimeStatusUpdate(status, errors, now));
  assertSupabaseWriteSucceeded(
    error,
    "l’enregistrement des auto-contrôles Factur-X",
  );
}

/**
 * Best-effort `failed` marker used from a catch block.
 *
 * It never throws and never recurses: when the secondary write also fails,
 * both the original cause and the persistence error are logged together and
 * the caller keeps rethrowing the ORIGINAL error.
 */
export async function tryPersistRuntimeFailure(
  write: RuntimeStatusWriter,
  context: { invoiceId: string; operation: string; cause: unknown },
  errors: string[] = [],
): Promise<{ persisted: boolean }> {
  const causeMessage =
    context.cause instanceof Error
      ? context.cause.message
      : String(context.cause);

  try {
    const { error } = await write(
      buildRuntimeStatusUpdate(
        "failed",
        errors.length ? errors : [causeMessage],
      ),
    );

    if (error) {
      console.error("[Factur-X] Échec du pipeline ET de son enregistrement", {
        invoiceId: context.invoiceId,
        operation: context.operation,
        originalError: causeMessage,
        persistenceError: error.message ?? "unknown error",
        persistenceCode: error.code ?? "unknown",
      });
      return { persisted: false };
    }

    console.error("[Factur-X] Auto-contrôles en échec", {
      invoiceId: context.invoiceId,
      operation: context.operation,
      originalError: causeMessage,
      details: errors,
    });
    return { persisted: true };
  } catch (persistenceError) {
    console.error("[Factur-X] Échec du pipeline ET de son enregistrement", {
      invoiceId: context.invoiceId,
      operation: context.operation,
      originalError: causeMessage,
      persistenceError:
        persistenceError instanceof Error
          ? persistenceError.message
          : String(persistenceError),
    });
    return { persisted: false };
  }
}

/**
 * Runs the runtime self-check lifecycle around a real Factur-X operation.
 *
 * Lifecycle:
 * pending -> operation -> result
 * pending -> operation failure -> failed -> generic user error
 *
 * The original error is kept for server logs and persisted details but is
 * never returned directly to the client.
 */
export async function runFacturxRuntimeCycle<T>(
  options: FacturxRuntimeCycleOptions<T>,
): Promise<T> {
  const {
    write,
    context,
    execute,
    getFailureDetails = () => [],
  } = options;

  await persistRuntimeStatus(write, "pending");

  try {
    return await execute();
  } catch (error) {
    await tryPersistRuntimeFailure(
      write,
      {
        invoiceId: context.invoiceId,
        operation: context.operation,
        cause: error,
      },
      getFailureDetails(error),
    );

    throw buildFacturxGenerationUserError();
  }
}