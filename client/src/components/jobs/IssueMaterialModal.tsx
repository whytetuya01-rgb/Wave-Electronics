import React from 'react';
import { Modal } from '../ui/Modal';
import { ButtonSpinner } from '../ui/Loading';
import { PackageCheck } from 'lucide-react';
import { IssueRow, JobListItem } from './jobTypes';

interface IssueMaterialModalProps {
  isOpen: boolean;
  onClose: () => void;
  issueJob: JobListItem | null;
  issueRows: IssueRow[];
  onQtyChange: (index: number, val: number) => void;
  onSubmit: (e: React.FormEvent) => void;
  submitting: boolean;
  error: string;
}

// Material Issue Modal - moved verbatim out of pages/Jobs.tsx during the
// stabilization refactor. Jobs.tsx still owns all the underlying state and
// handlers; this component is purely presentational.
export const IssueMaterialModal: React.FC<IssueMaterialModalProps> = ({
  isOpen,
  onClose,
  issueJob,
  issueRows,
  onQtyChange,
  onSubmit,
  submitting,
  error,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="xl"
      icon={<PackageCheck className="w-5 h-5 text-[#807365]" />}
      title={issueJob ? `Issue Material - ${issueJob.jobNumber}` : 'Issue Material'}
      subtitle="Moves stock from store to the vendor and generates a delivery challan. Enter less than the full remaining quantity for a partial issue."
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
            disabled={submitting || issueRows.length === 0}
            className="btn-primary"
          >
            {submitting && <ButtonSpinner />}
            <span>{submitting ? 'Issuing Material...' : 'Issue Material & Generate Challan'}</span>
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

        {issueRows.length === 0 && !error ? (
          <div className="py-8 text-center text-sm text-[#6B6863]">
            <PackageCheck className="w-8 h-8 mx-auto mb-2 text-[#A69B8D]" />
            Nothing left to issue - every reserved component on this job has already been fully issued.
          </div>
        ) : (
          <div className="enterprise-card overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="th-enterprise">Component</th>
                  <th className="th-enterprise text-right">Remaining Reserved</th>
                  <th className="th-enterprise text-right">Qty to Issue Now</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {issueRows.map((row, idx) => (
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
                        value={row.qtyToIssue}
                        onChange={(e) => onQtyChange(idx, parseFloat(e.target.value) || 0)}
                        className="input-enterprise text-right font-mono w-28 ml-auto"
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
};
