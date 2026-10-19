import React from 'react';
import { Modal } from '../ui/Modal';
import { ButtonSpinner } from '../ui/Loading';
import { CheckCheck, Ban, PackageCheck, ClipboardCheck } from 'lucide-react';
import { ReceiveRow, JobCircuitReceiveRow, ComponentReturnRow, JobListItem } from './jobTypes';

interface ReceiveMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  receiveChallan: any;
  receiveRows: ReceiveRow[];
  onRowChange: (index: number, field: 'receivedQty' | 'damagedQty', val: number) => void;
  receiveNotes: string;
  onNotesChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string;
}

// Standalone per-challan Receive Material Modal (receive unused/damaged
// components back against one specific Delivery Challan). Moved verbatim
// out of pages/Jobs.tsx during the stabilization refactor, and kept in the
// same file as the combined JobReceiveModal below since both belong to the
// "receiving" family introduced across Day 4-5. Jobs.tsx still owns all the
// underlying state and handlers; this component is purely presentational.
export const ReceiveMaterialModal: React.FC<ReceiveMaterialModalProps> = ({
  isOpen,
  onClose,
  receiveChallan,
  receiveRows,
  onRowChange,
  receiveNotes,
  onNotesChange,
  onSubmit,
  submitting,
  error,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      icon={<CheckCheck className="w-5 h-5 text-[#807365]" />}
      title={receiveChallan ? `Receive Material - ${receiveChallan.challanNumber}` : 'Receive Material'}
      subtitle="Record components returned unused (back to store) or reported damaged/lost (written off). Supports partial receipts."
      onSubmit={onSubmit}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || receiveRows.length === 0}
            className="btn-primary"
          >
            {submitting && <ButtonSpinner />}
            <span>{submitting ? 'Recording Receipt...' : 'Record Receipt'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {error && (
          <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
            {error}
          </div>
        )}

        {receiveRows.length === 0 && !error ? (
          <div className="py-8 text-center text-sm text-[#6B6863]">
            <PackageCheck className="w-8 h-8 mx-auto mb-2 text-[#A69B8D]" />
            Nothing left to receive - every issued component on this challan has already been fully reconciled.
          </div>
        ) : (
          <>
            <div className="enterprise-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="th-enterprise">Component</th>
                    <th className="th-enterprise text-right">Remaining</th>
                    <th className="th-enterprise text-right">
                      <span className="inline-flex items-center gap-1">
                        <CheckCheck className="w-3 h-3 text-[#168060]" /> Received (good)
                      </span>
                    </th>
                    <th className="th-enterprise text-right">
                      <span className="inline-flex items-center gap-1">
                        <Ban className="w-3 h-3 text-[#C2413A]" /> Damaged / Lost
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {receiveRows.map((row, idx) => (
                    <tr key={row.componentId}>
                      <td className="td-enterprise">
                        <span className="font-mono font-semibold">{row.partCode}</span>
                        <div className="text-[12px] text-slate-500">{row.name}</div>
                      </td>
                      <td className="td-enterprise text-right font-mono font-bold text-[#168060]">
                        {row.remaining}
                      </td>
                      <td className="td-enterprise text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="any"
                          value={row.receivedQty}
                          onChange={(e) => onRowChange(idx, 'receivedQty', parseFloat(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono w-24 ml-auto"
                        />
                      </td>
                      <td className="td-enterprise text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="any"
                          value={row.damagedQty}
                          onChange={(e) => onRowChange(idx, 'damagedQty', parseFloat(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono w-24 ml-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div>
              <label className="label-text block mb-1.5">Notes (optional)</label>
              <textarea
                rows={2}
                placeholder="e.g. vendor remarks, damage reason..."
                value={receiveNotes}
                onChange={(e) => onNotesChange(e.target.value)}
                className="w-full px-3 py-2 rounded-[10px] border border-[#E6E3DE] text-sm text-[#171717] placeholder-[#6B6863]/60 focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all bg-white"
              />
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};

interface JobReceiveModalProps {
  isOpen: boolean;
  onClose: () => void;
  jobReceiveTarget: JobListItem | null;
  circuitRows: JobCircuitReceiveRow[];
  onCircuitRowChange: (index: number, field: 'goodQty' | 'rejectedQty' | 'rejectionReason', val: any) => void;
  componentRows: ComponentReturnRow[];
  onComponentRowChange: (index: number, field: 'receivedQty' | 'damagedQty', val: number) => void;
  vendorRef: string;
  onVendorRefChange: (val: string) => void;
  remarks: string;
  onRemarksChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string;
}

// Combined Job Receipt Modal: records finished circuits (good/rejected) and
// any outstanding component returns/damage together in ONE transaction - the
// Day 5 correction's primary receiving flow. Moved verbatim out of
// pages/Jobs.tsx during the stabilization refactor. Jobs.tsx still owns all
// the underlying state and handlers; this component is purely presentational.
export const JobReceiveModal: React.FC<JobReceiveModalProps> = ({
  isOpen,
  onClose,
  jobReceiveTarget,
  circuitRows,
  onCircuitRowChange,
  componentRows,
  onComponentRowChange,
  vendorRef,
  onVendorRefChange,
  remarks,
  onRemarksChange,
  onSubmit,
  submitting,
  error,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      icon={<ClipboardCheck className="w-5 h-5 text-[#807365]" />}
      title={jobReceiveTarget ? `Receive - ${jobReceiveTarget.jobNumber}` : 'Receive'}
      subtitle="Record finished circuits (good/rejected) and any outstanding component returns or damage together, in one transaction. Leave a line at zero to skip it."
      onSubmit={onSubmit}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || (circuitRows.length === 0 && componentRows.length === 0)}
            className="btn-primary"
          >
            {submitting && <ButtonSpinner />}
            <span>{submitting ? 'Recording Receipt...' : 'Record Receipt'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {error && (
          <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">{error}</div>
        )}

        <div>
          <label className="label-text block mb-1.5">Vendor Delivery / Reference Number (optional)</label>
          <input
            type="text"
            value={vendorRef}
            onChange={(e) => onVendorRefChange(e.target.value)}
            placeholder="Vendor's own delivery note / reference number"
            className="input-enterprise w-full"
          />
        </div>

        {circuitRows.length > 0 && (
          <div>
            <label className="label-text block mb-1.5 font-semibold text-slate-800">Finished Circuits</label>
            <div className="enterprise-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="th-enterprise">Circuit</th>
                    <th className="th-enterprise text-right">Remaining</th>
                    <th className="th-enterprise text-right">Good Qty</th>
                    <th className="th-enterprise text-right">Rejected Qty</th>
                    <th className="th-enterprise">Rejection Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {circuitRows.map((row, idx) => (
                    <tr key={row.jobCircuitId}>
                      <td className="td-enterprise">
                        <span className="font-mono font-semibold">{row.circuitCode}</span>
                        <div className="text-[12px] text-slate-500">{row.circuitName}</div>
                      </td>
                      <td className="td-enterprise text-right font-mono font-bold text-[#168060]">{row.remaining}</td>
                      <td className="td-enterprise text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="1"
                          value={row.goodQty}
                          onChange={(e) => onCircuitRowChange(idx, 'goodQty', parseInt(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono w-20 ml-auto"
                        />
                      </td>
                      <td className="td-enterprise text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="1"
                          value={row.rejectedQty}
                          onChange={(e) => onCircuitRowChange(idx, 'rejectedQty', parseInt(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono w-20 ml-auto"
                        />
                      </td>
                      <td className="td-enterprise">
                        {row.rejectedQty > 0 && (
                          <input
                            type="text"
                            placeholder="Reason"
                            value={row.rejectionReason}
                            onChange={(e) => onCircuitRowChange(idx, 'rejectionReason', e.target.value)}
                            className="input-enterprise text-xs"
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {componentRows.length > 0 && (
          <div>
            <label className="label-text block mb-1.5 font-semibold text-slate-800">Component Returns (Unused / Damaged)</label>
            <div className="enterprise-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="th-enterprise">Component</th>
                    <th className="th-enterprise">Challan</th>
                    <th className="th-enterprise text-right">Remaining</th>
                    <th className="th-enterprise text-right">Received (good)</th>
                    <th className="th-enterprise text-right">Damaged / Lost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {componentRows.map((row, idx) => (
                    <tr key={`${row.challanId}-${row.componentId}`}>
                      <td className="td-enterprise">
                        <span className="font-mono font-semibold">{row.partCode}</span>
                        <div className="text-[12px] text-slate-500">{row.name}</div>
                      </td>
                      <td className="td-enterprise font-mono text-[12px] text-slate-500">{row.challanNumber}</td>
                      <td className="td-enterprise text-right font-mono font-bold text-[#168060]">{row.remaining}</td>
                      <td className="td-enterprise text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="any"
                          value={row.receivedQty}
                          onChange={(e) => onComponentRowChange(idx, 'receivedQty', parseFloat(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono w-24 ml-auto"
                        />
                      </td>
                      <td className="td-enterprise text-right">
                        <input
                          type="number"
                          min="0"
                          max={row.remaining}
                          step="any"
                          value={row.damagedQty}
                          onChange={(e) => onComponentRowChange(idx, 'damagedQty', parseFloat(e.target.value) || 0)}
                          className="input-enterprise text-right font-mono w-24 ml-auto"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {circuitRows.length === 0 && componentRows.length === 0 && (
          <div className="py-8 text-center text-sm text-[#6B6863]">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-2 text-[#A69B8D]" />
            Nothing left to receive - every ordered circuit and issued component on this job is already fully reconciled.
          </div>
        )}

        <div>
          <label className="label-text block mb-1.5">Remarks (optional)</label>
          <textarea
            rows={2}
            placeholder="Any notes for this receipt..."
            value={remarks}
            onChange={(e) => onRemarksChange(e.target.value)}
            className="w-full px-3 py-2 rounded-[10px] border border-[#E6E3DE] text-sm text-[#171717] placeholder-[#6B6863]/60 focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all bg-white"
          />
        </div>
      </div>
    </Modal>
  );
};
