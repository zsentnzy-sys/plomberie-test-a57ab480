// Server-only helpers for invoice PDF generation.
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";

export type InvoiceLineType = "Service" | "Matériel" | "Taux horaire";
export type PaymentMethod =
  | "Carte bancaire"
  | "Virement bancaire"
  | "Chèque"
  | "Espèces";
export const TVA_RATES = [0, 5.5, 10, 20] as const;
export type TvaRate = (typeof TVA_RATES)[number];

export interface InvoiceLine {
  type: InvoiceLineType;
  description: string;
  unit_price_ht: number;
  quantity: number;
  tva: TvaRate;
}

export interface InvoiceInput {
  client_name: string;
  client_address: string;
  client_email: string;
  client_phone?: string;
  payment_method: PaymentMethod;
  invoice_date: string; // ISO YYYY-MM-DD
  lines: InvoiceLine[];
}

export interface ArtisanInfo {
  company: string;
  fullName: string;
  address: string;
  phone: string;
  email: string;
  siret: string;
  iban?: string;
  bic?: string;
  legal: string;
}

export interface InvoiceTotals {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  tvaByRate: Array<{ rate: number; base: number; amount: number }>;
}

export function computeTotals(lines: InvoiceLine[]): InvoiceTotals {
  const byRate = new Map<number, { base: number; amount: number }>();
  let totalHT = 0;
  for (const l of lines) {
    const ht = l.unit_price_ht * l.quantity;
    const tva = ht * (l.tva / 100);
    totalHT += ht;
    const entry = byRate.get(l.tva) ?? { base: 0, amount: 0 };
    entry.base += ht;
    entry.amount += tva;
    byRate.set(l.tva, entry);
  }
  const tvaByRate = Array.from(byRate.entries())
    .map(([rate, v]) => ({ rate, base: round2(v.base), amount: round2(v.amount) }))
    .sort((a, b) => a.rate - b.rate);
  const totalTVA = tvaByRate.reduce((s, r) => s + r.amount, 0);
  return {
    totalHT: round2(totalHT),
    totalTVA: round2(totalTVA),
    totalTTC: round2(totalHT + totalTVA),
    tvaByRate,
  };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatEUR(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} EUR`;
}

export function formatDateFR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export async function generateInvoicePdf(params: {
  invoiceNumber: string;
  artisan: ArtisanInfo;
  input: InvoiceInput;
  totals: InvoiceTotals;
}): Promise<Uint8Array> {
  const { invoiceNumber, artisan, input, totals } = params;
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  let page = doc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  const M = 40;
  let y = height - M;

  const navy = rgb(0.12, 0.16, 0.22);
  const teal = rgb(0.11, 0.64, 0.68);
  const muted = rgb(0.4, 0.45, 0.5);
  const border = rgb(0.85, 0.87, 0.9);
  const black = rgb(0, 0, 0);

  const draw = (
    text: string,
    x: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {},
  ) => {
    page.drawText(sanitize(text), {
      x,
      y: yy,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: opts.color ?? black,
    });
  };

  // Header — artisan
  draw(artisan.company, M, y, { font: fontBold, size: 18, color: navy });
  y -= 22;
  draw(artisan.fullName, M, y, { size: 10, color: muted });
  y -= 14;
  for (const line of artisan.address.split("\n")) {
    draw(line, M, y, { size: 10, color: muted });
    y -= 12;
  }
  draw(`Tél. ${artisan.phone}  ·  ${artisan.email}`, M, y, { size: 10, color: muted });
  y -= 12;
  draw(artisan.siret, M, y, { size: 10, color: muted });

  // Invoice title block (right)
  let ry = height - M;
  draw("FACTURE", width - M - 140, ry, { font: fontBold, size: 22, color: teal });
  ry -= 26;
  draw(`N° ${invoiceNumber}`, width - M - 140, ry, { font: fontBold, size: 11, color: navy });
  ry -= 14;
  draw(`Date : ${formatDateFR(input.invoice_date)}`, width - M - 140, ry, { size: 10, color: muted });
  ry -= 12;
  draw(`Paiement : ${input.payment_method}`, width - M - 140, ry, { size: 10, color: muted });

  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: border });
  y -= 20;

  // Client block
  draw("Facturé à", M, y, { font: fontBold, size: 11, color: navy });
  y -= 14;
  draw(input.client_name, M, y, { size: 11, font: fontBold });
  y -= 13;
  for (const line of input.client_address.split("\n")) {
    draw(line, M, y, { size: 10 });
    y -= 12;
  }
  draw(input.client_email, M, y, { size: 10, color: muted });
  y -= 12;
  if (input.client_phone) {
    draw(input.client_phone, M, y, { size: 10, color: muted });
    y -= 12;
  }
  y -= 14;

  // Table header
  const cols = {
    type: M,
    desc: M + 70,
    qty: width - M - 210,
    pu: width - M - 160,
    tva: width - M - 90,
    ttc: width - M - 55,
  };
  page.drawRectangle({
    x: M,
    y: y - 4,
    width: width - 2 * M,
    height: 20,
    color: rgb(0.96, 0.97, 0.98),
  });
  const th = y + 4;
  draw("Type", cols.type + 4, th, { font: fontBold, size: 9, color: navy });
  draw("Description", cols.desc + 4, th, { font: fontBold, size: 9, color: navy });
  draw("Qté", cols.qty, th, { font: fontBold, size: 9, color: navy });
  draw("PU HT", cols.pu, th, { font: fontBold, size: 9, color: navy });
  draw("TVA", cols.tva, th, { font: fontBold, size: 9, color: navy });
  draw("TTC", cols.ttc, th, { font: fontBold, size: 9, color: navy });
  y -= 22;

  // Table lines
  for (const l of input.lines) {
    if (y < 150) {
      page = doc.addPage([595.28, 841.89]);
      y = height - M;
    }
    const ht = l.unit_price_ht * l.quantity;
    const ttc = ht * (1 + l.tva / 100);
    const descLines = wrapText(l.description || "-", 55);
    const rowH = Math.max(14, descLines.length * 12);
    draw(l.type, cols.type + 4, y, { size: 9 });
    descLines.forEach((dl, i) => draw(dl, cols.desc + 4, y - i * 12, { size: 9 }));
    draw(String(l.quantity), cols.qty, y, { size: 9 });
    draw(formatEUR(l.unit_price_ht), cols.pu, y, { size: 9 });
    draw(`${l.tva}%`, cols.tva, y, { size: 9 });
    draw(formatEUR(round2(ttc)), cols.ttc, y, { size: 9 });
    y -= rowH + 4;
    page.drawLine({
      start: { x: M, y: y + 2 },
      end: { x: width - M, y: y + 2 },
      thickness: 0.3,
      color: border,
    });
    y -= 6;
  }

  y -= 10;
  // Totals
  const totX = width - M - 220;
  const valX = width - M - 55;
  draw("Total HT", totX, y, { size: 10, color: muted });
  draw(formatEUR(totals.totalHT), valX, y, { size: 10 });
  y -= 14;
  for (const r of totals.tvaByRate) {
    draw(`TVA ${r.rate}% (base ${formatEUR(r.base)})`, totX, y, { size: 10, color: muted });
    draw(formatEUR(r.amount), valX, y, { size: 10 });
    y -= 14;
  }
  draw("Total TVA", totX, y, { size: 10, color: muted });
  draw(formatEUR(totals.totalTVA), valX, y, { size: 10 });
  y -= 14;
  page.drawRectangle({
    x: totX - 6,
    y: y - 6,
    width: valX - totX + 60,
    height: 22,
    color: rgb(0.11, 0.64, 0.68),
  });
  draw("Total TTC", totX, y, { font: fontBold, size: 11, color: rgb(1, 1, 1) });
  draw(formatEUR(totals.totalTTC), valX, y, { font: fontBold, size: 11, color: rgb(1, 1, 1) });
  y -= 40;

  // Footer
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: border });
  y -= 16;
  draw(`Mode de paiement : ${input.payment_method}`, M, y, { size: 9, color: muted });
  y -= 12;
  if (artisan.iban) {
    draw(`IBAN : ${artisan.iban}${artisan.bic ? `  ·  BIC : ${artisan.bic}` : ""}`, M, y, {
      size: 9,
      color: muted,
    });
    y -= 12;
  }
  for (const line of wrapText(artisan.legal, 110)) {
    draw(line, M, y, { size: 8, color: muted });
    y -= 10;
  }

  return await doc.save();
}

// pdf-lib Helvetica only supports WinAnsi. Replace common non-encodable chars.
function sanitize(s: string): string {
  return s
    .replace(/\u2019/g, "'")
    .replace(/\u2013|\u2014/g, "-")
    .replace(/\u00A0/g, " ")
    .replace(/\u2022/g, "·");
}

function wrapText(text: string, maxChars: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars) {
      if (cur) lines.push(cur);
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
  }
  if (cur) lines.push(cur);
  return lines.length ? lines : [""];
}

// Reference to satisfy TS unused-import if PDFPage tree-shaken.
export type _KeepPage = PDFPage;