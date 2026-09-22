import { useState } from 'react';
import {
  buildInitialFilters, matchesFilters, applyUrlRangeOverrides, applyUrlDropdownOverrides,
  applyUrlProducerOverride, PRODUCER_FIELD, CATEGORIES,
} from '../utils/filterHelpers';
import { useSearchResults } from './useSearchResults';

// Empty filters for `scope` ('wine' | 'beer' | … | 'all'), with any ?country=/?abvMin=/?producer=
// in the URL applied on top. Deep-links from analytics arrive this way.
export function filtersFromUrl(scope, searchParams) {
  return applyUrlProducerOverride(
    applyUrlDropdownOverrides(
      applyUrlRangeOverrides(buildInitialFilters(scope), searchParams, scope),
      searchParams, scope,
    ),
    searchParams,
  );
}

// The list pipeline every drinks list shares: producer search (Atlas Search, debounced) narrows
// the rows, then the dropdown/range filters. Callers pass rows already scoped and scored.
export function useFilteredDrinks(drinks, scope, initialFilters) {
  const [activeFilters, setActiveFilters] = useState(initialFilters);

  const searchIds = useSearchResults(scope === 'all' ? CATEGORIES : scope, activeFilters.producerSearch);
  const searchScoped = searchIds == null ? drinks : drinks.filter(d => searchIds.has(d.id));
  const visible = searchScoped.filter(d => matchesFilters(d, activeFilters, scope));

  // Clicking a cell filters by it: the producer column feeds the search box, the rest add a value.
  const handleCellClick = (colKey, value) => {
    setActiveFilters(prev =>
      colKey === PRODUCER_FIELD[scope]
        ? { ...prev, producerSearch: value }
        : { ...prev, [colKey]: new Set([...prev[colKey], value]) }
    );
  };

  return { activeFilters, setActiveFilters, visible, handleCellClick };
}
