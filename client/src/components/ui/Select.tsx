import React from 'react';
import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown, ChevronUp } from 'lucide-react';
import clsx from 'clsx';

export const Select = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps
  extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger> {
  hasError?: boolean;
}

export const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  SelectTriggerProps
>(({ className, children, hasError, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={clsx(
      'flex h-10 w-full items-center justify-between rounded-[10px] border bg-white px-3.5 py-2 text-sm text-[#171717] placeholder:text-[#A69B8D] transition-all duration-180 select-none',
      'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
      hasError
        ? 'border-[#C2413A] focus:border-[#C2413A] focus:ring-[#C2413A]/20'
        : 'border-[#E7E4DE] hover:border-[#D8D4CE] focus:border-[#171717] focus:ring-[#807365]/20',
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 text-[#807365] transition-transform duration-180 ease-out group-data-[state=open]:rotate-180 shrink-0 ml-2" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

export const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={clsx('flex cursor-default items-center justify-center py-1 text-[#807365]', className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

export const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={clsx('flex cursor-default items-center justify-center py-1 text-[#807365]', className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

export const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = 'popper', ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={clsx(
        'relative z-[2000] max-h-72 min-w-[8rem] overflow-hidden rounded-[10px] border border-[#E7E4DE] bg-white text-[#171717] shadow-[0_12px_32px_-4px_rgba(23,23,23,0.12),0_4px_6px_-2px_rgba(23,23,23,0.04)]',
        'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-1 data-[side=top]:slide-in-from-bottom-1',
        position === 'popper' &&
          'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
        className
      )}
      position={position}
      {...props}
    >
      <SelectScrollUpButton />
      <SelectPrimitive.Viewport
        className={clsx(
          'p-1.5',
          position === 'popper' &&
            'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]'
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
      <SelectScrollDownButton />
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
));
SelectContent.displayName = SelectPrimitive.Content.displayName;

export const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label
    ref={ref}
    className={clsx('px-2 py-1.5 text-xs font-semibold uppercase tracking-wider text-[#716B64]', className)}
    {...props}
  />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

export const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={clsx(
      'relative flex w-full cursor-pointer select-none items-center rounded-[7px] py-2 pl-3 pr-8 text-sm text-[#171717] outline-none transition-colors duration-120',
      'hover:bg-[#FAF9F7] focus:bg-[#FAF9F7] focus:text-[#171717]',
      'data-[disabled]:pointer-events-none data-[disabled]:opacity-40',
      'data-[state=checked]:bg-[#FAF9F7] data-[state=checked]:font-medium',
      className
    )}
    {...props}
  >
    <span className="absolute right-2.5 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4 text-[#807365]" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
));
SelectItem.displayName = SelectPrimitive.Item.displayName;

export const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator
    ref={ref}
    className={clsx('-mx-1 my-1 h-px bg-[#E7E4DE]', className)}
    {...props}
  />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

/**
 * Convenient Controlled Single-Select Component
 */
export interface SimpleSelectOption {
  value: string;
  label: string;
  disabled?: boolean;
  sublabel?: string;
}

export interface SimpleSelectProps {
  value: string;
  onChange?: (value: string) => void;
  onValueChange?: (value: string) => void;
  options: SimpleSelectOption[];
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  name?: string;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

export const SimpleSelect: React.FC<SimpleSelectProps> = ({
  value,
  onChange,
  onValueChange,
  options,
  placeholder = 'Select an option...',
  disabled = false,
  hasError = false,
  className,
  triggerClassName,
  id,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}) => {
  const handler = onValueChange || onChange;
  return (
    <Select
      value={value || ''}
      onValueChange={(val) => {
        if (handler) {
          handler(val === '__EMPTY__' ? '' : val);
        }
      }}
      disabled={disabled}
    >
      <SelectTrigger
        id={id}
        hasError={hasError || Boolean(ariaInvalid && ariaInvalid !== 'false')}
        className={clsx(triggerClassName, className)}
        aria-describedby={ariaDescribedBy}
        aria-invalid={ariaInvalid}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem
            key={opt.value || '__EMPTY__'}
            value={opt.value || '__EMPTY__'}
            disabled={opt.disabled}
          >
            <div className="flex flex-col">
              <span>{opt.label}</span>
              {opt.sublabel && (
                <span className="text-[11px] text-[#716B64] font-normal">{opt.sublabel}</span>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
