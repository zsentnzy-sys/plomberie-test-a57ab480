import { describe, expect, it } from "vitest";

import { assertSupabaseWriteSucceeded } from "../supabase-write.server";

describe("assertSupabaseWriteSucceeded", () => {
  it("does nothing when Supabase reports no error", () => {
    expect(() =>
      assertSupabaseWriteSucceeded(null, "enregistrement de test"),
    ).not.toThrow();
  });

  it("throws a safe error when Supabase reports a failure", () => {
    expect(() =>
      assertSupabaseWriteSucceeded(
        {
          message: "duplicate key value violates unique constraint",
          code: "23505",
        },
        "l’enregistrement des statuts Factur-X",
      ),
    ).toThrow(
      "Échec de l’enregistrement des statuts Factur-X.",
    );
  });

  it("does not expose the raw database message", () => {
    try {
      assertSupabaseWriteSucceeded(
        {
          message: "sensitive database details",
          code: "XX000",
        },
        "la mise à jour de la facture",
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error);

      expect(message).not.toContain("sensitive database details");
      expect(message).not.toContain("XX000");
    }
  });
});