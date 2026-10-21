import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { SimpleSelect } from './Select';

export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

interface TablePaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  itemLabel?: string;
  className?: string;
}

// Page buttons with ellipses: always the first and last page, plus a window
// around the current one - e.g. 1 … 4 5 6 … 20.
function getPageItems(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  if (page <= 3) [2, 3, 4].forEach((p) => pages.add(p));
  if (page >= totalPages - 2) [totalPages - 3, totalPages - 2, totalPages - 1].forEach((p) => pages.add(p));
  const sorted = [...pages].filter((p) => p >= 1 && p <= totalPages).sort((a, b) => a - b);
  const items: (number | 'gap')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1] > 1) items.push('gap');
    items.push(p);
  });
  return items;
}

const navBtn =
  'w-8 h-8 inline-flex items-center justify-center rounded-[8px] border border-[#E6E3DE] bg-white text-[#6B6863] hover:text-[#171717] hover:border-[#D8D4CE] disabled:opacity-40 disabled:pointer-events-none transition-colors';

export const TablePagination: React.FC<TablePaginationProps> = ({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'records',
  className = '',
}) => {
  if (total <= 0) return null;

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div
      className={`no-print flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-3 border-t border-[#EFECE7] bg-white text-[12.5px] text-[#6B6863] ${className}`}
    >
      <div className="flex items-center gap-4">
        <span>
          Showing <span className="font-semibold text-[#171717] tabular-nums">{from}–{to}</span> of{' '}
          <span className="font-semibold text-[#171717] tabular-nums">{total}</span> {itemLabel}
        </span>
        {onPageSizeChange && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="text-[#8A847C]">Rows</span>
            <div className="w-[76px]">
              <SimpleSelect
                value={String(pageSize)}
                onValueChange={(v) => onPageSizeChange(Number(v))}
                options={PAGE_SIZE_OPTIONS.map((n) => ({ value: String(n), label: String(n) }))}
                triggerClassName="!h-8 !px-2.5 text-[12.5px]"
              />
            </div>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Pagination">
          <button type="button" className={`${navBtn} hidden sm:inline-flex`} onClick={() => onPageChange(1)} disabled={page === 1} aria-label="First page">
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button type="button" className={navBtn} onClick={() => onPageChange(page - 1)} disabled={page === 1} aria-label="Previous page">
            <ChevronLeft className="w-4 h-4" />
          </button>
          {getPageItems(page, totalPages).map((item, i) =>
            item === 'gap' ? (
              <span key={`gap-${i}`} className="w-6 text-center text-[#A69B8D] select-none">
                …
              </span>
            ) : (
              <button
                key={item}
                type="button"
                onClick={() => onPageChange(item)}
                aria-current={item === page ? 'page' : undefined}
                className={`min-w-[2rem] h-8 px-2 inline-flex items-center justify-center rounded-[8px] text-[12.5px] tabular-nums transition-colors ${
                  item === page
                    ? 'bg-[#141414] text-white font-semibold'
                    : 'text-[#6B6863] hover:bg-[#F4F2EE] hover:text-[#171717]'
                }`}
              >
                {item}
              </button>
            )
          )}
          <button type="button" className={navBtn} onClick={() => onPageChange(page + 1)} disabled={page === totalPages} aria-label="Next page">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            className={`${navBtn} hidden sm:inline-flex`}
            onClick={() => onPageChange(totalPages)}
            disabled={page === totalPages}
            aria-label="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </nav>
      )}
    </div>
  );
};

export default TablePagination;
