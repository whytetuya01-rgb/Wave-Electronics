import React from 'react';
import { AlertCircle } from 'lucide-react';
import clsx from 'clsx';

export interface FormErrorProps {
  message?: string;
  id?: string;
  className?: string;
}

export const FormError: React.FC<FormErrorProps> = ({ message, id, className }) => {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className={clsx(
        'flex items-center gap-1.5 mt-1.5 text-xs text-[#C2413A] animate-in fade-in duration-150',
        className
      )}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0 text-[#C2413A]" />
      <span className="leading-tight font-medium">{message}</span>
    </div>
  );
};

export interface FormLabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  required?: boolean;
  optional?: boolean;
  badge?: string;
}

export const FormLabel: React.FC<FormLabelProps> = ({
  children,
  required,
  optional,
  badge,
  className,
  ...props
}) => {
  return (
    <label
      className={clsx('block text-[13px] font-medium text-[#171717] mb-1.5 select-none', className)}
      {...props}
    >
      <span>{children}</span>
      {required && <span className="text-[#C2413A] ml-1 font-semibold" aria-hidden="true">*</span>}
      {optional && <span className="text-[#716B64] text-xs font-normal ml-1.5">(Optional)</span>}
      {badge && (
        <span className="ml-2 px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#E8E6E2] text-[#716B64]">
          {badge}
        </span>
      )}
    </label>
  );
};

export interface FormFieldProps {
  label?: React.ReactNode;
  required?: boolean;
  optional?: boolean;
  error?: string;
  helperText?: React.ReactNode;
  hint?: React.ReactNode;
  id?: string;
  className?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  optional,
  error,
  helperText,
  hint,
  id,
  className,
  children,
}) => {
  const errorId = id ? `${id}-error` : undefined;
  const helperId = id ? `${id}-helper` : undefined;
  const helper = helperText || hint;

  return (
    <div className={clsx('space-y-1', className)}>
      {label && (
        <FormLabel htmlFor={id} required={required} optional={optional}>
          {label}
        </FormLabel>
      )}
      {children}
      {error ? (
        <FormError message={error} id={errorId} />
      ) : helper ? (
        <p id={helperId} className="text-xs text-[#716B64] mt-1 leading-normal">
          {helper}
        </p>
      ) : null}
    </div>
  );
};

export interface FormSectionProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
  children?: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  description,
  action,
  className,
  children,
}) => {
  return (
    <div className={clsx('pt-4 border-t border-[#E7E4DE] first:pt-0 first:border-t-0', className)}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="text-sm font-semibold text-[#171717] tracking-tight">{title}</h4>
          {description && (
            <p className="text-xs text-[#716B64] mt-0.5 leading-normal">{description}</p>
          )}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
};

export default FormField;
