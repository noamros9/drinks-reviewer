import { useRef, useState } from 'react';

export function usePagination(rows, perPage = 10) {
  const key = rows.map(r => r.id).join(',');
  const prevKey = useRef(key);
  const [page, setPage] = useState(1);

  if (prevKey.current !== key) {
    prevKey.current = key;
    if (page !== 1) setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(rows.length / perPage));
  const clampedPage = Math.min(page, totalPages);
  const start = (clampedPage - 1) * perPage;

  return { page: clampedPage, pageRows: rows.slice(start, start + perPage), totalPages, setPage };
}
