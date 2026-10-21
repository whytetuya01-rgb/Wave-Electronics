import React from 'react';
import { Modal } from '../ui/Modal';
import { ButtonSpinner } from '../ui/Loading';
import { FormField } from '../ui/FormField';
import { ValidatedTextarea } from '../ui/ValidatedInput';
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
        {closeError && (
          <div className="p-2.5 rounded-md bg-[#C2413A]/10 border border-[#C2413A]/25 text-[#C2413A] text-xs">
            {closeError}
          </div>
        )}

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
            <FormField label="Reason for Short-Closing" required error={closeError ? closeError : undefined}>
              <ValidatedTextarea
                rows={3}
                required
                placeholder="e.g. Vendor unable to deliver remaining units - short-closing per manager approval"
                value={closeReason}
                onChange={(e) => onCloseReasonChange(e.target.value)}
                hasError={!!closeError && !closeReason.trim()}
              />
            </FormField>
          </div>
        )}

        {!closeIsShort && (
          <p className="text-xs text-[#6B6863]">
            Closing locks this job permanently. It will no longer accept material issues, receipts, or edits.
          </p>
        )}
      </div>
    </Modal>
  );
};
