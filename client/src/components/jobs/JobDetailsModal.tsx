import React from 'react';
import { Modal } from '../ui/Modal';
import { Badge } from '../ui/Badge';
import { Workflow, Receipt, Lock } from 'lucide-react';
import { ChallanSummary, ReconciliationData, CHALLAN_STATUS_LABEL } from './jobTypes';
import { JobReconciliationPanel } from './JobReconciliationPanel';

interface JobDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  detailsLoading: boolean;
  detailedJob: any;
  jobChallans: ChallanSummary[];
  isStoreKeeper: boolean;
  onOpenReceiveModal: (challan: ChallanSummary) => void;
  reconciliation: ReconciliationData | null;
  reconciliationLoading: boolean;
  canCloseJob: boolean;
  onOpenCloseModal: () => void;
}

// Job Details & BOM Requirements Modal - moved verbatim out of
// pages/Jobs.tsx during the stabilization refactor. Jobs.tsx still owns all
// the underlying state and handlers; this component is purely
// presentational. Embeds JobReconciliationPanel, which was the same section
// of markup before the split.
export const JobDetailsModal: React.FC<JobDetailsModalProps> = ({
  isOpen,
  onClose,
  detailsLoading,
  detailedJob,
  jobChallans,
  isStoreKeeper,
  onOpenReceiveModal,
  reconciliation,
  reconciliationLoading,
  canCloseJob,
  onOpenCloseModal,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="2xl"
      icon={<Workflow className="w-5 h-5 text-[#807365]" />}
      title={detailedJob ? `Job Order: ${detailedJob.jobNumber}` : 'Job Details'}
      subtitle={
        detailedJob && (
          <div className="flex items-center gap-3 text-xs mt-1">
            <span>Vendor: <strong>{detailedJob.vendorId?.name}</strong></span>
            <span>•</span>
            <span>Status: <strong className="capitalize">{detailedJob.status}</strong></span>
          </div>
        )
      }
      footer={
        <button type="button" onClick={onClose} className="btn-secondary">
          Close
        </button>
      }
    >
      {detailsLoading ? (
        <div className="py-16 text-center text-sm text-[#6B6863] flex flex-col items-center gap-2.5">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#141414] border-t-transparent"></div>
          <span className="text-xs">Loading job requirements and challans...</span>
        </div>
      ) : detailedJob ? (
        <div className="space-y-6">
          {/* Circuits Ordered Section */}
          <div>
            <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Circuits Ordered
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {detailedJob.jobCircuits.map((jc: any) => (
                <div key={jc.circuitId} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                  <div className="font-mono font-bold text-slate-900">{jc.circuitCode}</div>
                  <div className="text-xs text-slate-600 truncate">{jc.name}</div>
                  <div className="mt-2 text-xs flex justify-between">
                    <span className="text-slate-500">Ordered:</span>
                    <span className="font-mono font-bold text-slate-900">{jc.orderedQty} units</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Material Requirements & Reservation Status */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Material Requirements & Reservation Status
              </h4>
              <div className="text-xs text-slate-500 font-mono">
                Total Reserved Components: {detailedJob.materialRequirement.length}
              </div>
            </div>
            <div className="enterprise-card overflow-hidden">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr>
                    <th className="th-enterprise">Part Code</th>
                    <th className="th-enterprise">Component Name</th>
                    <th className="th-enterprise text-right">Req / Circuit</th>
                    <th className="th-enterprise text-right">Total Req</th>
                    <th className="th-enterprise text-right">Reserved (This Job)</th>
                    <th className="th-enterprise text-right">Reserved (All Jobs)</th>
                    <th className="th-enterprise text-right">Available</th>
                    <th className="th-enterprise text-right">Issued Qty</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {detailedJob.materialRequirement.map((mat: any) => (
                    <tr key={mat.componentId}>
                      <td className="td-enterprise font-mono font-semibold">{mat.partCode}</td>
                      <td className="td-enterprise text-slate-600">{mat.name}</td>
                      <td className="td-enterprise text-right font-mono">{mat.totalRequiredQty}</td>
                      <td className="td-enterprise text-right font-mono font-semibold">{mat.totalRequiredQty}</td>
                      <td className="td-enterprise text-right font-mono font-bold text-[#168060]">{mat.reservedQty}</td>
                      <td className="td-enterprise text-right font-mono text-slate-500">{mat.totalReservedAllJobs ?? mat.reservedQty}</td>
                      <td className="td-enterprise text-right font-mono text-slate-700">{mat.availableStock ?? '—'}</td>
                      <td className="td-enterprise text-right font-mono">{mat.issuedQty}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Delivery Challans Linked */}
          {jobChallans.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Delivery Challans Issued ({jobChallans.length})
              </h4>
              <div className="space-y-3">
                {jobChallans.map((ch) => (
                  <div key={ch._id} className="p-3.5 rounded-lg border border-slate-200 bg-white">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Receipt className="w-4 h-4 text-slate-400" />
                        <span className="font-mono font-bold text-slate-900">{ch.challanNumber}</span>
                        <span className="text-xs text-slate-500">
                          ({new Date(ch.challanDate).toLocaleDateString()})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={ch.status === 'received' ? 'success' : 'warning'}>
                          {CHALLAN_STATUS_LABEL[ch.status] || ch.status}
                        </Badge>
                        {isStoreKeeper && ch.status !== 'received' && (
                          <button
                            onClick={() => onOpenReceiveModal(ch)}
                            className="btn-secondary px-2 py-0.5 text-xs text-[#168060] hover:bg-[#168060]/10"
                          >
                            Receive Unused / Damaged
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="text-xs text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                      {ch.items.map((it) => (
                        <span key={it.componentId} className="font-mono">
                          {it.partCode}: Issued {it.issuedQty} | Received {it.receivedQty} | Damaged {it.damagedQty}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Material & Finished-Circuit Reconciliation */}
          {(reconciliationLoading || reconciliation) && (
            <JobReconciliationPanel
              reconciliation={reconciliation}
              reconciliationLoading={reconciliationLoading}
              canClose={canCloseJob}
              onOpenCloseModal={onOpenCloseModal}
            />
          )}

          {detailedJob.status === 'closed' && (
            <div className="p-3.5 rounded-lg border border-[#168060]/30 bg-[#168060]/5 flex items-center gap-2.5">
              <Lock className="w-4 h-4 text-[#168060]" />
              <div className="text-xs text-[#12684e]">
                <span className="font-semibold">
                  {detailedJob.isShortClosed ? 'Short-closed' : 'Closed'}
                </span>
                {detailedJob.closedAt && <span> on {new Date(detailedJob.closedAt).toLocaleDateString()}</span>}
                {detailedJob.closeReason && <div className="mt-0.5 text-[#383531]">Reason: {detailedJob.closeReason}</div>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-slate-400">Failed to load job details.</p>
      )}
    </Modal>
  );
};
