import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as PopoverPrimitive from '@radix-ui/react-popover';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import clsx from 'clsx';

export interface SearchableOption {
  value: string;
  label: string;
  sublabel?: string;
  badge?: string;
  disabled?: boolean;
}

export interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  className?: string;
  triggerClassName?: string;
  id?: string;
  name?: string;
  allowClear?: boolean;
  'aria-describedby'?: string;
  'aria-invalid'?: boolean | 'true' | 'false';
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  searchPlaceholder = 'Search...',
  disabled = false,
  hasError = false,
  className,
  triggerClassName,
  id,
  allowClear = false,
  'aria-describedby': ariaDescribedBy,
  'aria-invalid': ariaInvalid,
}) => {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedOption = useMemo(
    () => options.find((opt) => opt.value === value),
    [options, value]
  );

  const filteredOptions = useMemo(() => {
    if (!searchQuery.trim()) return options;
    const q = searchQuery.toLowerCase().trim();
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(q) ||
        (opt.sublabel && opt.sublabel.toLowerCase().includes(q)) ||
        (opt.badge && opt.badge.toLowerCase().includes(q))
    );
  }, [options, searchQuery]);

  useEffect(() => {
    if (open) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[highlightedIndex] && !filteredOptions[highlightedIndex].disabled) {
        onChange(filteredOptions[highlightedIndex].value);
        setOpen(false);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          id={id}
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          className={clsx(
            'flex h-10 w-full items-center justify-between rounded-[10px] border bg-white px-3.5 py-2 text-sm text-[#171717] transition-all duration-180 select-none text-left',
            'focus:outline-none focus:ring-2 focus:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50',
            hasError || Boolean(ariaInvalid && ariaInvalid !== 'false')
              ? 'border-[#C2413A] focus:border-[#C2413A] focus:ring-[#C2413A]/20'
              : 'border-[#E7E4DE] hover:border-[#D8D4CE] focus:border-[#171717] focus:ring-[#807365]/20',
            triggerClassName,
            className
          )}
        >
          <div className="flex-1 truncate pr-2">
            {selectedOption ? (
              <span className="font-normal text-[#171717]">{selectedOption.label}</span>
            ) : (
              <span className="text-[#A69B8D]">{placeholder}</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {allowClear && selectedOption && !disabled && (
              <span
                role="button"
                tabIndex={0}
                onClick={(e) => {
                  e.stopPropagation();
                  onChange('');
                }}
                className="p-0.5 rounded hover:bg-[#E8E6E2]/60 text-[#716B64] hover:text-[#171717]"
              >
                <X className="w-3.5 h-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 text-[#807365] opacity-70" />
          </div>
        </button>
      </PopoverPrimitive.Trigger>

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={4}
          className={clsx(
            'z-[2000] w-[var(--radix-popover-trigger-width)] min-w-[260px] max-w-[480px] rounded-[10px] border border-[#E7E4DE] bg-white p-1 text-[#171717] shadow-[0_12px_32px_-4px_rgba(23,23,23,0.12),0_4px_6px_-2px_rgba(23,23,23,0.04)] outline-none',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
          onKeyDown={handleKeyDown}
        >
          {/* Search Input Box */}
          <div className="flex items-center border-b border-[#E7E4DE] px-2.5 py-1.5">
            <Search className="mr-2 h-3.5 w-3.5 shrink-0 text-[#807365]" />
            <input
              ref={inputRef}
              type="text"
              placeholder={searchPlaceholder}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-7 w-full bg-transparent text-xs text-[#171717] placeholder:text-[#A69B8D] focus:outline-none"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="p-0.5 text-[#716B64] hover:text-[#171717]"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Options List */}
          <div ref={listRef} className="max-h-60 overflow-y-auto p-1 text-sm space-y-0.5">
            {filteredOptions.length === 0 ? (
              <div className="py-4 text-center text-xs text-[#716B64]">
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt, index) => {
                const isSelected = opt.value === value;
                const isHighlighted = index === highlightedIndex;

                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      if (!opt.disabled) {
                        onChange(opt.value);
                        setOpen(false);
                      }
                    }}
                    onMouseEnter={() => setHighlightedIndex(index)}
                    className={clsx(
                      'relative flex cursor-pointer select-none items-center justify-between rounded-[7px] px-2.5 py-2 text-xs transition-colors duration-120 outline-none',
                      opt.disabled && 'pointer-events-none opacity-40',
                      isHighlighted ? 'bg-[#FAF9F7]' : '',
                      isSelected ? 'font-medium text-[#171717] bg-[#FAF9F7]' : 'text-[#171717]'
                    )}
                  >
                    <div className="flex flex-col min-w-0 pr-2">
                      <div className="flex items-center gap-1.5">
                        <span className="truncate">{opt.label}</span>
                        {opt.badge && (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-[#E8E6E2]/60 text-[#716B64]">
                            {opt.badge}
                          </span>
                        )}
                      </div>
                      {opt.sublabel && (
                        <span className="text-[11px] text-[#716B64] truncate">{opt.sublabel}</span>
                      )}
                    </div>
                    {isSelected && <Check className="h-3.5 w-3.5 text-[#807365] shrink-0" />}
                  </div>
                );
              })
            )}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
};

export default SearchableSelect;
