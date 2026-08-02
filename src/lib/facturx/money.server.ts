// Single rounding policy for the whole invoicing chain: everything is computed
// in integer cents. Order: line rounding -> line VAT -> per-rate breakdown ->
// document totals. Any consumer (PDF, XML, DB) must reuse these helpers.

export function toCents(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function centsToDecimalString(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

/** Line net amount in cents: unit price (cents) x quantity, rounded once. */
export function lineNetCents(unitPriceCents: number, quantity: number): number {
  return Math.round(unitPriceCents * quantity);
}

/** VAT of an already-rounded basis, rounded to the cent. */
export function vatCents(basisCents: number, rate: number): number {
  return Math.round((basisCents * rate) / 100);
}

export interface AmountMismatch {
  field: string;
  expected: number;
  actual: number;
}

/**
 * Fail-fast comparator: any divergence between the persisted row, the common
 * data model and the rendered documents must abort generation.
 */
export function compareAmounts(
  source: string,
  expected: Record<string, number>,
  actual: Record<string, number>,
): AmountMismatch[] {
  const out: AmountMismatch[] = [];
  for (const key of Object.keys(expected)) {
    if (expected[key] !== actual[key]) {
      out.push({ field: `${source}.${key}`, expected: expected[key], actual: actual[key] });
    }
  }
  return out;
}