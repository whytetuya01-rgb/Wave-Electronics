import React from 'react';
import { Modal } from '../ui/Modal';
import { ButtonSpinner } from '../ui/Loading';
import { Lock, ShieldAlert } from 'lucide-react';
import { ReconciliationData } from './jobTypes';

interface CloseJobModalProps {
  isOpen: boolean;
  onClose: () => void;
  closeIsShort: boolean;
  closeReason: string;
  onCloseReasonChange: (val: string) => void;
  closeError: string;
  closeSubmitting: boolean;
  onSubmit: () => void;
  reconciliation: ReconciliationData | null;
}

// Job Close / Short-Close Modal - moved verbatim out of pages/Jobs.tsx
// during the stabilization refactor. Jobs.tsx still owns all the underlying
// state and handlers; this component is purely presentational.
export const CloseJobModal: React.FC<CloseJobModalProps> = ({
  isOpen,
  onClose,
  closeIsShort,
  closeReason,
  onCloseReasonChange,
  closeError,
  closeSubmitting,
  onSubmit,
  reconciliation,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="md"
      icon={<Lock className="w-5 h-5 text-[#807365]" />}
      title={closeIsShort ? 'Short-Close Job' : 'Close Job'}
      subtitle={
        closeIsShort
          ? 'This job has outstanding circuit quantities or unreconciled material. Closing now requires admin approval and a reason.'
          : 'All circuits and material are fully reconciled. This job can be closed normally.'
      }
      footer={
        <>
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={closeSubmitting}
            className={closeIsShort ? 'btn-secondary border-[#C2413A]/40 text-[#C2413A] hover:bg-[#C2413A]/10' : 'btn-primary'}
          >
            {closeSubmitting && <ButtonSpinner />}
            <span>{closeSubmitting ? 'Closing Job...' : closeIsShort ? 'Short-Close Job' : 'Close Job'}</span>
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {closeError && <div className="p-2.5 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">{closeError}</div>}

        {!reconciliation?.closeEligible && (
          <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              This job is not fully reconciled - some circuits or components still have outstanding quantities. A normal close is not
              possible; short-closing requires a mandatory reason and will record the outstanding amounts for audit.
            </span>
          </div>
        )}

        {closeIsShort && (
          <div>
            <label className="label-text block mb-1.5">
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              required
              placeholder="e.g. Vendor unable to deliver remaining units - short-closing per manager approval"
              value={closeReason}
              onChange={(e) => onCloseReasonChange(e.target.value)}
              className="w-full px-3 py-2 rounded-[10px] border border-[#E6E3DE] text-sm text-[#171717] placeholder-[#6B6863]/60 focus:outline-none focus:ring-1 focus:ring-[#141414] focus:border-[#141414] transition-all bg-white"
            />
          </div>
        )}

        {!closeIsShort && (
          <p className="text-xs text-slate-500">
            Closing locks this job permanently. It will no longer accept material issues, receipts, or edits.
          </p>
        )}
      </div>
    </Modal>
  );
};
