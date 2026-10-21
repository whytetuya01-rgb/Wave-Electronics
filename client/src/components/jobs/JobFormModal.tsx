import React from 'react';
import { Modal } from '../ui/Modal';
import { ButtonSpinner } from '../ui/Loading';
import { FormField, FormError } from '../ui/FormField';
import { ValidatedInput, ValidatedTextarea } from '../ui/ValidatedInput';
import { SearchableSelect } from '../ui/SearchableSelect';
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
  formError?: string;
  fieldErrors?: Record<string, string>;
  onSubmit: (e: React.FormEvent) => void;
}

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
  fieldErrors = {},
  onSubmit,
}) => {
  const selectedVendor = vendors.find((v) => v._id === formData.vendorId);

  const jobWorkRateRows = selectedVendor
    ? jobCircuitRows
        .filter((row) => row.circuitId)
        .map((row) => {
          const circuit = circuits.find((c) => c._id === row.circuitId);
          const circuitName = circuit?.name || '';
          const perCircuitRate = selectedVendor.vendorCircuitRates?.find(
            (r) => r.circuitName === circuitName
          )?.ratePerUnit;
          const rate = perCircuitRate ?? selectedVendor.defaultJobWorkRate ?? 0;
          return { circuitName: circuitName || 'Unnamed circuit', rate, isOverride: perCircuitRate !== undefined };
        })
        .filter((r) => r.rate > 0)
    : [];

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
            <FormField label="Vendor" required error={fieldErrors['vendorId']}>
              <SearchableSelect
                options={vendors.map((v) => ({
                  value: v._id,
                  label: v.name,
                  description: v.city,
                }))}
                value={formData.vendorId}
                onChange={(val) => onFormDataChange({ ...formData, vendorId: val })}
                placeholder="Select Vendor..."
                searchPlaceholder="Search vendor name or city..."
                hasError={!!fieldErrors['vendorId']}
              />
            </FormField>
          </div>

          <div>
            <FormField label="Target Completion Date" required error={fieldErrors['targetDate']}>
              <ValidatedInput
                type="date"
                value={formData.targetDate}
                onChange={(e) => onFormDataChange({ ...formData, targetDate: e.target.value })}
                hasError={!!fieldErrors['targetDate']}
              />
            </FormField>
          </div>
        </div>

        {jobWorkRateRows.length > 0 && (
          <div className="p-3 rounded-[10px] border border-[#A69B8D]/30 bg-[#F7F6F3]/70 text-xs space-y-1">
            <div className="font-semibold text-[#171717] mb-1">Job-Work Charge ({selectedVendor?.name})</div>
            {jobWorkRateRows.map((r, i) => (
              <div key={i} className="flex items-center justify-between text-[#383531]">
                <span>{r.circuitName}</span>
                <span className="font-mono font-medium">
                  ₹{r.rate.toFixed(2)} / unit
                  {r.isOverride && <span className="text-[10px] text-[#807365] ml-1">(circuit rate)</span>}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Circuit Selection Lines */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <label className="label-text font-semibold text-slate-800 block">
                Circuits to Assemble <span className="text-[#C2413A]">*</span>
              </label>
              {fieldErrors['jobCircuits'] && (
                <FormError message={fieldErrors['jobCircuits']} className="mt-1" />
              )}
            </div>
            <button
              type="button"
              onClick={onAddCircuitRow}
              className="btn-secondary px-2.5 py-1 text-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Circuit</span>
            </button>
          </div>

          <div className="space-y-3">
            {jobCircuitRows.map((row, idx) => {
              const circuitOptions = circuits.map((c) => ({
                value: c._id,
                label: `${c.circuitCode} — ${c.name} (v${c.version})`,
                description: `${c.bomItemCount} components`,
                disabled: jobCircuitRows.some((r, i) => i !== idx && r.circuitId === c._id),
              }));

              return (
                <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="flex-1 w-full">
                      <SearchableSelect
                        options={circuitOptions}
                        value={row.circuitId}
                        onChange={(val) => onCircuitRowChange(idx, 'circuitId', val)}
                        placeholder="Select Circuit BOM..."
                        searchPlaceholder="Search circuit code or name..."
                        hasError={!!fieldErrors[`jobCircuits.${idx}.circuitId`]}
                      />
                      {fieldErrors[`jobCircuits.${idx}.circuitId`] && (
                        <FormError message={fieldErrors[`jobCircuits.${idx}.circuitId`]} className="mt-1" />
                      )}
                    </div>

                    <div className="w-full sm:w-36 flex items-center gap-2">
                      <div className="flex-1">
                        <ValidatedInput
                          type="number"
                          min="1"
                          step="1"
                          value={row.orderedQty === 0 ? '' : row.orderedQty}
                          onChange={(e) => onCircuitRowChange(idx, 'orderedQty', parseInt(e.target.value) || 0)}
                          placeholder="Qty"
                          className="text-right font-mono"
                          hasError={!!fieldErrors[`jobCircuits.${idx}.orderedQty`]}
                        />
                      </div>
                      {jobCircuitRows.length > 1 && (
                        <button
                          type="button"
                          onClick={() => onRemoveCircuitRow(idx)}
                          className="text-slate-400 hover:text-red-600 p-2 transition-colors rounded-lg hover:bg-red-50 shrink-0"
                          title="Remove Row"
                        >
                          <Trash className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {fieldErrors[`jobCircuits.${idx}.orderedQty`] && (
                    <FormError message={fieldErrors[`jobCircuits.${idx}.orderedQty`]} />
                  )}
                </div>
              );
            })}
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
          <FormField label="Remarks / Work Instructions" error={fieldErrors['remarks']}>
            <ValidatedTextarea
              rows={2}
              placeholder="e.g. Special testing requirements, delivery instructions..."
              value={formData.remarks}
              onChange={(e) => onFormDataChange({ ...formData, remarks: e.target.value })}
              hasError={!!fieldErrors['remarks']}
            />
          </FormField>
        </div>
      </div>
    </Modal>
  );
};
