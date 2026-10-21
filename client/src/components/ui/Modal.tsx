import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-[460px]',     // Delete / Approval / Confirmation (420–480px)
  md: 'max-w-[620px]',     // Small Add/Edit form, Stock Adjustment (560–680px)
  lg: 'max-w-[860px]',     // Component / Vendor form (760–960px)
  xl: 'max-w-[1020px]',    // Details popup, Printable vouchers (850–1050px)
  '2xl': 'max-w-[1180px]', // Stock Inward, BOM Builder, Create Job, Material Issue (1050–1200px)
  full: 'max-w-[1280px] w-[95vw]', // Complex receipt / reconciliation / deep audit tables (1100–1300px)
};

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  size?: ModalSize;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerAction?: React.ReactNode;
  headerBanner?: React.ReactNode;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  className?: string;
  bodyClassName?: string;
  onSubmit?: (e: React.FormEvent) => void;
}

export const Modal: React.FC<ModalProps> & {
  Header: typeof ModalHeader;
  Body: typeof ModalBody;
  Footer: typeof ModalFooter;
} = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon,
  size = 'lg',
  children,
  footer,
  headerAction,
  headerBanner,
  // Off by default: a stray click outside a dialog must never discard a
  // half-filled form. Dialogs close via the X, Cancel, or Esc.
  closeOnBackdropClick = false,
  closeOnEsc = true,
  className = '',
  bodyClassName = '',
  onSubmit,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeOnEscRef = useRef(closeOnEsc);
  closeOnEscRef.current = closeOnEsc;
  const hasFocusedRef = useRef(false);

  // Lock body scroll and trap focus when modal is open
  useEffect(() => {
    if (!isOpen) {
      hasFocusedRef.current = false;
      return;
    }

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus trapping and keyboard event handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEscRef.current && e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            lastElement.focus();
            e.preventDefault();
          }
        } else {
          if (document.activeElement === lastElement) {
            firstElement.focus();
            e.preventDefault();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    // Initial focus: only run once upon modal opening.
    // Never steal focus if an element inside the dialog already has focus.
    let focusTimer: ReturnType<typeof setTimeout> | undefined;
    if (!hasFocusedRef.current) {
      hasFocusedRef.current = true;
      focusTimer = setTimeout(() => {
        if (!modalRef.current) return;
        // If focus is already inside dialog, do not steal focus
        if (modalRef.current.contains(document.activeElement)) return;

        // Target the first form input (never target header close button)
        const firstFormInput = modalRef.current.querySelector<HTMLElement>(
          'form input:not([disabled]):not([type="hidden"]), form select:not([disabled]), form textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled])'
        );
        if (firstFormInput) {
          firstFormInput.focus();
        } else {
          modalRef.current.focus();
        }
      }, 50);
    }

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      if (focusTimer) clearTimeout(focusTimer);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg;

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-hidden select-none">
      {/* Refined Charcoal Overlay (rgba(23, 23, 23, 0.42) + 3px blur) */}
      <div
        className={`fixed inset-0 bg-[#171717]/45 backdrop-blur-[3px] transition-opacity duration-200 ${
          closeOnBackdropClick ? 'cursor-pointer' : ''
        }`}
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Dialog Window */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative bg-white rounded-2xl shadow-[0_24px_50px_-12px_rgba(23,23,23,0.18)] border border-[#E7E4DE] w-full ${sizeClass} flex flex-col max-h-[90dvh] overflow-hidden modal-dialog-animate z-10 outline-none ${className}`}
      >
        {/* Optional Custom Header Banner (e.g., customized printable vouchers) */}
        {headerBanner}

        {/* Refined White Header */}
        {title && !headerBanner && (
          <div className="px-6 sm:px-7 py-4 sm:py-[18px] bg-white border-b border-[#EFECE7] flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
              {icon && (
                <div className="w-10 h-10 rounded-[11px] bg-[#141414] ring-1 ring-[#303030] flex items-center justify-center shrink-0 shadow-[0_4px_12px_-4px_rgba(20,20,20,0.35)] [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:text-[#D9D2C7]">
                  {icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="text-[17px] sm:text-[18px] font-semibold text-[#171717] tracking-tight leading-snug break-words">
                  {title}
                </h3>
                {subtitle && (
                  <div className="text-xs sm:text-[13px] text-[#716B64] mt-1 leading-normal max-w-2xl">
                    {subtitle}
                  </div>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 -mr-1 -mt-0.5">
              {headerAction}
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-[8px] text-[#716B64] hover:text-[#171717] hover:bg-[#FAF9F7] transition-colors duration-180"
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Area: Wrapped in Form if onSubmit is specified */}
        {onSubmit ? (
          <form onSubmit={onSubmit} noValidate className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className={`flex-1 min-h-0 overflow-y-auto px-6 sm:px-7 py-6 select-text ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <div className="px-6 sm:px-7 py-3.5 bg-[#FAF9F7] border-t border-[#EFECE7] flex items-center justify-end gap-2.5 shrink-0">
                {footer}
              </div>
            )}
          </form>
        ) : (
          <>
            <div className={`flex-1 min-h-0 overflow-y-auto px-6 sm:px-7 py-6 select-text ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <div className="px-6 sm:px-7 py-3.5 bg-[#FAF9F7] border-t border-[#EFECE7] flex items-center justify-end gap-2.5 shrink-0">
                {footer}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : null;
};

/* Compound Components for Custom Dialog Layouts */
export const ModalHeader: React.FC<{
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose?: () => void;
  dark?: boolean;
  icon?: React.ComponentType<{ className?: string }> | React.ReactNode;
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}> = ({ title, subtitle, onClose, icon, badge, action, className = '' }) => (
  <div
    className={`px-6 sm:px-7 py-4 sm:py-[18px] bg-white border-b border-[#EFECE7] flex items-center justify-between shrink-0 ${className}`}
  >
    <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-4">
      {icon && (
        <div
          className="w-10 h-10 rounded-[11px] bg-[#141414] ring-1 ring-[#303030] flex items-center justify-center shrink-0 shadow-[0_4px_12px_-4px_rgba(20,20,20,0.35)] [&_svg]:w-[18px] [&_svg]:h-[18px] [&_svg]:text-[#D9D2C7]"
        >
          {React.isValidElement(icon) ? icon : typeof icon === 'function' ? React.createElement(icon, { className: 'w-5 h-5' }) : null}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className="text-[17px] sm:text-[18px] font-semibold text-[#171717] tracking-tight leading-snug">
            {title}
          </h3>
          {badge}
        </div>
        {subtitle && (
          <div className="text-xs sm:text-[13px] text-[#716B64] mt-1 leading-normal max-w-2xl">{subtitle}</div>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0 -mr-1 -mt-0.5">
      {action}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-[8px] text-[#716B64] hover:text-[#171717] hover:bg-[#FAF9F7] transition-colors duration-180"
          aria-label="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  </div>
);

export const ModalBody: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`flex-1 min-h-0 overflow-y-auto px-6 sm:px-7 py-6 select-text ${className}`}>{children}</div>
);

export const ModalFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`px-6 sm:px-7 py-3.5 bg-[#FAF9F7] border-t border-[#EFECE7] flex items-center justify-end gap-2.5 shrink-0 ${className}`}>
    {children}
  </div>
);

/* Confirmation Dialog Component (Linear/Attio inspired compact confirmation) */
export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'primary';
  icon?: React.ReactNode;
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  icon,
  isLoading = false,
}) => {
  const getIcon = () => {
    if (icon) return icon;
    if (variant === 'danger') {
      return <AlertTriangle className="w-5 h-5 text-[#C2413A]" />;
    }
    if (variant === 'warning') {
      return <AlertTriangle className="w-5 h-5 text-[#B7791F]" />;
    }
    return <CheckCircle2 className="w-5 h-5 text-[#168060]" />;
  };

  const getIconContainerStyle = () => {
    if (variant === 'danger') {
      return 'bg-[#C2413A]/10 border-[#C2413A]/25 text-[#C2413A]';
    }
    if (variant === 'warning') {
      return 'bg-[#B7791F]/10 border-[#B7791F]/25 text-[#B7791F]';
    }
    return 'bg-[#168060]/10 border-[#168060]/25 text-[#168060]';
  };

  const getConfirmBtnClass = () => {
    if (variant === 'danger') return 'btn-danger';
    return 'btn-primary';
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      className="p-0"
    >
      <div className="p-6 sm:p-7">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-[10px] flex items-center justify-center shrink-0 border ${getIconContainerStyle()}`}
          >
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#171717] tracking-tight leading-snug">{title}</h3>
            <div className="text-sm text-[#716B64] mt-2 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-[#E7E4DE]">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={getConfirmBtnClass()}
          >
            {isLoading ? 'Processing...' : confirmText}
          </button>
        </div>
      </div>
    </Modal>
  );
};

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

// Aliases for enterprise consistency
export const AppDialog = Modal;
export const AppDialogHeader = ModalHeader;
export const AppDialogBody = ModalBody;
export const AppDialogFooter = ModalFooter;
export const AppConfirmDialog = ConfirmModal;
