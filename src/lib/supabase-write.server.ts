interface SupabaseLikeError {
  message?: string;
  code?: string;
}

/**
 * Converts a failed Supabase write into a controlled server-side exception.
 *
 * Raw database details are logged server-side but are never included in the
 * exception message that may reach an application boundary.
 */
export function assertSupabaseWriteSucceeded(
  error: SupabaseLikeError | null | undefined,
  operation: string,
): void {
  if (!error) return;

  console.error("[Supabase write failed]", {
    operation,
    code: error.code ?? "unknown",
    message: error.message ?? "unknown error",
  });

  throw new Error(`Échec de ${operation}.`);
}