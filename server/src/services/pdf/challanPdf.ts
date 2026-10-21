import {
  renderToBuffer,
  drawCompanyHeader,
  drawKeyValueBlock,
  drawSectionLabel,
  drawTable,
  drawDeclaration,
  drawSignatureFooter,
  CompanyInfo,
} from './pdfLayout.js';

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatQty(n: number): string {
  return Number(n ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 4 });
}

export interface ChallanPdfItem {
  componentId: { toString(): string };
  partCode: string;
  name: string;
  issuedQty: number;
  receivedQty: number;
  damagedQty: number;
}

export interface ChallanPdfJobCircuit {
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  orderedQty: number;
}

export interface ChallanPdfMaterialLine {
  componentId: { toString(): string };
  requiredQty: number;
  issuedQty: number;
}

export interface ChallanPdfInput {
  challanNumber: string;
  challanDate: Date;
  jobNumber: string;
  vendorName: string;
  vendorAddress?: string;
  vendorCity?: string;
  vendorGstNumber?: string;
  items: ChallanPdfItem[];
  jobCircuits: ChallanPdfJobCircuit[];
  materialRequirement: ChallanPdfMaterialLine[];
  // componentId.toString() -> unit short code (e.g. "NOS", "MTR"). Not
  // snapshotted on the challan itself, so this is looked up live from the
  // current Component/Unit records by the caller - a display label, not an
  // accounting value, so a live lookup doesn't violate the
  // "use stored snapshots" requirement for the financial fields.
  unitByComponentId: Map<string, string>;
  companyInfo?: CompanyInfo;
}

// Generates the Delivery Challan PDF as an in-memory Buffer. Pure function:
// takes already-fetched plain data, touches no database, issues no writes.
export async function generateChallanPdf(input: ChallanPdfInput): Promise<Buffer> {
  return renderToBuffer((doc) => {
    let y = drawCompanyHeader(doc, 'Delivery Challan', input.companyInfo);

    const vendorAddressLine = [input.vendorAddress, input.vendorCity].filter(Boolean).join(', ') || undefined;

    y = drawKeyValueBlock(
      doc,
      [
        ['Challan Number', input.challanNumber],
        ['Date', formatDate(input.challanDate)],
        ['Job Number', input.jobNumber],
        ['Vendor', input.vendorName],
        ['Vendor Address', vendorAddressLine],
        ['Vendor GSTIN', input.vendorGstNumber],
      ],
      y
    );

    y = drawSectionLabel(doc, 'Material Details', y + 4);

    const materialByComponent = new Map(input.materialRequirement.map((m) => [m.componentId.toString(), m]));

    const rows = input.items.map((item, idx) => {
      const mat = materialByComponent.get(item.componentId.toString());
      const remaining = item.issuedQty - item.receivedQty - item.damagedQty;
      return {
        sr: idx + 1,
        partCode: item.partCode,
        name: item.name,
        unit: input.unitByComponentId.get(item.componentId.toString()) || '-',
        requiredQty: mat ? formatQty(mat.requiredQty) : '-',
        issuedQty: formatQty(item.issuedQty),
        totalIssuedQty: mat ? formatQty(mat.issuedQty) : formatQty(item.issuedQty),
        remainingQty: formatQty(remaining),
      };
    });

    y = drawTable(
      doc,
      [
        { key: 'sr', label: 'Sr.', width: 25, align: 'right' },
        { key: 'partCode', label: 'Component Code', width: 85 },
        { key: 'name', label: 'Component Name', width: 120 },
        { key: 'unit', label: 'Unit', width: 35, align: 'center' },
        { key: 'requiredQty', label: 'Required Qty', width: 50, align: 'right' },
        { key: 'issuedQty', label: 'Issued Qty', width: 50, align: 'right' },
        { key: 'totalIssuedQty', label: 'Total Issued', width: 60, align: 'right' },
        { key: 'remainingQty', label: 'Remaining', width: 60, align: 'right' },
      ],
      rows,
      y
    );

    y = drawSectionLabel(doc, 'Production Details', y + 14);

    const circuitRows = input.jobCircuits.map((jc, idx) => ({
      sr: idx + 1,
      circuitCode: jc.circuitCode,
      circuitVersion: jc.circuitVersion,
      circuitName: jc.circuitName,
      orderedQty: `${formatQty(jc.orderedQty)} units`,
    }));

    y = drawTable(
      doc,
      [
        { key: 'sr', label: 'Sr.', width: 25, align: 'right' },
        { key: 'circuitCode', label: 'Circuit Code', width: 110 },
        { key: 'circuitVersion', label: 'Version', width: 60, align: 'center' },
        { key: 'circuitName', label: 'Circuit Name', width: 180 },
        { key: 'orderedQty', label: 'Qty To Manufacture', width: 110, align: 'right' },
      ],
      circuitRows,
      y
    );

    y = drawDeclaration(doc, 'Material sent for job work - not for sale, to be returned as finished goods.', y + 10);

    drawSignatureFooter(doc, ['Prepared By', 'Received By', 'Authorized Signatory'], y);
  });
}
