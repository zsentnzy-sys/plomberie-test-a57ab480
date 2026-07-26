// Server-only shared primitives for commercial documents (invoices & quotes).
// Both PDFs are produced by the same renderer so they share identity, header,
// table, totals and footer layout. Only labels/meta/legal differ.
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "@cantoo/pdf-lib";

export type DocumentLineType = "Service" | "Matériel" | "Taux horaire";
export const TVA_RATES = [0, 5.5, 10, 20] as const;
export type TvaRate = (typeof TVA_RATES)[number];

export interface DocumentLine {
  type: DocumentLineType;
  description: string;
  unit_price_ht: number;
  quantity: number;
  tva: TvaRate;
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

export interface DocumentTotals {
  totalHT: number;
  totalTVA: number;
  totalTTC: number;
  tvaByRate: Array<{ rate: number; base: number; amount: number }>;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeTotals(lines: DocumentLine[]): DocumentTotals {
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

export function formatEUR(n: number): string {
  return `${n.toFixed(2).replace(".", ",")} EUR`;
}

export function formatDateFR(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Rebuild an artisan snapshot stored as jsonb into a typed object. */
export function artisanFromSnapshot(snapshot: unknown): ArtisanInfo {
  const s = (snapshot ?? {}) as Record<string, unknown>;
  return {
    company: String(s.company ?? ""),
    fullName: String(s.fullName ?? ""),
    address: String(s.address ?? ""),
    phone: String(s.phone ?? ""),
    email: String(s.email ?? ""),
    siret: String(s.siret ?? ""),
    iban: s.iban ? String(s.iban) : undefined,
    bic: s.bic ? String(s.bic) : undefined,
    legal: String(s.legal ?? ""),
  };
}

export interface DocumentClient {
  name: string;
  address: string;
  email: string;
  phone?: string;
}

export interface RenderDocumentParams {
  /** Big coloured title, e.g. "FACTURE" or "DEVIS". */
  title: string;
  documentNumber: string;
  artisan: ArtisanInfo;
  client: DocumentClient;
  /** Right-hand meta rows under the number (label already included). */
  metaLines: string[];
  lines: DocumentLine[];
  totals: DocumentTotals;
  /** Optional highlighted notice, e.g. quote/invoice distinction. */
  notice?: string;
  /** Optional free-text notes / special conditions block. */
  notes?: string;
  /** Extra footer lines drawn before the IBAN + legal block. */
  footerLines?: string[];
  /** Legal mentions specific to the document type. */
  legal: string;
  /** Show a "Bon pour accord" signature area (quotes). */
  signatureBlock?: boolean;
}

export async function renderDocumentPdf(
  params: RenderDocumentParams,
): Promise<Uint8Array> {
  const { title, documentNumber, artisan, client, metaLines, totals } = params;
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

  // ---- Header: artisan identity
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

  // ---- Header: document title block (right)
  let ry = height - M;
  draw(title, width - M - 140, ry, { font: fontBold, size: 22, color: teal });
  ry -= 26;
  draw(`N° ${documentNumber}`, width - M - 140, ry, {
    font: fontBold,
    size: 11,
    color: navy,
  });
  for (const meta of metaLines) {
    ry -= 14;
    draw(meta, width - M - 140, ry, { size: 10, color: muted });
  }

  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: border });
  y -= 20;

  // ---- Client block
  draw("Facturé à", M, y, { font: fontBold, size: 11, color: navy });
  y -= 14;
  draw(client.name, M, y, { size: 11, font: fontBold });
  y -= 13;
  for (const line of client.address.split("\n")) {
    draw(line, M, y, { size: 10 });
    y -= 12;
  }
  draw(client.email, M, y, { size: 10, color: muted });
  y -= 12;
  if (client.phone) {
    draw(client.phone, M, y, { size: 10, color: muted });
    y -= 12;
  }
  y -= 14;

  if (params.notice) {
    for (const line of wrapText(params.notice, 95)) {
      draw(line, M, y, { size: 9, font: fontBold, color: teal });
      y -= 12;
    }
    y -= 6;
  }

  // ---- Lines table
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

  for (const l of params.lines) {
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
  // ---- Totals
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

  // ---- Optional notes
  if (params.notes && params.notes.trim()) {
    if (y < 140) {
      page = doc.addPage([595.28, 841.89]);
      y = height - M;
    }
    draw("Notes et conditions particulières", M, y, {
      font: fontBold,
      size: 10,
      color: navy,
    });
    y -= 14;
    for (const raw of params.notes.split("\n")) {
      for (const line of wrapText(raw, 105)) {
        draw(line, M, y, { size: 9, color: muted });
        y -= 11;
      }
    }
    y -= 12;
  }

  // ---- Footer
  if (y < 120) {
    page = doc.addPage([595.28, 841.89]);
    y = height - M;
  }
  page.drawLine({ start: { x: M, y }, end: { x: width - M, y }, thickness: 0.5, color: border });
  y -= 16;
  for (const line of params.footerLines ?? []) {
    draw(line, M, y, { size: 9, color: muted });
    y -= 12;
  }
  if (artisan.iban) {
    draw(`IBAN : ${artisan.iban}${artisan.bic ? `  ·  BIC : ${artisan.bic}` : ""}`, M, y, {
      size: 9,
      color: muted,
    });
    y -= 12;
  }
  for (const line of wrapText(params.legal, 110)) {
    draw(line, M, y, { size: 8, color: muted });
    y -= 10;
  }

  if (params.signatureBlock) {
    y -= 14;
    draw("Bon pour accord — date et signature du client :", M, y, {
      size: 9,
      font: fontBold,
      color: navy,
    });
    y -= 6;
    page.drawRectangle({
      x: M,
      y: y - 46,
      width: 240,
      height: 46,
      borderColor: border,
      borderWidth: 0.7,
    });
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

export function wrapText(text: string, maxChars: number): string[] {
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

/** Upload a generated PDF to the private bucket (shared by invoices & quotes). */
export async function uploadDocumentPdf(
  path: string,
  bytes: Uint8Array,
): Promise<void> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { error } = await supabaseAdmin.storage
    .from("request-attachments")
    .upload(path, bytes, { contentType: "application/pdf", upsert: true });
  if (error) throw new Error(error.message);
}
