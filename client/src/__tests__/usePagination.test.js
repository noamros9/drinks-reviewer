import { act, renderHook } from '@testing-library/react';
import { usePagination } from '../hooks/usePagination';

function rows(n) {
  return Array.from({ length: n }, (_, i) => ({ id: `r${i}` }));
}

describe('usePagination', () => {
  it('slices to the first page by default', () => {
    const { result } = renderHook(() => usePagination(rows(25)));
    expect(result.current.page).toBe(1);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.pageRows).toHaveLength(10);
    expect(result.current.pageRows[0].id).toBe('r0');
  });

  it('advances and clamps to the last valid page', () => {
    const { result } = renderHook(() => usePagination(rows(15)));
    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);
    expect(result.current.pageRows).toHaveLength(5);

    act(() => result.current.setPage(99));
    expect(result.current.page).toBe(2);
  });

  it('returns a single page with totalPages 1 when everything fits', () => {
    const { result } = renderHook(() => usePagination(rows(3)));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.pageRows).toHaveLength(3);
  });

  it('resets to page 1 when the row set changes', () => {
    const { result, rerender } = renderHook(({ data }) => usePagination(data), {
      initialProps: { data: rows(25) },
    });
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    rerender({ data: rows(12) });
    expect(result.current.page).toBe(1);
  });

  it('does not reset when re-rendered with the same rows', () => {
    const data = rows(25);
    const { result, rerender } = renderHook(({ data }) => usePagination(data), {
      initialProps: { data },
    });
    act(() => result.current.setPage(2));
    rerender({ data: [...data] });
    expect(result.current.page).toBe(2);
  });

  it('respects a custom perPage', () => {
    const { result } = renderHook(() => usePagination(rows(9), 4));
    expect(result.current.totalPages).toBe(3);
    expect(result.current.pageRows).toHaveLength(4);
  });
});
