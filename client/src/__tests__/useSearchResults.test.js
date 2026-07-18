import { act, renderHook } from '@testing-library/react';
import { useSearchResults } from '../hooks/useSearchResults';

function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}

// Flushes the microtask queue enough times for a resolved fetch() to work its
// way through .then(json) -> Promise.all -> setState.
async function flushMicrotasks() {
  for (let i = 0; i < 10; i++) await Promise.resolve();
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useSearchResults', () => {
  it('returns null with no active query', () => {
    const { result } = renderHook(() => useSearchResults('wine', ''));
    expect(result.current).toBeNull();
  });

  it('ignores an older, slower-resolving request once a newer query has already committed its results', async () => {
    const first = deferred();
    const second = deferred();
    const fetchMock = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    vi.stubGlobal('fetch', fetchMock);

    const { result, rerender } = renderHook(({ query }) => useSearchResults('wine', query), {
      initialProps: { query: 'wine' },
    });

    await vi.advanceTimersByTimeAsync(300);
    rerender({ query: 'wine red' });
    await vi.advanceTimersByTimeAsync(300);

    // newer request (wine red) resolves first
    await act(async () => {
      second.resolve({ ok: true, json: async () => [{ id: 'b' }] });
      await flushMicrotasks();
    });
    expect([...result.current]).toEqual(['b']);

    // older, stale request (wine) resolves after — must not overwrite the newer result
    await act(async () => {
      first.resolve({ ok: true, json: async () => [{ id: 'a' }] });
      await flushMicrotasks();
    });
    expect([...result.current]).toEqual(['b']);
  });
});
