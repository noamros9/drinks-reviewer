import FilterDropdown from './FilterDropdown';
import { DROPDOWN_CONFIGS, PRODUCER_FIELD, buildDropdownOptions } from '../utils/filterHelpers';

export default function FilterBar({ category, drinks, activeFilters, onChange }) {
  const configs = DROPDOWN_CONFIGS[category] || [];
  const producerLabel = { wine: 'Producer', beer: 'Brewery', whiskey: 'Distillery', others: 'Distillery' }[category] ?? 'Producer';
  const producerField = PRODUCER_FIELD[category];

  const hasAnyFilter = activeFilters.producerSearch ||
    configs.some(c => activeFilters[c.key]?.size > 0);

  const clearAll = () => {
    const reset = { producerSearch: '' };
    configs.forEach(c => { reset[c.key] = new Set(); });
    onChange(reset);
  };

  return (
    <div className="filter-bar">
      <div className="filter-search-wrapper">
        <span className="filter-search-icon">⌕</span>
        <input
          className="filter-search"
          type="text"
          placeholder={`Search ${producerLabel}…`}
          value={activeFilters.producerSearch}
          onChange={e => onChange({ ...activeFilters, producerSearch: e.target.value })}
          data-testid="producer-search"
        />
      </div>
      {configs.map(conf => {
        const { special, options } = buildDropdownOptions(drinks, conf);
        return (
          <FilterDropdown
            key={conf.key}
            label={conf.label}
            specialOptions={special}
            options={options}
            selected={activeFilters[conf.key] ?? new Set()}
            onChange={next => onChange({ ...activeFilters, [conf.key]: next })}
          />
        );
      })}
      {hasAnyFilter && (
        <button className="filter-clear-all" onClick={clearAll}>Clear all</button>
      )}
    </div>
  );
}
