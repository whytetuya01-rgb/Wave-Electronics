import React from 'react';
import { Badge } from '../ui/Badge';
import { BarChart3, Lock, ShieldAlert } from 'lucide-react';
import { ReconciliationData } from './jobTypes';

interface JobReconciliationPanelProps {
  reconciliation: ReconciliationData | null;
  reconciliationLoading: boolean;
  canClose: boolean;
  onOpenCloseModal: () => void;
}

// Material & Finished-Circuit Reconciliation panel, embedded inside the Job
// Details modal. Moved verbatim out of pages/Jobs.tsx during the
// stabilization refactor. Jobs.tsx still owns all the underlying state and
// handlers (including fetching the reconciliation data); this component is
// purely presentational.
export const JobReconciliationPanel: React.FC<JobReconciliationPanelProps> = ({
  reconciliation,
  reconciliationLoading,
  canClose,
  onOpenCloseModal,
}) => {
  if (!reconciliationLoading && !reconciliation) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 className="w-3.5 h-3.5" /> Material & Finished-Circuit Reconciliation
        </h4>
        {reconciliation && (
          <Badge variant={reconciliation.closeEligible ? 'success' : 'warning'}>
            {reconciliation.closeEligible ? 'Fully Reconciled' : 'Outstanding Items'}
          </Badge>
        )}
      </div>
      {reconciliationLoading ? (
        <div className="py-4 text-center text-xs text-slate-400">Computing reconciliation...</div>
      ) : reconciliation ? (
        <div className="space-y-3">
          <div className="enterprise-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="th-enterprise">Circuit</th>
                  <th className="th-enterprise text-right">Ordered</th>
                  <th className="th-enterprise text-right">Good</th>
                  <th className="th-enterprise text-right">Rejected</th>
                  <th className="th-enterprise text-right">Remaining</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliation.circuits.map((c) => (
                  <tr key={c.jobCircuitId} className={c.isFullyAccounted ? '' : 'bg-amber-50/50'}>
                    <td className="td-enterprise font-mono font-semibold">{c.circuitCode}</td>
                    <td className="td-enterprise text-right font-mono">{c.orderedQty}</td>
                    <td className="td-enterprise text-right font-mono text-[#168060]">{c.receivedGoodQty}</td>
                    <td className="td-enterprise text-right font-mono text-[#C2413A]">{c.receivedRejectedQty}</td>
                    <td className="td-enterprise text-right font-mono font-bold">{c.remaining > 0 ? c.remaining : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="enterprise-card overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead>
                <tr>
                  <th className="th-enterprise">Component</th>
                  <th className="th-enterprise text-right">Issued</th>
                  <th className="th-enterprise text-right">Consumed</th>
                  <th className="th-enterprise text-right">Returned</th>
                  <th className="th-enterprise text-right">Damaged</th>
                  <th className="th-enterprise text-right">With Vendor</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reconciliation.components.map((c) => (
                  <tr key={c.componentId} className={c.isFullyReconciled ? '' : 'bg-amber-50/50'}>
                    <td className="td-enterprise font-mono font-semibold">{c.partCode}</td>
                    <td className="td-enterprise text-right font-mono">{c.issuedQty}</td>
                    <td className="td-enterprise text-right font-mono">{c.consumedQty}</td>
                    <td className="td-enterprise text-right font-mono text-[#168060]">{c.returnedQty}</td>
                    <td className="td-enterprise text-right font-mono text-[#C2413A]">{c.damagedQty}</td>
                    <td className="td-enterprise text-right font-mono font-bold">
                      {c.remainingWithVendor > 0 ? c.remainingWithVendor : '—'}
                      {c.ledgerDiscrepancy !== 0 && (
                        <span title={`Ledger discrepancy: ${c.ledgerDiscrepancy}`}>
                          <ShieldAlert className="inline w-3 h-3 ml-1 text-red-600" />
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {canClose && (
            <div className="flex justify-end">
              <button onClick={onOpenCloseModal} className="btn-secondary text-xs py-1.5 border-[#141414]/20">
                <Lock className="w-3.5 h-3.5" />
                {reconciliation.closeEligible ? 'Close Job' : 'Short-Close Job'}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
};
