export type HistoryStatusTone = "neutral" | "error";

export interface HistoryStatusLine {
  label: string;
  tone: HistoryStatusTone;
}

export interface FacturxHistoryStatus {
  runtime: HistoryStatusLine;
  generator: HistoryStatusLine;
  external: HistoryStatusLine;
}

interface FacturxHistoryStatusInput {
  runtimeValidationStatus?: string | null;
  generatorQualificationStatus?: string | null;
  externalValidationStatus?: string | null;
  validationSummary?: string | null;
}

export function buildFacturxHistoryStatus(
  input: FacturxHistoryStatusInput,
): FacturxHistoryStatus {
  const runtime = input.runtimeValidationStatus ?? "pending";

  const runtimeLine: HistoryStatusLine =
    runtime === "passed"
      ? {
          label: "Auto-contrôles réussis",
          tone: "neutral",
        }
      : runtime === "failed"
        ? {
            label:
              `Auto-contrôles en échec : ` +
              `${input.validationSummary ?? "erreur interne"}`,
            tone: "error",
          }
        : runtime === "not_applicable"
          ? {
              label: "Auto-contrôles non applicables",
              tone: "neutral",
            }
          : {
              label: "Auto-contrôles en attente",
              tone: "neutral",
            };

  const generatorLine: HistoryStatusLine =
    input.generatorQualificationStatus === "qualified"
      ? {
          label: "Moteur qualifié en CI",
          tone: "neutral",
        }
      : input.generatorQualificationStatus ===
          "qualification_failed"
        ? {
            label: "Qualification du moteur en échec",
            tone: "error",
          }
        : {
            label: "Moteur non qualifié",
            tone: "neutral",
          };

  const externalLine: HistoryStatusLine =
    input.externalValidationStatus === "valid"
      ? {
          label: "Validation externe réussie",
          tone: "neutral",
        }
      : input.externalValidationStatus === "invalid"
        ? {
            label: "Validation externe échouée",
            tone: "error",
          }
        : input.externalValidationStatus === "not_applicable"
          ? {
              label: "Validation externe non applicable",
              tone: "neutral",
            }
          : {
              label: "Validation externe non exécutée",
              tone: "neutral",
            };

  return {
    runtime: runtimeLine,
    generator: generatorLine,
    external: externalLine,
  };
}