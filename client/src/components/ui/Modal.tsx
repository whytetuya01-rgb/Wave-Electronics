import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X, AlertTriangle, CheckCircle2 } from 'lucide-react';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | 'full';

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-[420px]',     // Confirmation, Delete, Duplicates (420px)
  md: 'max-w-[560px]',     // Small info, Quick status popups, Adjustments (560px)
  lg: 'max-w-[720px]',     // Simple Add/Edit forms (Vendors, Simple entities) (720px)
  xl: 'max-w-[960px]',     // Detailed Add/Edit forms (Components with specs, Vouchers) (960px)
  '2xl': 'max-w-[1200px]', // BOM Builder, GIN Entry, Job Creation & Details (1200px)
  full: 'max-w-[95vw]',    // Deep audit tables & maximum-width analysis (95vw)
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
  darkHeader?: boolean;
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
  darkHeader = true,
  closeOnBackdropClick = true,
  closeOnEsc = true,
  className = '',
  bodyClassName = '',
  onSubmit,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);

  // Lock body scroll and trap focus when modal is open
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus trapping and keyboard event handling
    const handleKeyDown = (e: KeyboardEvent) => {
      if (closeOnEsc && e.key === 'Escape') {
        e.stopPropagation();
        onClose();
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

    // Initial focus on first interactive element or dialog
    const focusTimer = setTimeout(() => {
      if (modalRef.current) {
        const firstInput = modalRef.current.querySelector<HTMLElement>(
          'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])'
        );
        if (firstInput) {
          firstInput.focus();
        } else {
          modalRef.current.focus();
        }
      }
    }, 50);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(focusTimer);
    };
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const sizeClass = SIZE_CLASSES[size] || SIZE_CLASSES.lg;

  const modalContent = (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-3 sm:p-5 md:p-6 overflow-hidden select-none">
      {/* Elegant Dark Charcoal Translucent Backdrop (rgba(15,15,15,0.45) + 3px blur) */}
      <div
        className="fixed inset-0 modal-overlay-bg modal-backdrop-animate cursor-pointer"
        onClick={closeOnBackdropClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal Dialog Window */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={`relative bg-white rounded-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] border border-[#E6E3DE] w-full ${sizeClass} flex flex-col max-h-[90dvh] sm:max-h-[90vh] overflow-hidden modal-dialog-animate z-10 outline-none ${className}`}
      >
        {/* Optional Custom Header Banner (e.g., custom voucher view) */}
        {headerBanner}

        {/* Standard Modal Header (Linear / Attio signature deep dark styling by default) */}
        {title && !headerBanner && (
          <div
            className={`px-6 sm:px-8 py-5 sm:py-6 flex items-start justify-between shrink-0 border-b ${
              darkHeader
                ? 'bg-[#141414] text-white border-[#252525]'
                : 'bg-white text-[#171717] border-[#E6E3DE]'
            }`}
          >
            <div className="flex items-start gap-4 sm:gap-4.5 flex-1 min-w-0 pr-4">
              {icon && (
                <div
                  className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 border mt-0.5 ${
                    darkHeader
                      ? 'bg-[#1C1C1C] border-[#303030] text-[#A69B8D] shadow-xs [&_svg]:text-[#A69B8D]'
                      : 'bg-[#F7F6F3] border-[#E6E3DE] text-[#807365]'
                  }`}
                >
                  {icon}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3
                  className={`text-base sm:text-lg font-semibold tracking-tight leading-snug break-words ${
                    darkHeader ? 'text-white' : 'text-[#171717]'
                  }`}
                >
                  {title}
                </h3>
                {subtitle && (
                  <p
                    className={`text-xs sm:text-[13px] mt-1.5 sm:mt-2 leading-relaxed max-w-2xl ${
                      darkHeader ? 'text-[#A69B8D]' : 'text-[#6B6863]'
                    }`}
                  >
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 -mr-1 -mt-0.5">
              {headerAction}
              <button
                type="button"
                onClick={onClose}
                className={`p-2 rounded-[8px] transition-colors duration-180 ${
                  darkHeader
                    ? 'text-[#A69B8D] hover:text-white hover:bg-[#252525]'
                    : 'text-[#6B6863] hover:text-[#171717] hover:bg-[#F7F6F3]'
                }`}
                aria-label="Close dialog"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        )}

        {/* Content Area: Wrapped in Form if onSubmit is specified */}
        {onSubmit ? (
          <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
            <div className={`flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6 select-text ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <div className="px-6 sm:px-8 py-4.5 bg-[#FAF9F7] border-t border-[#E6E3DE] flex items-center justify-end gap-3 shrink-0">
                {footer}
              </div>
            )}
          </form>
        ) : (
          <>
            <div className={`flex-1 min-h-0 overflow-y-auto px-6 sm:px-8 py-6 select-text ${bodyClassName}`}>
              {children}
            </div>

            {footer && (
              <div className="px-6 sm:px-8 py-4.5 bg-[#FAF9F7] border-t border-[#E6E3DE] flex items-center justify-end gap-3 shrink-0">
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
}> = ({ title, subtitle, onClose, dark = true, icon, badge, action, className = '' }) => (
  <div
    className={`px-6 sm:px-8 py-5 sm:py-6 flex items-start justify-between shrink-0 border-b ${
      dark
        ? 'bg-[#141414] text-white border-[#252525]'
        : 'bg-white text-[#171717] border-[#E6E3DE]'
    } ${className}`}
  >
    <div className="flex items-start gap-4 sm:gap-4.5 flex-1 min-w-0 pr-4">
      {icon && (
        <div
          className={`w-11 h-11 rounded-[12px] flex items-center justify-center shrink-0 border mt-0.5 ${
            dark ? 'bg-[#1C1C1C] border border-[#303030] text-[#A69B8D] [&_svg]:text-[#A69B8D]' : 'bg-[#F7F6F3] border border-[#E6E3DE] text-[#807365]'
          }`}
        >
          {React.isValidElement(icon) ? icon : typeof icon === 'function' ? React.createElement(icon, { className: 'w-5 h-5' }) : null}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <h3 className={`text-base sm:text-lg font-semibold tracking-tight leading-snug ${dark ? 'text-white' : 'text-[#171717]'}`}>
            {title}
          </h3>
          {badge}
        </div>
        {subtitle && (
          <p className={`text-xs sm:text-[13px] mt-1.5 sm:mt-2 leading-relaxed max-w-2xl ${dark ? 'text-[#A69B8D]' : 'text-[#6B6863]'}`}>{subtitle}</p>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2 shrink-0 -mr-1 -mt-0.5">
      {action}
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className={`p-2 rounded-[8px] transition-colors ${
            dark ? 'text-[#A69B8D] hover:text-white hover:bg-[#252525]' : 'text-[#6B6863] hover:text-[#171717] hover:bg-[#F7F6F3]'
          }`}
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
  <div className={`flex-1 min-h-0 overflow-y-auto px-6 py-5 select-text ${className}`}>{children}</div>
);

export const ModalFooter: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div className={`px-6 py-4 bg-[#FAF9F7] border-t border-[#E6E3DE] flex items-center justify-end gap-2.5 shrink-0 ${className}`}>
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
      return 'bg-[#C2413A]/10 border-[#C2413A]/20 text-[#C2413A]';
    }
    if (variant === 'warning') {
      return 'bg-[#B7791F]/10 border-[#B7791F]/20 text-[#B7791F]';
    }
    return 'bg-[#168060]/10 border-[#168060]/20 text-[#168060]';
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
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div
            className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${getIconContainerStyle()}`}
          >
            {getIcon()}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-[#171717] tracking-tight">{title}</h3>
            <div className="text-sm text-[#6B6863] mt-2 leading-relaxed">
              {description}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-[#E6E3DE]">
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
