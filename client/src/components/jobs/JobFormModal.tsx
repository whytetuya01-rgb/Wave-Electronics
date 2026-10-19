import React from 'react';
import { Modal } from '../ui/Modal';
import { ButtonSpinner } from '../ui/Loading';
import { Workflow, Plus, Trash, AlertTriangle, AlertCircle } from 'lucide-react';
import { VendorOption, CircuitOption, JobCircuitRow, JobListItem } from './jobTypes';

interface BomPreviewRow {
  componentId: string;
  partCode: string;
  name: string;
  totalRequired: number;
  availableStock: number;
  ratePerUnit: number;
  hasShortage: boolean;
  lineCost: number;
}

interface JobFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'add' | 'edit';
  selectedJob: JobListItem | null;
  vendors: VendorOption[];
  circuits: CircuitOption[];
  formData: { vendorId: string; targetDate: string; remarks: string };
  onFormDataChange: (data: { vendorId: string; targetDate: string; remarks: string }) => void;
  jobCircuitRows: JobCircuitRow[];
  onAddCircuitRow: () => void;
  onRemoveCircuitRow: (index: number) => void;
  onCircuitRowChange: (index: number, field: 'circuitId' | 'orderedQty', val: any) => void;
  aggregatedBomPreview: BomPreviewRow[];
  submitting: boolean;
  formError: string;
  onSubmit: (e: React.FormEvent) => void;
}

// Create / Edit Job Modal - moved verbatim out of pages/Jobs.tsx during the
// stabilization refactor. Jobs.tsx still owns all the underlying state and
// handlers; this component is purely presentational.
export const JobFormModal: React.FC<JobFormModalProps> = ({
  isOpen,
  onClose,
  mode,
  selectedJob,
  vendors,
  circuits,
  formData,
  onFormDataChange,
  jobCircuitRows,
  onAddCircuitRow,
  onRemoveCircuitRow,
  onCircuitRowChange,
  aggregatedBomPreview,
  submitting,
  formError,
  onSubmit,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      icon={<Workflow className="w-5 h-5 text-[#807365]" />}
      title={mode === 'add' ? 'Create Job Work Order' : `Edit Job - ${selectedJob?.jobNumber}`}
      subtitle="Select vendor and circuits. Material requirements and stock reservation availability are calculated automatically."
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
            disabled={submitting}
            className="btn-primary"
          >
            {submitting && <ButtonSpinner />}
            <span>{submitting ? 'Saving Job...' : mode === 'add' ? 'Save as Draft' : 'Update Job'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {formError && (
          <div className="p-3 bg-[#C2413A]/10 border border-[#C2413A]/25 rounded-[10px] text-xs text-[#C2413A] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="label-text block mb-1.5">
              Vendor <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.vendorId}
              onChange={(e) => onFormDataChange({ ...formData, vendorId: e.target.value })}
              required
              className="select-enterprise w-full"
            >
              <option value="">Select Vendor...</option>
              {vendors.map((v) => (
                <option key={v._id} value={v._id}>
                  {v.name} ({v.city})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-text block mb-1.5">Target Completion Date</label>
            <input
              type="date"
              value={formData.targetDate}
              onChange={(e) => onFormDataChange({ ...formData, targetDate: e.target.value })}
              className="input-enterprise w-full"
            />
          </div>
        </div>

        {/* Circuit Selection Lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="label-text font-semibold text-slate-800">Circuits to Assemble</label>
            <button
              type="button"
              onClick={onAddCircuitRow}
              className="btn-secondary px-2.5 py-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Circuit</span>
            </button>
          </div>

          <div className="space-y-2">
            {jobCircuitRows.map((row, idx) => (
              <div key={idx} className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 bg-slate-50/50">
                <div className="flex-1">
                  <select
                    value={row.circuitId}
                    onChange={(e) => onCircuitRowChange(idx, 'circuitId', e.target.value)}
                    required
                    className="select-enterprise w-full text-sm bg-white"
                  >
                    <option value="">Select Circuit BOM...</option>
                    {circuits.map((c) => (
                      <option key={c._id} value={c._id}>
                        {c.circuitCode} — {c.name} (v{c.version}) [{c.bomItemCount} components]
                      </option>
                    ))}
                  </select>
                </div>

                <div className="w-32">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={row.orderedQty}
                    onChange={(e) => onCircuitRowChange(idx, 'orderedQty', parseInt(e.target.value) || 0)}
                    required
                    placeholder="Qty"
                    className="input-enterprise text-right font-mono bg-white"
                  />
                </div>

                {jobCircuitRows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onRemoveCircuitRow(idx)}
                    className="text-slate-400 hover:text-red-600 p-1.5 transition-colors"
                    title="Remove Row"
                  >
                    <Trash className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Aggregated Material Preview */}
        {aggregatedBomPreview.length > 0 && (
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span className="font-semibold text-slate-700">Calculated Material Requirements</span>
              <span>
                Total Estimated Material Cost:{' '}
                <strong className="text-slate-900 font-mono">
                  ₹
                  {aggregatedBomPreview
                    .reduce((sum, item) => sum + item.lineCost, 0)
                    .toFixed(2)}
                </strong>
              </span>
            </div>
            <div className="enterprise-card overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 z-10">
                  <tr>
                    <th className="th-enterprise">Component</th>
                    <th className="th-enterprise text-right">Required Qty</th>
                    <th className="th-enterprise text-right">Available in Store</th>
                    <th className="th-enterprise text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {aggregatedBomPreview.map((line) => (
                    <tr key={line.componentId}>
                      <td className="td-enterprise">
                        <span className="font-mono font-semibold">{line.partCode}</span>
                        <span className="text-slate-400 ml-1.5">({line.name})</span>
                      </td>
                      <td className="td-enterprise text-right font-mono font-semibold">{line.totalRequired}</td>
                      <td className="td-enterprise text-right font-mono">{line.availableStock}</td>
                      <td className="td-enterprise text-center">
                        {line.hasShortage ? (
                          <span className="inline-flex items-center gap-1 text-red-600 font-semibold text-[11px]">
                            <AlertTriangle className="w-3 h-3" /> Shortage
                          </span>
                        ) : (
                          <span className="text-[#168060] font-semibold text-[11px]">Sufficient</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div>
          <label className="label-text block mb-1.5">Remarks / Work Instructions</label>
          <textarea
            rows={2}
            placeholder="e.g. Special testing requirements, delivery instructions..."
            value={formData.remarks}
            onChange={(e) => onFormDataChange({ ...formData, remarks: e.target.value })}
            className="w-full px-3 py-2 rounded-[10px] border border-[#E6E3DE] text-sm text-[#171717] placeholder-[#6B6863]/60 focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all bg-white"
          />
        </div>
      </div>
    </Modal>
  );
};
