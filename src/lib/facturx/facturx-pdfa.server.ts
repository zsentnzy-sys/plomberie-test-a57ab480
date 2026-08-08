// PDF/A-3B post-processing: embedded fonts, sRGB output intent, XMP metadata
// (PDF/A identification + Factur-X extension schema) and the factur-x.xml
// associated file declared at the catalog level.
import {
  AFRelationship,
  PDFArray,
  PDFDict,
  PDFDocument,
  PDFHexString,
  PDFName,
  PDFNumber,
  PDFString,
  type PDFFont,
} from "@cantoo/pdf-lib";
import fontkit from "@pdf-lib/fontkit";

import { FACTURX_CONFIG } from "./facturx-config.server";
// Fonts live in .b64 data files imported raw: a multi-hundred-KB string
// literal inside a .ts module overflows the Babel parser used by the
// TanStack transform pipeline.
import LIBERATION_SANS_REGULAR_BASE64 from "./assets/liberation-sans-regular.b64?raw";
import LIBERATION_SANS_BOLD_BASE64 from "./assets/liberation-sans-bold.b64?raw";
import { SRGB_ICC_BASE64 } from "./assets/srgb-icc";

export const PDFA_FONT_NAMES = {
  regular: "LiberationSans",
  bold: "LiberationSans-Bold",
};

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64.trim());
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Embed the Liberation fonts (metrically compatible with Helvetica). */
export async function embedPdfaFonts(
  doc: PDFDocument,
): Promise<{ font: PDFFont; bold: PDFFont }> {
  doc.registerFontkit(fontkit);
  const font = await doc.embedFont(base64ToBytes(LIBERATION_SANS_REGULAR_BASE64), {
    subset: true,
  });
  const bold = await doc.embedFont(base64ToBytes(LIBERATION_SANS_BOLD_BASE64), {
    subset: true,
  });
  return { font, bold };
}

function xmpMetadata(params: {
  title: string;
  author: string;
  createdAt: Date;
}): string {
  const iso = params.createdAt.toISOString().replace(/\.\d{3}Z$/, "Z");
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
 <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
  <rdf:Description rdf:about="" xmlns:pdfaid="http://www.aiim.org/pdfa/ns/id/">
   <pdfaid:part>${FACTURX_CONFIG.pdfaPart}</pdfaid:part>
   <pdfaid:conformance>${FACTURX_CONFIG.pdfaConformance}</pdfaid:conformance>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
   <dc:title><rdf:Alt><rdf:li xml:lang="x-default">${esc(params.title)}</rdf:li></rdf:Alt></dc:title>
   <dc:creator><rdf:Seq><rdf:li>${esc(params.author)}</rdf:li></rdf:Seq></dc:creator>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:xmp="http://ns.adobe.com/xap/1.0/">
   <xmp:CreateDate>${iso}</xmp:CreateDate>
   <xmp:ModifyDate>${iso}</xmp:ModifyDate>
   <xmp:CreatorTool>${esc(params.author)}</xmp:CreatorTool>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdf="http://ns.adobe.com/pdf/1.3/">
   <pdf:Producer>${esc(params.author)}</pdf:Producer>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:pdfaExtension="http://www.aiim.org/pdfa/ns/extension/" xmlns:pdfaSchema="http://www.aiim.org/pdfa/ns/schema#" xmlns:pdfaProperty="http://www.aiim.org/pdfa/ns/property#">
   <pdfaExtension:schemas>
    <rdf:Bag>
     <rdf:li rdf:parseType="Resource">
      <pdfaSchema:schema>Factur-X PDFA Extension Schema</pdfaSchema:schema>
      <pdfaSchema:namespaceURI>urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#</pdfaSchema:namespaceURI>
      <pdfaSchema:prefix>fx</pdfaSchema:prefix>
      <pdfaSchema:property>
       <rdf:Seq>
        <rdf:li rdf:parseType="Resource">
         <pdfaProperty:name>DocumentFileName</pdfaProperty:name>
         <pdfaProperty:valueType>Text</pdfaProperty:valueType>
         <pdfaProperty:category>external</pdfaProperty:category>
         <pdfaProperty:description>Name of the embedded XML invoice file</pdfaProperty:description>
        </rdf:li>
        <rdf:li rdf:parseType="Resource">
         <pdfaProperty:name>DocumentType</pdfaProperty:name>
         <pdfaProperty:valueType>Text</pdfaProperty:valueType>
         <pdfaProperty:category>external</pdfaProperty:category>
         <pdfaProperty:description>INVOICE</pdfaProperty:description>
        </rdf:li>
        <rdf:li rdf:parseType="Resource">
         <pdfaProperty:name>Version</pdfaProperty:name>
         <pdfaProperty:valueType>Text</pdfaProperty:valueType>
         <pdfaProperty:category>external</pdfaProperty:category>
         <pdfaProperty:description>The actual version of the Factur-X data</pdfaProperty:description>
        </rdf:li>
        <rdf:li rdf:parseType="Resource">
         <pdfaProperty:name>ConformanceLevel</pdfaProperty:name>
         <pdfaProperty:valueType>Text</pdfaProperty:valueType>
         <pdfaProperty:category>external</pdfaProperty:category>
         <pdfaProperty:description>The conformance level of the Factur-X data</pdfaProperty:description>
        </rdf:li>
       </rdf:Seq>
      </pdfaSchema:property>
     </rdf:li>
    </rdf:Bag>
   </pdfaExtension:schemas>
  </rdf:Description>
  <rdf:Description rdf:about="" xmlns:fx="urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#">
   <fx:DocumentFileName>${FACTURX_CONFIG.attachmentFileName}</fx:DocumentFileName>
   <fx:DocumentType>${FACTURX_CONFIG.xmpDocumentType}</fx:DocumentType>
   <fx:Version>${FACTURX_CONFIG.xmpVersion}</fx:Version>
   <fx:ConformanceLevel>${FACTURX_CONFIG.xmpConformanceLevel}</fx:ConformanceLevel>
  </rdf:Description>
 </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>`;
}

export interface PdfAOptions {
  invoiceNumber: string;
  producer: string;
  xml: string;
  createdAt?: Date;
}

/**
 * Turn a freshly rendered invoice PDF into a hybrid PDF/A-3B Factur-X file.
 * The visual rendering is untouched.
 */
export async function toFacturxPdfA3(
  pdfBytes: Uint8Array,
  options: PdfAOptions,
): Promise<Uint8Array> {
  const createdAt = options.createdAt ?? new Date();
  const title = `Facture ${options.invoiceNumber}`;

  // Pass 1 — attach the XML (pdf-lib embeds attachments at save time).
  const staged = await PDFDocument.load(pdfBytes, { updateMetadata: false });
  const xmlBytes = new TextEncoder().encode(options.xml);
  await staged.attach(xmlBytes, FACTURX_CONFIG.attachmentFileName, {
    mimeType: FACTURX_CONFIG.attachmentMimeType,
    description: FACTURX_CONFIG.attachmentDescription,
    afRelationship: AFRelationship.Alternative,
    creationDate: createdAt,
    modificationDate: createdAt,
  });
  staged.setTitle(title);
  staged.setAuthor(options.producer);
  staged.setProducer(options.producer);
  staged.setCreator(options.producer);
  staged.setCreationDate(createdAt);
  staged.setModificationDate(createdAt);
  const stagedBytes = await staged.save({ useObjectStreams: false });

  // Pass 2 — patch the catalog with /AF, /Metadata and the sRGB OutputIntent.
  const doc = await PDFDocument.load(stagedBytes, { updateMetadata: false });
  const ctx = doc.context;
  const catalog = doc.catalog;

  // /AF — associated files at document level (mandatory for Factur-X).
  const fileSpecRefs = collectFileSpecRefs(doc);
  if (fileSpecRefs.length === 0) {
    throw new Error("Pièce jointe factur-x.xml introuvable après génération.");
  }
  const af = ctx.obj(fileSpecRefs);
  catalog.set(PDFName.of("AF"), ctx.register(af));

  // /Metadata — uncompressed XMP packet.
  const xmp = xmpMetadata({ title, author: options.producer, createdAt });
  const metadataStream = ctx.stream(xmp, {
    Type: PDFName.of("Metadata"),
    Subtype: PDFName.of("XML"),
  });
  catalog.set(PDFName.of("Metadata"), ctx.register(metadataStream));

  // /OutputIntents — embedded sRGB ICC profile.
  const iccBytes = base64ToBytes(SRGB_ICC_BASE64);
  const iccStream = ctx.stream(iccBytes, { N: PDFNumber.of(3) });
  const iccRef = ctx.register(iccStream);
  const outputIntent = ctx.obj({
    Type: PDFName.of("OutputIntent"),
    S: PDFName.of("GTS_PDFA1"),
    OutputConditionIdentifier: PDFString.of("sRGB"),
    OutputCondition: PDFString.of("sRGB IEC61966-2.1"),
    Info: PDFString.of("sRGB IEC61966-2.1"),
    RegistryName: PDFString.of("http://www.color.org"),
    DestOutputProfile: iccRef,
  });
  catalog.set(
    PDFName.of("OutputIntents"),
    ctx.register(ctx.obj([ctx.register(outputIntent)])),
  );

  // Deterministic file identifier (PDF/A requires an /ID in the trailer).
  const idSeed = PDFHexString.of(
    Array.from(new TextEncoder().encode(`${options.invoiceNumber}${createdAt.getTime()}`))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 32)
      .padEnd(32, "0"),
  );
  ctx.trailerInfo.ID = ctx.obj([idSeed, idSeed]);

  return await doc.save({ useObjectStreams: false });
}

function collectFileSpecRefs(doc: PDFDocument) {
  const refs: ReturnType<PDFDocument["context"]["register"]>[] = [];
  const names = doc.catalog.lookupMaybe(PDFName.of("Names"), PDFDict);
  const embedded = names?.lookupMaybe(PDFName.of("EmbeddedFiles"), PDFDict);
  const array = embedded?.lookupMaybe(PDFName.of("Names"), PDFArray);
  if (!array) return refs;
  for (let i = 1; i < array.size(); i += 2) {
    const ref = array.get(i);
    if (ref) refs.push(ref as never);
  }
  return refs;
}

export interface PdfAStructureCheck {
  valid: boolean;
  errors: string[];
}

/** Structural self-checks run on every generated file before persistence. */
export async function assertPdfA3Structure(
  bytes: Uint8Array,
): Promise<PdfAStructureCheck> {
  const errors: string[] = [];
  const doc = await PDFDocument.load(bytes, { updateMetadata: false });
  const catalog = doc.catalog;

  if (!catalog.get(PDFName.of("OutputIntents"))) errors.push("OutputIntent sRGB manquant");
  if (!catalog.get(PDFName.of("Metadata"))) errors.push("Métadonnées XMP manquantes");
  if (!catalog.get(PDFName.of("AF"))) errors.push("Entrée /AF manquante");

  const attachments = await doc.getAttachments?.();
  const facturx = (attachments ?? []).find(
    (a) => a.name === FACTURX_CONFIG.attachmentFileName,
  );
  if (!facturx) errors.push("Fichier factur-x.xml non attaché");
  else if (facturx.afRelationship !== AFRelationship.Alternative)
    errors.push("AFRelationship différent de Alternative");

  const raw = new TextDecoder("latin1").decode(bytes.slice(0, bytes.length));
  const expectedXmpValues = [
    {
      label: "PDF/A part",
      pattern: /<pdfaid:part>3<\/pdfaid:part>/,
    },
    {
      label: "PDF/A conformance",
      pattern: /<pdfaid:conformance>B<\/pdfaid:conformance>/,
    },
    {
      label: "Factur-X DocumentFileName",
      pattern: /<fx:DocumentFileName>factur-x\.xml<\/fx:DocumentFileName>/,
    },
    {
      label: "Factur-X DocumentType",
      pattern: /<fx:DocumentType>INVOICE<\/fx:DocumentType>/,
    },
    {
      label: "Factur-X Version",
      pattern: /<fx:Version>1\.0<\/fx:Version>/,
    },
    {
      label: "Factur-X ConformanceLevel",
      pattern: /<fx:ConformanceLevel>EN 16931<\/fx:ConformanceLevel>/,
    },
  ];
  for (const expected of expectedXmpValues) {
    if (!expected.pattern.test(raw)) {
      errors.push(`Métadonnée XMP incorrecte ou absente : ${expected.label}`);
    }
  }

  if (/\/BaseFont\s*\/(Helvetica|Times|Courier|Symbol|ZapfDingbats)\b/.test(raw))
    errors.push("Police standard non incorporée détectée");

  return { valid: errors.length === 0, errors };
}

export interface FacturxPdfBuildResult {
  bytes: Uint8Array;
  structure: PdfAStructureCheck;
}

export async function buildFacturxPdf(
  pdfBytes: Uint8Array,
  options: PdfAOptions,
): Promise<FacturxPdfBuildResult> {
  const bytes = await toFacturxPdfA3(
    pdfBytes,
    options,
  );

  const structure =
    await assertPdfA3Structure(bytes);

  return {
    bytes,
    structure,
  };
}