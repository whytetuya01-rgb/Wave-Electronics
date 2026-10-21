import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';

export interface CommandItem {
  name: string;
  href: string;
  group: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: CommandItem[];
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ isOpen, onClose, items }) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const navigate = useNavigate();

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => item.name.toLowerCase().includes(q) || item.group.toLowerCase().includes(q));
  }, [items, query]);

  useEffect(() => {
    if (!isOpen) return;
    setQuery('');
    setActiveIndex(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 20);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!isOpen) return null;

  const openItem = (item: CommandItem) => {
    navigate(item.href);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[activeIndex]) openItem(results[activeIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-start justify-center px-4 pt-[12vh]">
      <div
        className="fixed inset-0 bg-[#171717]/40 backdrop-blur-[2px] modal-backdrop-animate"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Go to page"
        className="relative w-full max-w-[560px] bg-white rounded-2xl border border-[#E7E4DE] shadow-[0_24px_60px_-12px_rgba(23,23,23,0.28)] overflow-hidden modal-dialog-animate"
      >
        <div className="flex items-center gap-3 px-4 h-14 border-b border-[#EFECE7]">
          <Search className="w-[18px] h-[18px] text-[#807365] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Jump to a page..."
            className="flex-1 min-w-0 bg-transparent text-[15px] text-[#171717] outline-none placeholder:text-[#A69B8D]"
            aria-autocomplete="list"
          />
          <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded-[6px] bg-[#FAF9F7] border border-[#E7E4DE] text-[10px] font-mono text-[#807365]">
            Esc
          </kbd>
        </div>

        <ul role="listbox" className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="py-10 text-center text-sm text-[#716B64]">No pages match "{query}"</li>
          ) : (
            results.map((item, idx) => {
              const Icon = item.icon;
              const isActive = idx === activeIndex;
              return (
                <li key={item.href} role="option" aria-selected={isActive}>
                  <button
                    ref={(el) => {
                      optionRefs.current[idx] = el;
                    }}
                    type="button"
                    onMouseEnter={() => setActiveIndex(idx)}
                    onClick={() => openItem(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-[10px] text-left transition-colors duration-100 ${
                      isActive ? 'bg-[#F4F2EE]' : 'hover:bg-[#FAF9F7]'
                    }`}
                  >
                    <span
                      className={`w-8 h-8 rounded-[9px] flex items-center justify-center border shrink-0 transition-colors duration-100 ${
                        isActive
                          ? 'bg-[#141414] border-[#141414] text-[#D9D2C7]'
                          : 'bg-[#FAF9F7] border-[#E7E4DE] text-[#807365]'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[13.5px] font-medium text-[#171717] truncate">{item.name}</span>
                      <span className="block text-[11.5px] text-[#8A847C] truncate">{item.group}</span>
                    </span>
                    {isActive && <CornerDownLeft className="w-3.5 h-3.5 text-[#A69B8D] shrink-0" />}
                  </button>
                </li>
              );
            })
          )}
        </ul>

        <div className="hidden sm:flex items-center gap-4 px-4 py-2.5 border-t border-[#EFECE7] bg-[#FAF9F7] text-[11px] text-[#8A847C]">
          <span className="flex items-center gap-1">
            <ArrowUp className="w-3 h-3" />
            <ArrowDown className="w-3 h-3" />
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <CornerDownLeft className="w-3 h-3" />
            Open
          </span>
          <span>Esc to close</span>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default CommandPalette;
