import { act, renderHook } from '@testing-library/react';
import { useColumnLayout } from '../hooks/useColumnLayout';

const COLS = [{ key: 'producer' }, { key: 'name' }, { key: 'country' }];

beforeEach(() => localStorage.clear());

describe('useColumnLayout', () => {
  it('starts with no saved layout', () => {
    const { result } = renderHook(() => useColumnLayout('k', COLS));
    expect(result.current[0]).toBeNull();
  });

  it('saves a change and restores it on the next mount', () => {
    const first = renderHook(() => useColumnLayout('k', COLS));
    act(() => first.result.current[1]({ order: ['country', 'producer', 'name'], hidden: new Set(['name']) }));
    first.unmount();
    const { result } = renderHook(() => useColumnLayout('k', COLS));
    expect(result.current[0].order).toEqual(['country', 'producer', 'name']);
    expect([...result.current[0].hidden]).toEqual(['name']);
  });

  it('clearing the layout removes it from storage', () => {
    const { result } = renderHook(() => useColumnLayout('k', COLS));
    act(() => result.current[1]({ order: ['name', 'producer', 'country'], hidden: new Set() }));
    act(() => result.current[1](null));
    expect(localStorage.getItem('k')).toBeNull();
  });

  it('switches to the other key\'s layout when the key changes', () => {
    localStorage.setItem('beer', JSON.stringify({ order: ['name', 'producer', 'country'], hidden: [] }));
    const { result, rerender } = renderHook(({ k }) => useColumnLayout(k, COLS), { initialProps: { k: 'wine' } });
    expect(result.current[0]).toBeNull();
    rerender({ k: 'beer' });
    expect(result.current[0].order).toEqual(['name', 'producer', 'country']);
  });

  it('treats unreadable storage as no layout, and a failed save as non-fatal', () => {
    localStorage.setItem('k', '{not json');
    const { result } = renderHook(() => useColumnLayout('k', COLS));
    expect(result.current[0]).toBeNull();
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    act(() => result.current[1]({ order: ['name', 'producer', 'country'], hidden: new Set() }));
    expect(result.current[0].order).toEqual(['name', 'producer', 'country']);
    spy.mockRestore();
  });
});
