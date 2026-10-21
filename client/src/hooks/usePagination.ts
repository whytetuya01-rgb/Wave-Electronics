import { useEffect, useMemo, useState } from 'react';

// Client-side pagination over an already-loaded list. `resetKey` should
// change whenever the filters/search producing `items` change, so the view
// jumps back to page 1 instead of landing on a now-empty page.
export function usePagination<T>(items: T[], resetKey: unknown = '', initialPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialPageSize);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Clamp rather than store: if rows are removed (e.g. a delete on the last
  // page) the current page may no longer exist.
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(
    () => items.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [items, currentPage, pageSize]
  );

  const setPageSize = (size: number) => {
    setPageSizeState(size);
    setPage(1);
  };

  return { page: currentPage, pageSize, total, pageItems, setPage, setPageSize };
}
