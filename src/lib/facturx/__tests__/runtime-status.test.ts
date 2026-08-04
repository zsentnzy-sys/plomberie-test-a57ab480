import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

import {
  buildRuntimeStatusUpdate,
  persistRuntimeStatus,
  tryPersistRuntimeFailure,
  SEND_STATE_COLUMNS,
  RUNTIME_STATUS_COLUMNS,
  type RuntimeStatusUpdate,
} from "../runtime-status.server";

const ok = async () => ({ error: null });

describe("buildRuntimeStatusUpdate", () => {
  it("ouvre le cycle en pending sans jamais qualifier le générateur", () => {
    const update = buildRuntimeStatusUpdate("pending");
    expect(update.runtime_validation_status).toBe("pending");
    expect(update.generator_qualification_status).toBe("unqualified");
    expect(update.external_validation_status).toBe("not_run");
    expect(update.facturx_validation_errors).toBeNull();
  });

  it("conserve unqualified / not_run en cas de succès", () => {
    const update = buildRuntimeStatusUpdate("passed");
    expect(update.runtime_validation_status).toBe("passed");
    expect(update.generator_qualification_status).toBe("unqualified");
    expect(update.external_validation_status).toBe("not_run");
  });

  it("enregistre les erreurs en cas d'échec", () => {
    const update = buildRuntimeStatusUpdate("failed", ["montants incohérents"]);
    expect(update.runtime_validation_status).toBe("failed");
    expect(update.facturx_validation_errors).toEqual(["montants incohérents"]);
    expect(update.generator_qualification_status).toBe("unqualified");
  });

  it("ne touche jamais aux colonnes d'envoi", () => {
    for (const status of ["pending", "passed", "failed"] as const) {
      const keys = Object.keys(buildRuntimeStatusUpdate(status, ["x"]));
      for (const forbidden of SEND_STATE_COLUMNS) {
        expect(keys).not.toContain(forbidden);
      }
      expect(keys.sort()).toEqual([...RUNTIME_STATUS_COLUMNS].sort());
    }
  });
});

describe("persistRuntimeStatus", () => {
  it("écrit le statut initial pending", async () => {
    const writes: RuntimeStatusUpdate[] = [];
    await persistRuntimeStatus(async (u) => {
      writes.push(u);
      return { error: null };
    }, "pending");

    expect(writes).toHaveLength(1);
    expect(writes[0].runtime_validation_status).toBe("pending");
  });

  it("échoue explicitement quand l'écriture est rejetée", async () => {
    await expect(
      persistRuntimeStatus(
        async () => ({ error: { message: "permission denied", code: "42501" } }),
        "pending",
      ),
    ).rejects.toThrow("l’enregistrement des auto-contrôles Factur-X");
  });
});

describe("tryPersistRuntimeFailure", () => {
  let logs: unknown[][];

  beforeEach(() => {
    logs = [];
    vi.spyOn(console, "error").mockImplementation((...args: unknown[]) => {
      logs.push(args);
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it("persiste failed en best effort", async () => {
    const writes: RuntimeStatusUpdate[] = [];
    const outcome = await tryPersistRuntimeFailure(
      async (u) => {
        writes.push(u);
        return { error: null };
      },
      {
        invoiceId: "inv-1",
        operation: "génération Factur-X",
        cause: new Error("upload XML échoué"),
      },
      ["upload XML échoué"],
    );

    expect(outcome.persisted).toBe(true);
    expect(writes[0].runtime_validation_status).toBe("failed");
    expect(writes[0].generator_qualification_status).toBe("unqualified");
    expect(writes[0].external_validation_status).toBe("not_run");
  });

  it("journalise les deux erreurs sans relancer quand la persistance échoue", async () => {
    let calls = 0;
    const outcome = await tryPersistRuntimeFailure(
      async () => {
        calls += 1;
        return { error: { message: "db down", code: "08006" } };
      },
      {
        invoiceId: "inv-2",
        operation: "génération Factur-X",
        cause: new Error("PDF/A-3 non conforme"),
      },
    );

    expect(outcome.persisted).toBe(false);
    expect(calls).toBe(1); // pas de boucle
    const logged = JSON.stringify(logs);
    expect(logged).toContain("PDF/A-3 non conforme");
    expect(logged).toContain("db down");
  });

  it("ne propage jamais une exception de persistance", async () => {
    const outcome = await tryPersistRuntimeFailure(
      async () => {
        throw new Error("réseau indisponible");
      },
      { invoiceId: "inv-3", operation: "génération Factur-X", cause: "boom" },
    );

    expect(outcome.persisted).toBe(false);
    const logged = JSON.stringify(logs);
    expect(logged).toContain("boom");
    expect(logged).toContain("réseau indisponible");
  });
});

describe("cycle complet", () => {
  it("passe de pending à passed lors d'une génération réussie", async () => {
    const writes: RuntimeStatusUpdate[] = [];
    const write = async (u: RuntimeStatusUpdate) => {
      writes.push(u);
      return { error: null };
    };

    await persistRuntimeStatus(write, "pending");
    await persistRuntimeStatus(write, "passed");

    expect(writes.map((w) => w.runtime_validation_status)).toEqual([
      "pending",
      "passed",
    ]);
    expect(
      writes.every((w) => w.generator_qualification_status === "unqualified"),
    ).toBe(true);
  });

  it("passe de pending à failed lors d'un échec", async () => {
    const writes: RuntimeStatusUpdate[] = [];
    const write = async (u: RuntimeStatusUpdate) => {
      writes.push(u);
      return { error: null };
    };

    await persistRuntimeStatus(write, "pending");
    await tryPersistRuntimeFailure(write, {
      invoiceId: "inv-4",
      operation: "génération Factur-X",
      cause: new Error("XML invalide"),
    });

    expect(writes.map((w) => w.runtime_validation_status)).toEqual([
      "pending",
      "failed",
    ]);
  });
});