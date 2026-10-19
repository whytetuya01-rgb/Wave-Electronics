// Shared types for the Jobs page and its extracted modal/panel components.
// Moved verbatim out of pages/Jobs.tsx during the stabilization refactor so
// every split-out component can import the same shapes instead of
// duplicating them.

export interface VendorOption {
  _id: string;
  name: string;
  city: string;
  isActive: boolean;
}

export interface CircuitOption {
  _id: string;
  circuitCode: string;
  name: string;
  version: string;
  isActive: boolean;
  bomItemCount: number;
}

export interface JobCircuitRow {
  circuitId: string;
  orderedQty: number;
}

export interface IssueRow {
  componentId: string;
  partCode: string;
  name: string;
  remaining: number;
  qtyToIssue: number;
}

export interface ReceiveRow {
  componentId: string;
  partCode: string;
  name: string;
  remaining: number;
  receivedQty: number;
  damagedQty: number;
}

export interface JobCircuitReceiveRow {
  jobCircuitId: string;
  circuitCode: string;
  circuitName: string;
  orderedQty: number;
  remaining: number;
  goodQty: number;
  rejectedQty: number;
  rejectionReason: string;
}

export interface ComponentReturnRow {
  componentId: string;
  partCode: string;
  name: string;
  challanId: string;
  challanNumber: string;
  remaining: number;
  receivedQty: number;
  damagedQty: number;
}

export interface ReconciliationComponentRow {
  componentId: string;
  partCode: string;
  name: string;
  issuedQty: number;
  consumedQty: number;
  returnedQty: number;
  damagedQty: number;
  remainingWithVendor: number;
  ledgerDiscrepancy: number;
  isFullyReconciled: boolean;
}

export interface ReconciliationCircuitRow {
  jobCircuitId: string;
  circuitCode: string;
  circuitName: string;
  circuitVersion: string;
  orderedQty: number;
  receivedGoodQty: number;
  receivedRejectedQty: number;
  remaining: number;
  isFullyAccounted: boolean;
}

export interface ReconciliationData {
  jobNumber: string;
  status: string;
  components: ReconciliationComponentRow[];
  circuits: ReconciliationCircuitRow[];
  closeEligible: boolean;
}

export interface ChallanSummary {
  _id: string;
  challanNumber: string;
  challanDate: string;
  items: Array<{
    componentId: string;
    partCode: string;
    name: string;
    issuedQty: number;
    receivedQty: number;
    damagedQty: number;
  }>;
  status: 'issued' | 'partially_received' | 'received';
  notes?: string;
  issuedBy?: { name: string };
  receivedBy?: { name: string };
}

export interface JobReceiptSummary {
  _id: string;
  receiptNumber: string;
  receiptDate: string;
  circuitReceipts: Array<{ circuitCode: string; goodQty: number; rejectedQty: number }>;
  componentReturns: Array<{ partCode: string; receivedQty: number; damagedQty: number }>;
  receivedById?: { name: string };
}

export interface JobListItem {
  _id: string;
  jobNumber: string;
  jobDate: string;
  targetDate?: string;
  vendorId: VendorOption;
  jobCircuits: Array<{
    circuitId: string;
    circuitCode: string;
    name: string;
    version: string;
    orderedQty: number;
  }>;
  status: 'draft' | 'approved' | 'material_issued' | 'partially_received' | 'closed' | 'cancelled';
  totalOrderedQty: number;
  totalEstimatedCost: number;
  hasShortage: boolean;
  createdAt: string;
}

export const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'danger' | 'gold' | 'neutral'> = {
  draft: 'neutral',
  approved: 'gold',
  material_issued: 'warning',
  partially_received: 'warning',
  closed: 'success',
  cancelled: 'danger',
};

export const STATUS_LABEL: Record<string, string> = {
  draft: 'Draft',
  approved: 'Approved',
  material_issued: 'Material Issued',
  partially_received: 'Partially Received',
  closed: 'Closed',
  cancelled: 'Cancelled',
};

export const CHALLAN_STATUS_LABEL: Record<string, string> = {
  issued: 'Awaiting Receipt',
  partially_received: 'Partially Received',
  received: 'Fully Received',
};
