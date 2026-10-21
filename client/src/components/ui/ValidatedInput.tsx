import React from 'react';
import clsx from 'clsx';

export interface ValidatedInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftIcon?: React.ReactNode;
  rightElement?: React.ReactNode;
  hasError?: boolean;
  error?: string;
}

export const ValidatedInput = React.forwardRef<HTMLInputElement, ValidatedInputProps>(
  (
    {
      leftIcon,
      rightElement,
      hasError,
      error,
      className,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const isInvalid = Boolean(hasError || error || (ariaInvalid && ariaInvalid !== 'false'));
    const errorId = error && id ? `${id}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="relative w-full">
        {leftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none flex items-center justify-center text-[#807365] [&>svg]:w-4 [&>svg]:h-4">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={id}
          aria-invalid={isInvalid}
          aria-describedby={describedBy}
          className={clsx(
            'w-full h-10 rounded-[10px] border bg-white px-3.5 py-2 text-sm text-[#171717] placeholder:text-[#A69B8D] transition-all duration-180',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#FAF9F7]',
            leftIcon ? '!pl-10' : '!pl-3.5',
            rightElement ? '!pr-10' : '!pr-3.5',
            isInvalid
              ? 'border-[#C2413A] focus:border-[#C2413A] focus:ring-[#C2413A]/20'
              : 'border-[#E7E4DE] hover:border-[#D8D4CE] focus:border-[#171717] focus:ring-[#807365]/20',
            className
          )}
          {...props}
        />
        {rightElement && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center text-[#807365] [&>svg]:w-4 [&>svg]:h-4">
            {rightElement}
          </div>
        )}
      </div>
    );
  }
);
ValidatedInput.displayName = 'ValidatedInput';

export interface ValidatedTextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  hasError?: boolean;
  error?: string;
}

export const ValidatedTextarea = React.forwardRef<HTMLTextAreaElement, ValidatedTextareaProps>(
  (
    {
      hasError,
      error,
      className,
      id,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': ariaInvalid,
      ...props
    },
    ref
  ) => {
    const isInvalid = Boolean(hasError || error || (ariaInvalid && ariaInvalid !== 'false'));
    const errorId = error && id ? `${id}-error` : undefined;
    const describedBy = [ariaDescribedBy, errorId].filter(Boolean).join(' ') || undefined;

    return (
      <div className="relative w-full">
        <textarea
          ref={ref}
          id={id}
          aria-invalid={isInvalid}
          aria-describedby={describedBy}
          className={clsx(
            'w-full rounded-[10px] border bg-white p-3 text-sm text-[#171717] placeholder:text-[#A69B8D] transition-all duration-180',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[#FAF9F7]',
            isInvalid
              ? 'border-[#C2413A] focus:border-[#C2413A] focus:ring-[#C2413A]/20'
              : 'border-[#E7E4DE] hover:border-[#D8D4CE] focus:border-[#171717] focus:ring-[#807365]/20',
            className
          )}
          {...props}
        />
      </div>
    );
  }
);
ValidatedTextarea.displayName = 'ValidatedTextarea';

export default ValidatedInput;
