// Server-only shared primitives for commercial documents (invoices & quotes).
// Both PDFs are produced by the same renderer so they share identity, header,
// table, totals and footer layout. Only labels/meta/legal differ — no business
// or legal sentence is hardcoded here (see document-config.server.ts).
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "@cantoo/pdf-lib";
import type { ArtisanInfo } from "./artisan.server";

export type { ArtisanInfo };

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
  /** Label above the client identity block, e.g. "Facturé à". */
  clientBlockLabel: string;
  /** Short type label used on continuation pages, e.g. "Facture". */
  documentTypeLabel?: string;
  /** Suffix used on continuation pages, default "(suite)". */
  continuationLabel?: string;
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
  /** Show a signature area (quotes). */
  signatureBlock?: boolean;
  /** Label of the signature area; required when signatureBlock is set. */
  signatureLabel?: string;
}

// ---------------------------------------------------------------------------
// Rendering context
// ---------------------------------------------------------------------------

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 40;
const BOTTOM = 50;

const COLORS = {
  navy: rgb(0.12, 0.16, 0.22),
  teal: rgb(0.11, 0.64, 0.68),
  muted: rgb(0.4, 0.45, 0.5),
  border: rgb(0.85, 0.87, 0.9),
  black: rgb(0, 0, 0),
  white: rgb(1, 1, 1),
  tableHead: rgb(0.96, 0.97, 0.98),
};

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  font: PDFFont;
  bold: PDFFont;
  width: number;
  height: number;
  params: RenderDocumentParams;
  cols: ReturnType<typeof buildCols>;
}

function buildCols(width: number) {
  return {
    type: M,
    desc: M + 70,
    qty: width - M - 210,
    pu: width - M - 160,
    tva: width - M - 90,
    ttc: width - M - 55,
  };
}

function draw(
  ctx: Ctx,
  text: string,
  x: number,
  yy: number,
  opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {},
) {
  ctx.page.drawText(sanitize(text), {
    x,
    y: yy,
    size: opts.size ?? 10,
    font: opts.font ?? ctx.font,
    color: opts.color ?? COLORS.black,
  });
}

/** Remaining vertical space above the bottom margin. */
function remaining(ctx: Ctx): number {
  return ctx.y - BOTTOM;
}

/** Start a fresh continuation page with a discreet document reminder. */
function addContinuationPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([PAGE_W, PAGE_H]);
  ctx.y = ctx.height - M;
  const { documentTypeLabel, title, documentNumber, continuationLabel } = ctx.params;
  const label = `${documentTypeLabel ?? title} N° ${documentNumber} — ${continuationLabel ?? "(suite)"}`;
  draw(ctx, label, M, ctx.y, { size: 9, color: COLORS.muted });
  ctx.y -= 12;
  ctx.page.drawLine({
    start: { x: M, y: ctx.y },
    end: { x: ctx.width - M, y: ctx.y },
    thickness: 0.5,
    color: COLORS.border,
  });
  ctx.y -= 18;
}

/** Ensure `h` points are available, otherwise break to a new page. */
function ensureSpace(ctx: Ctx, h: number): void {
  if (remaining(ctx) < h) addContinuationPage(ctx);
}

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

function drawPageHeader(ctx: Ctx): void {
  const { artisan, title, documentNumber, metaLines } = ctx.params;
  draw(ctx, artisan.company, M, ctx.y, { font: ctx.bold, size: 18, color: COLORS.navy });
  ctx.y -= 22;
  draw(ctx, artisan.fullName, M, ctx.y, { size: 10, color: COLORS.muted });
  ctx.y -= 14;
  for (const line of artisan.address.split("\n")) {
    draw(ctx, line, M, ctx.y, { size: 10, color: COLORS.muted });
    ctx.y -= 12;
  }
  draw(ctx, `Tél. ${artisan.phone}  ·  ${artisan.email}`, M, ctx.y, {
    size: 10,
    color: COLORS.muted,
  });
  ctx.y -= 12;
  draw(ctx, artisan.siret, M, ctx.y, { size: 10, color: COLORS.muted });

  // Right-hand title block
  const rx = ctx.width - M - 140;
  let ry = ctx.height - M;
  draw(ctx, title, rx, ry, { font: ctx.bold, size: 22, color: COLORS.teal });
  ry -= 26;
  draw(ctx, `N° ${documentNumber}`, rx, ry, { font: ctx.bold, size: 11, color: COLORS.navy });
  for (const meta of metaLines) {
    ry -= 14;
    draw(ctx, meta, rx, ry, { size: 10, color: COLORS.muted });
  }

  ctx.y = Math.min(ctx.y, ry) - 30;
  ctx.page.drawLine({
    start: { x: M, y: ctx.y },
    end: { x: ctx.width - M, y: ctx.y },
    thickness: 0.5,
    color: COLORS.border,
  });
  ctx.y -= 20;
}

function drawClientBlock(ctx: Ctx): void {
  const { client, clientBlockLabel, notice } = ctx.params;
  draw(ctx, clientBlockLabel, M, ctx.y, { font: ctx.bold, size: 11, color: COLORS.navy });
  ctx.y -= 14;
  draw(ctx, client.name, M, ctx.y, { size: 11, font: ctx.bold });
  ctx.y -= 13;
  const addrWidth = ctx.width - 2 * M - 180;
  for (const raw of client.address.split("\n")) {
    for (const line of wrapByWidth(raw, ctx.font, 10, addrWidth)) {
      draw(ctx, line, M, ctx.y, { size: 10 });
      ctx.y -= 12;
    }
  }
  draw(ctx, client.email, M, ctx.y, { size: 10, color: COLORS.muted });
  ctx.y -= 12;
  if (client.phone) {
    draw(ctx, client.phone, M, ctx.y, { size: 10, color: COLORS.muted });
    ctx.y -= 12;
  }
  ctx.y -= 14;

  if (notice) {
    const lines = wrapByWidth(notice, ctx.bold, 9, ctx.width - 2 * M);
    ensureSpace(ctx, lines.length * 12 + 6);
    for (const line of lines) {
      draw(ctx, line, M, ctx.y, { size: 9, font: ctx.bold, color: COLORS.teal });
      ctx.y -= 12;
    }
    ctx.y -= 6;
  }
}

function drawTableHeader(ctx: Ctx): void {
  const c = ctx.cols;
  ctx.page.drawRectangle({
    x: M,
    y: ctx.y - 4,
    width: ctx.width - 2 * M,
    height: 20,
    color: COLORS.tableHead,
  });
  const th = ctx.y + 4;
  draw(ctx, "Type", c.type + 4, th, { font: ctx.bold, size: 9, color: COLORS.navy });
  draw(ctx, "Description", c.desc + 4, th, { font: ctx.bold, size: 9, color: COLORS.navy });
  draw(ctx, "Qté", c.qty, th, { font: ctx.bold, size: 9, color: COLORS.navy });
  draw(ctx, "PU HT", c.pu, th, { font: ctx.bold, size: 9, color: COLORS.navy });
  draw(ctx, "TVA", c.tva, th, { font: ctx.bold, size: 9, color: COLORS.navy });
  draw(ctx, "TTC", c.ttc, th, { font: ctx.bold, size: 9, color: COLORS.navy });
  ctx.y -= 22;
}

function drawDocumentLine(ctx: Ctx, l: DocumentLine): void {
  const c = ctx.cols;
  const descWidth = c.qty - c.desc - 12;
  const descLines = wrapByWidth(l.description || "-", ctx.font, 9, descWidth);
  const rowH = Math.max(14, descLines.length * 12) + 10;

  // Never split a row across pages: break first, then redraw table header.
  if (remaining(ctx) < rowH) {
    addContinuationPage(ctx);
    drawTableHeader(ctx);
  }

  const ht = l.unit_price_ht * l.quantity;
  const ttc = ht * (1 + l.tva / 100);
  draw(ctx, l.type, c.type + 4, ctx.y, { size: 9 });
  descLines.forEach((dl, i) => draw(ctx, dl, c.desc + 4, ctx.y - i * 12, { size: 9 }));
  draw(ctx, String(l.quantity), c.qty, ctx.y, { size: 9 });
  draw(ctx, formatEUR(l.unit_price_ht), c.pu, ctx.y, { size: 9 });
  draw(ctx, `${l.tva}%`, c.tva, ctx.y, { size: 9 });
  draw(ctx, formatEUR(round2(ttc)), c.ttc, ctx.y, { size: 9 });
  ctx.y -= Math.max(14, descLines.length * 12) + 4;
  ctx.page.drawLine({
    start: { x: M, y: ctx.y + 2 },
    end: { x: ctx.width - M, y: ctx.y + 2 },
    thickness: 0.3,
    color: COLORS.border,
  });
  ctx.y -= 6;
}

function drawTotalsBlock(ctx: Ctx): void {
  const t = ctx.params.totals;
  // Height: Total HT + one row per TVA rate + Total TVA + highlighted TTC box.
  const h = 14 * (2 + t.tvaByRate.length) + 28;
  ensureSpace(ctx, h + 10);
  ctx.y -= 10;

  const totX = ctx.width - M - 220;
  const valX = ctx.width - M - 55;
  draw(ctx, "Total HT", totX, ctx.y, { size: 10, color: COLORS.muted });
  draw(ctx, formatEUR(t.totalHT), valX, ctx.y, { size: 10 });
  ctx.y -= 14;
  for (const r of t.tvaByRate) {
    draw(ctx, `TVA ${r.rate}% (base ${formatEUR(r.base)})`, totX, ctx.y, {
      size: 10,
      color: COLORS.muted,
    });
    draw(ctx, formatEUR(r.amount), valX, ctx.y, { size: 10 });
    ctx.y -= 14;
  }
  draw(ctx, "Total TVA", totX, ctx.y, { size: 10, color: COLORS.muted });
  draw(ctx, formatEUR(t.totalTVA), valX, ctx.y, { size: 10 });
  ctx.y -= 14;
  ctx.page.drawRectangle({
    x: totX - 6,
    y: ctx.y - 6,
    width: valX - totX + 60,
    height: 22,
    color: COLORS.teal,
  });
  draw(ctx, "Total TTC", totX, ctx.y, { font: ctx.bold, size: 11, color: COLORS.white });
  draw(ctx, formatEUR(t.totalTTC), valX, ctx.y, { font: ctx.bold, size: 11, color: COLORS.white });
  ctx.y -= 40;
}

function drawNotesBlock(ctx: Ctx): void {
  const notes = ctx.params.notes;
  if (!notes || !notes.trim()) return;
  const maxW = ctx.width - 2 * M;
  const paragraphs = notes
    .split("\n")
    .flatMap((raw) => (raw.trim() ? wrapByWidth(raw, ctx.font, 9, maxW) : [""]));

  // Keep the title with at least its first two lines.
  ensureSpace(ctx, 14 + Math.min(paragraphs.length, 2) * 11);
  draw(ctx, "Notes et conditions particulières", M, ctx.y, {
    font: ctx.bold,
    size: 10,
    color: COLORS.navy,
  });
  ctx.y -= 14;
  for (const line of paragraphs) {
    ensureSpace(ctx, 11);
    draw(ctx, line, M, ctx.y, { size: 9, color: COLORS.muted });
    ctx.y -= 11;
  }
  ctx.y -= 12;
}

function drawFooterBlock(ctx: Ctx): void {
  const { artisan, footerLines, legal } = ctx.params;
  const maxW = ctx.width - 2 * M;
  const legalLines = wrapByWidth(legal, ctx.font, 8, maxW);
  const firstChunk =
    16 + (footerLines?.length ?? 0) * 12 + (artisan.iban ? 12 : 0) + Math.min(legalLines.length, 2) * 10;
  ensureSpace(ctx, firstChunk);

  ctx.page.drawLine({
    start: { x: M, y: ctx.y },
    end: { x: ctx.width - M, y: ctx.y },
    thickness: 0.5,
    color: COLORS.border,
  });
  ctx.y -= 16;
  for (const line of footerLines ?? []) {
    for (const l of wrapByWidth(line, ctx.font, 9, maxW)) {
      ensureSpace(ctx, 12);
      draw(ctx, l, M, ctx.y, { size: 9, color: COLORS.muted });
      ctx.y -= 12;
    }
  }
  if (artisan.iban) {
    const ibanText = `IBAN : ${artisan.iban}${artisan.bic ? `  ·  BIC : ${artisan.bic}` : ""}`;
    for (const l of wrapByWidth(ibanText, ctx.font, 9, maxW)) {
      ensureSpace(ctx, 12);
      draw(ctx, l, M, ctx.y, { size: 9, color: COLORS.muted });
      ctx.y -= 12;
    }
  }
  for (const line of legalLines) {
    ensureSpace(ctx, 10);
    draw(ctx, line, M, ctx.y, { size: 8, color: COLORS.muted });
    ctx.y -= 10;
  }
}

function drawSignatureBlock(ctx: Ctx): void {
  if (!ctx.params.signatureBlock) return;
  const label = ctx.params.signatureLabel ?? "Date et signature du client :";
  // Whole block (label + 46pt box) must fit on one page.
  ensureSpace(ctx, 14 + 6 + 46 + 10);
  ctx.y -= 14;
  draw(ctx, label, M, ctx.y, { size: 9, font: ctx.bold, color: COLORS.navy });
  ctx.y -= 6;
  ctx.page.drawRectangle({
    x: M,
    y: ctx.y - 46,
    width: 240,
    height: 46,
    borderColor: COLORS.border,
    borderWidth: 0.7,
  });
  ctx.y -= 52;
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function renderDocumentPdf(
  params: RenderDocumentParams,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const { width, height } = page.getSize();

  const ctx: Ctx = {
    doc,
    page,
    y: height - M,
    font,
    bold,
    width,
    height,
    params,
    cols: buildCols(width),
  };

  drawPageHeader(ctx);
  drawClientBlock(ctx);
  ensureSpace(ctx, 60);
  drawTableHeader(ctx);
  for (const line of params.lines) drawDocumentLine(ctx, line);
  drawTotalsBlock(ctx);
  drawNotesBlock(ctx);
  drawFooterBlock(ctx);
  drawSignatureBlock(ctx);

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

/**
 * Wrap text using the real glyph widths of the target font, so nothing can
 * overflow the page. Very long words without spaces are hard-split.
 */
export function wrapByWidth(
  text: string,
  font: PDFFont,
  size: number,
  maxWidth: number,
): string[] {
  const measure = (s: string) => font.widthOfTextAtSize(sanitize(s), size);
  const out: string[] = [];
  let cur = "";

  const pushWordChunks = (word: string) => {
    let chunk = "";
    for (const ch of word) {
      if (measure(chunk + ch) > maxWidth && chunk) {
        out.push(chunk);
        chunk = ch;
      } else {
        chunk += ch;
      }
    }
    cur = chunk;
  };

  for (const word of text.split(/\s+/).filter(Boolean)) {
    const candidate = cur ? `${cur} ${word}` : word;
    if (measure(candidate) <= maxWidth) {
      cur = candidate;
      continue;
    }
    if (cur) {
      out.push(cur);
      cur = "";
    }
    if (measure(word) <= maxWidth) {
      cur = word;
    } else {
      pushWordChunks(word);
    }
  }
  if (cur) out.push(cur);
  return out.length ? out : [""];
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
