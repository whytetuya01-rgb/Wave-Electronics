import {
  renderToBuffer,
  drawCompanyHeader,
  drawKeyValueBlock,
  drawSectionLabel,
  drawTable,
  drawSignatureFooter,
  COLORS,
} from './pdfLayout.js';

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatQty(n: number): string {
  return Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

export interface JobReceiptPdfCircuitLine {
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  goodQty: number;
  rejectedQty: number;
  rejectionReason?: string;
}

export interface JobReceiptPdfReturnLine {
  partCode: string;
  name: string;
  challanNumber: string;
  receivedQty: number;
  damagedQty: number;
}

export interface JobReceiptPdfInput {
  receiptNumber: string;
  receiptDate: Date;
  jobNumber: string;
  vendorRefNumber?: string;
  vendorName?: string;
  vendorAddress?: string;
  vendorCity?: string;
  vendorGstNumber?: string;
  circuitReceipts: JobReceiptPdfCircuitLine[];
  componentReturns: JobReceiptPdfReturnLine[];
  remarks?: string;
}

// Generates the Job Receipt / Finished Circuit Receipt PDF as an in-memory
// Buffer. Pure function: takes already-fetched plain data (straight from the
// stored JobReceipt document, plus a live Vendor lookup since JobReceipt
// itself only stores vendorId), touches no database, issues no writes.
// Finished circuits and raw-component returns are deliberately rendered as
// two separate, clearly labeled tables - never merged into one - since they
// are accounted for completely differently (BOM consumption vs. direct
// component return) and the source data already keeps them in separate
// arrays on the model.
export async function generateJobReceiptPdf(input: JobReceiptPdfInput): Promise<Buffer> {
  return renderToBuffer((doc) => {
    let y = drawCompanyHeader(doc, 'Job Receipt');

    const vendorAddressLine = [input.vendorAddress, input.vendorCity].filter(Boolean).join(', ') || undefined;

    y = drawKeyValueBlock(
      doc,
      [
        ['Receipt Number', input.receiptNumber],
        ['Date', formatDate(input.receiptDate)],
        ['Job Number', input.jobNumber],
        ['Vendor', input.vendorName],
        ['Vendor Address', vendorAddressLine],
        ['Vendor GSTIN', input.vendorGstNumber],
        ['Vendor Ref. Number', input.vendorRefNumber],
      ],
      y
    );

    if (input.circuitReceipts.length > 0) {
      y = drawSectionLabel(doc, 'Finished Circuits Received', y + 4);

      const rows = input.circuitReceipts.map((c, idx) => ({
        sr: idx + 1,
        circuitCode: c.circuitCode,
        circuitVersion: c.circuitVersion,
        circuitName: c.circuitName,
        goodQty: formatQty(c.goodQty),
        rejectedQty: formatQty(c.rejectedQty),
        totalQty: formatQty(c.goodQty + c.rejectedQty),
      }));

      y = drawTable(
        doc,
        [
          { key: 'sr', label: 'Sr.', width: 25, align: 'right' },
          { key: 'circuitCode', label: 'Circuit Code', width: 95 },
          { key: 'circuitVersion', label: 'Version', width: 55, align: 'center' },
          { key: 'circuitName', label: 'Circuit Name', width: 150 },
          { key: 'goodQty', label: 'Good Qty', width: 55, align: 'right' },
          { key: 'rejectedQty', label: 'Rejected Qty', width: 55, align: 'right' },
          { key: 'totalQty', label: 'Total Received', width: 60, align: 'right' },
        ],
        rows,
        y
      );

      const reasons = input.circuitReceipts.filter((c) => c.rejectedQty > 0 && c.rejectionReason);
      if (reasons.length > 0) {
        y += 8;
        doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.muted).text('Rejection Notes:', doc.page.margins.left, y, { lineBreak: false });
        y += 12;
        for (const r of reasons) {
          doc
            .font('Helvetica')
            .fontSize(8)
            .fillColor(COLORS.text)
            .text(`${r.circuitCode}: ${r.rejectionReason}`, doc.page.margins.left + 8, y, {
              width: doc.page.width - doc.page.margins.left - doc.page.margins.right - 8,
            });
          y = doc.y + 2;
        }
      }
    }

    if (input.componentReturns.length > 0) {
      y = drawSectionLabel(doc, 'Raw Component Returns (Unused / Damaged)', y + 10);

      const returnRows = input.componentReturns.map((r, idx) => ({
        sr: idx + 1,
        partCode: r.partCode,
        name: r.name,
        challanNumber: r.challanNumber,
        receivedQty: formatQty(r.receivedQty),
        damagedQty: formatQty(r.damagedQty),
      }));

      y = drawTable(
        doc,
        [
          { key: 'sr', label: 'Sr.', width: 25, align: 'right' },
          { key: 'partCode', label: 'Component Code', width: 95 },
          { key: 'name', label: 'Component Name', width: 140 },
          { key: 'challanNumber', label: 'Challan No.', width: 100 },
          { key: 'receivedQty', label: 'Received (Good)', width: 65, align: 'right' },
          { key: 'damagedQty', label: 'Damaged', width: 60, align: 'right' },
        ],
        returnRows,
        y
      );
    }

    if (input.remarks) {
      y = drawSectionLabel(doc, 'Remarks', y + 10);
      doc
        .font('Helvetica')
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(input.remarks, doc.page.margins.left, y, {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        });
      y = doc.y + 10;
    }

    drawSignatureFooter(doc, ['Received By', 'QC Inspected By', 'Authorized Signatory'], y + 10);
  });
}
