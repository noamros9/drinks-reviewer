import { act, renderHook } from '@testing-library/react';
import { useFilteredDrinks, filtersFromUrl } from '../hooks/useFilteredDrinks';

const WINES = [
  { id: 'a', producer: 'Yatir', country: 'Israel', avgRating: 9 },
  { id: 'b', producer: 'Guigal', country: 'France', avgRating: 8.5 },
  { id: 'c', producer: 'Barton', country: 'France', avgRating: 6 },
];

beforeEach(() => {
  global.fetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve([]) }));
});

describe('filtersFromUrl', () => {
  it('reads dropdown, range and producer params for a category', () => {
    const f = filtersFromUrl('wine', new URLSearchParams('country=France&avgRatingMin=8&producer=Gui'));
    expect([...f.country]).toEqual(['France']);
    expect(f.avgRatingMin).toBe('8');
    expect(f.producerSearch).toBe('Gui');
  });

  it('gives empty filters when the URL has none', () => {
    const f = filtersFromUrl('all', new URLSearchParams());
    expect(f.producerSearch).toBe('');
    expect(f.avgRatingMin).toBe('');
  });
});

describe('useFilteredDrinks', () => {
  it('returns only the drinks matching the initial filters', () => {
    const initial = filtersFromUrl('wine', new URLSearchParams('country=France&avgRatingMin=8'));
    const { result } = renderHook(() => useFilteredDrinks(WINES, 'wine', initial));
    expect(result.current.visible.map(d => d.id)).toEqual(['b']);
  });

  it('clicking a dropdown cell adds that value as a filter', () => {
    const { result } = renderHook(() => useFilteredDrinks(WINES, 'wine', filtersFromUrl('wine', new URLSearchParams())));
    act(() => result.current.handleCellClick('country', 'Israel'));
    expect(result.current.visible.map(d => d.id)).toEqual(['a']);
  });

  it('clicking the producer cell searches by producer instead', () => {
    const { result } = renderHook(() => useFilteredDrinks(WINES, 'wine', filtersFromUrl('wine', new URLSearchParams())));
    act(() => result.current.handleCellClick('producer', 'Yatir'));
    expect(result.current.activeFilters.producerSearch).toBe('Yatir');
  });
});
