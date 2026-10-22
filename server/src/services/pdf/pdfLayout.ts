import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

// server/assets, from both src/services/pdf (tsx) and dist/services/pdf
// (compiled). Vercel traces this exact file into the API function, where a
// path on a self-hosted server's disk does not exist.
const ASSETS_DIR = path.join(__dirname, '..', '..', '..', 'assets');
const BUNDLED_LOGO = path.join(ASSETS_DIR, 'company-logo.png');
const LOGO_MAX_WIDTH = 130;
const LOGO_MAX_HEIGHT = 46;

// First logo file that exists: the Settings path, then COMPANY_LOGO_PATH,
// then the bundled one - so a path left over from a self-hosted setup falls
// back to the bundled logo on Vercel instead of dropping the branding.
function resolveLogoPath(configured?: string): string | undefined {
  return [configured, process.env.COMPANY_LOGO_PATH, BUNDLED_LOGO].find((p): p is string =>
    Boolean(p && p.trim() && fs.existsSync(p))
  );
}

// Shared PDFKit layout helpers for every generated document (Delivery
// Challan, Job Receipt, and any future printable document). Kept deliberately
// generic - a generator module (challanPdf.ts, jobReceiptPdf.ts) composes
// these primitives rather than each hand-rolling its own header/table/footer
// drawing code.

export const COLORS = {
  black: '#171717',
  text: '#383531',
  muted: '#6B6863',
  gold: '#807365',
  goldLight: '#A69B8D',
  tableHeaderBg: '#F3F1EC',
  border: '#D8D4CE',
  white: '#FFFFFF',
};

export const PAGE_MARGIN = 50;

export interface TableColumn {
  key: string;
  label: string;
  width: number;
  align?: 'left' | 'right' | 'center';
}

// compress:false trades a slightly larger file for content streams that stay
// plain-text inside the PDF bytes - deliberately so automated tests can
// assert on document content (part codes, numbers, declarations) by
// searching the raw buffer, without needing a PDF-parsing dependency.
export function createPdfDocument(): PDFKit.PDFDocument {
  return new PDFDocument({
    size: 'A4',
    margins: { top: PAGE_MARGIN, bottom: PAGE_MARGIN, left: PAGE_MARGIN, right: PAGE_MARGIN },
    bufferPages: true,
    compress: false,
  });
}

// Renders a PDFDocument fully into an in-memory Buffer. Generators build the
// document synchronously inside `build`, then this resolves once PDFKit has
// flushed every internal chunk - callers (the PDF controller, or tests) never
// deal with streams directly.
export function renderToBuffer(build: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = createPdfDocument();
      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      build(doc);
      finalizePageNumbers(doc);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export interface CompanyInfo {
  companyName?: string;
  address?: string;
  gstin?: string;
  logoPath?: string;
}

// Company header: name, optional address/GSTIN, optional logo (see
// resolveLogoPath - only drawn if a file exists), and the document title.
// `companyInfo` (sourced from the admin-editable Settings document) takes
// precedence when provided; falls back to the original env-var values so
// existing callers that don't pass it keep working unchanged. Returns the Y
// position content should continue from.
export function drawCompanyHeader(
  doc: PDFKit.PDFDocument,
  documentTitle: string,
  companyInfo?: CompanyInfo
): number {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const top = doc.page.margins.top;

  const companyName = companyInfo?.companyName || 'WAVE ELECTRONICS';
  const address = companyInfo?.address ?? process.env.COMPANY_ADDRESS;
  const gstin = companyInfo?.gstin ?? process.env.COMPANY_GSTIN;
  const logoPath = resolveLogoPath(companyInfo?.logoPath);

  let textX = left;
  let logoHeight = 0;
  if (logoPath) {
    try {
      // Scaled to fit LOGO_MAX_WIDTH x LOGO_MAX_HEIGHT with its proportions
      // kept (the company logo is about 2.3:1); the name starts beside it.
      // openImage is PDFKit API missing from its type definitions.
      const image = (doc as unknown as { openImage(src: string): { width: number; height: number } }).openImage(logoPath);
      const scale = Math.min(LOGO_MAX_WIDTH / image.width, LOGO_MAX_HEIGHT / image.height);
      const width = image.width * scale;
      logoHeight = image.height * scale;
      doc.image(logoPath, left, top, { width, height: logoHeight });
      textX = left + width + 14;
    } catch {
      // Invalid/unreadable image - fall back to text-only header rather
      // than failing the whole document.
    }
  }

  doc.font('Helvetica-Bold').fontSize(16).fillColor(COLORS.black).text(companyName.toUpperCase(), textX, top, { lineBreak: false });

  let infoY = top + 20;
  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.muted);
  if (address) {
    doc.text(address, textX, infoY, { width: 300, lineBreak: false });
    infoY += 12;
  }
  if (gstin) {
    doc.text(`GSTIN: ${gstin}`, textX, infoY, { width: 300, lineBreak: false });
    infoY += 12;
  }

  // Document title, right-aligned, same header block.
  doc
    .font('Helvetica-Bold')
    .fontSize(13)
    .fillColor(COLORS.black)
    .text(documentTitle.toUpperCase(), left, top + 4, { width: right - left, align: 'right', lineBreak: false });

  const dividerY = Math.max(infoY, top + 44, top + logoHeight) + 8;
  doc.moveTo(left, dividerY).lineTo(right, dividerY).strokeColor(COLORS.gold).lineWidth(1.2).stroke();

  return dividerY + 16;
}

// Simple two-column label/value block (e.g. "Challan Number: CHL-...",
// "Date: ..."). `pairs` with a falsy value are skipped, so optional fields
// (vendor GSTIN, vendor address) are omitted instead of printed blank.
export function drawKeyValueBlock(
  doc: PDFKit.PDFDocument,
  pairs: Array<[string, string | undefined]>,
  startY: number,
  columns = 2
): number {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const colWidth = (right - left) / columns;
  const visible = pairs.filter(([, v]) => v !== undefined && v !== null && v !== '');

  const rowHeight = 15;
  let y = startY;
  for (let i = 0; i < visible.length; i += columns) {
    const rowItems = visible.slice(i, i + columns);
    rowItems.forEach(([label, value], colIdx) => {
      const x = left + colIdx * colWidth;
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLORS.muted).text(`${label}:`, x, y, { width: colWidth - 10, lineBreak: false });
      doc
        .font('Helvetica')
        .fontSize(9.5)
        .fillColor(COLORS.black)
        .text(String(value), x, y + 10, { width: colWidth - 10, height: 12, lineBreak: false, ellipsis: true });
    });
    y += rowHeight + 14;
  }
  return y;
}

export function drawSectionLabel(doc: PDFKit.PDFDocument, text: string, y: number): number {
  const left = doc.page.margins.left;
  doc
    .font('Helvetica-Bold')
    .fontSize(9)
    .fillColor(COLORS.gold)
    .text(text.toUpperCase(), left, y, { characterSpacing: 0.5, lineBreak: false });
  return y + 16;
}

// Generic paginating table. Repeats the header row on every new page it
// starts, never splits a row across a page boundary, and truncates
// (ellipsizes) any cell text that would otherwise overflow its column and
// risk overlapping the next one.
export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: Array<Record<string, string | number>>,
  startY: number,
  rowHeight = 20
): number {
  const left = doc.page.margins.left;
  const totalWidth = columns.reduce((sum, c) => sum + c.width, 0);
  const headerHeight = 22;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  const drawHeaderRow = (atY: number): number => {
    doc.save();
    doc.rect(left, atY, totalWidth, headerHeight).fill(COLORS.tableHeaderBg);
    doc.restore();
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLORS.black);
    let x = left;
    for (const col of columns) {
      // Headers are short, known strings (e.g. "REQUIRED QTY") - letting
      // them wrap naturally onto the header row's existing second line is
      // more readable than truncating with "...", and headerHeight already
      // has room for two lines, so this was never the source of the
      // row-overlap bug (only the data rows, which ARE bounded below).
      doc.text(col.label.toUpperCase(), x + 5, atY + 7, { width: col.width - 8, align: col.align || 'left', lineBreak: false });
      x += col.width;
    }
    doc
      .moveTo(left, atY + headerHeight)
      .lineTo(left + totalWidth, atY + headerHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.75)
      .stroke();
    return atY + headerHeight;
  };

  let y = startY;
  if (y + headerHeight > bottomLimit) {
    doc.addPage();
    y = doc.page.margins.top;
  }
  y = drawHeaderRow(y);

  doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
  for (const row of rows) {
    if (y + rowHeight > bottomLimit) {
      doc.addPage();
      y = drawHeaderRow(doc.page.margins.top);
      doc.font('Helvetica').fontSize(8.5).fillColor(COLORS.text);
    }
    let x = left;
    for (const col of columns) {
      const value = row[col.key];
      // ellipsis:true only actually truncates when a bounded `height` is
      // also given - without it, PDFKit just lets long text wrap onto a
      // second line instead of cutting it off, which then overlaps the row
      // separator drawn at a fixed rowHeight below. Bounding both together
      // is what makes long part codes/names truncate with "..." on one
      // line instead of visually colliding with the next row.
      doc.text(value === undefined || value === null ? '-' : String(value), x + 5, y + 6, {
        width: col.width - 8,
        height: rowHeight - 8,
        align: col.align || 'left',
        ellipsis: true,
        lineBreak: false,
      });
      x += col.width;
    }
    doc
      .moveTo(left, y + rowHeight)
      .lineTo(left + totalWidth, y + rowHeight)
      .strokeColor(COLORS.border)
      .lineWidth(0.5)
      .stroke();
    y += rowHeight;
  }

  // Outer border around the whole table.
  doc
    .rect(left, startY > y - headerHeight ? startY : startY, totalWidth, 0)
    .strokeColor(COLORS.border);

  return y;
}

// Boxed declaration text (e.g. "Material sent for job work - not for sale...").
export function drawDeclaration(doc: PDFKit.PDFDocument, text: string, startY: number): number {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const padding = 10;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  doc.font('Helvetica-Oblique').fontSize(8.5);
  const textHeight = doc.heightOfString(text, { width: width - padding * 2 });
  const boxHeight = textHeight + padding * 2;

  let y = startY;
  if (y + boxHeight > bottomLimit) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  doc.save();
  doc.rect(left, y, width, boxHeight).fillOpacity(0.06).fill(COLORS.gold);
  doc.restore();
  doc.rect(left, y, width, boxHeight).strokeColor(COLORS.border).lineWidth(0.75).stroke();
  doc
    .font('Helvetica-Oblique')
    .fontSize(8.5)
    .fillColor(COLORS.text)
    .text(text, left + padding, y + padding, { width: width - padding * 2 });

  return y + boxHeight + 16;
}

// Signature footer: evenly-spaced boxes, each a horizontal line with a label
// below it, positioned safely (a new page is started if there isn't enough
// room left on the current one - a signature block is never split).
export function drawSignatureFooter(doc: PDFKit.PDFDocument, labels: string[], startY: number): number {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const totalWidth = right - left;
  const boxHeight = 56;
  const bottomLimit = doc.page.height - doc.page.margins.bottom;

  let y = startY;
  if (y + boxHeight > bottomLimit) {
    doc.addPage();
    y = doc.page.margins.top;
  }

  const colWidth = totalWidth / labels.length;
  const lineY = y + boxHeight - 20;
  labels.forEach((label, i) => {
    const x = left + i * colWidth + 8;
    const w = colWidth - 16;
    doc.moveTo(x, lineY).lineTo(x + w, lineY).strokeColor(COLORS.muted).lineWidth(0.75).stroke();
    doc
      .font('Helvetica')
      .fontSize(8.5)
      .fillColor(COLORS.muted)
      .text(label, x, lineY + 5, { width: w, align: 'center', lineBreak: false });
  });

  return y + boxHeight;
}

// Adds "Page X of Y" to every buffered page. Must run after all content is
// drawn and BEFORE doc.end() - switchToPage() only works while the document
// is still open with bufferPages:true.
function finalizePageNumbers(doc: PDFKit.PDFDocument): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const label = `Page ${i - range.start + 1} of ${range.count}`;
    // The footer sits inside the bottom margin band, i.e. BELOW
    // page.height - margins.bottom. PDFKit's own text() treats that
    // boundary as the hard printable limit and silently calls addPage()
    // if asked to write past it - which would append a spurious blank
    // page for every single page number drawn. Temporarily zeroing the
    // bottom margin lets the footer sit there without tripping that
    // guard; it's restored immediately after.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('Helvetica')
      .fontSize(7.5)
      .fillColor(COLORS.muted)
      .text(label, doc.page.margins.left, doc.page.height - savedBottom + 14, {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center',
        lineBreak: false,
      });
    doc.page.margins.bottom = savedBottom;
  }
}
