import FilterDropdown from './FilterDropdown';
import AbvFilter from './AbvFilter';
import ColumnPanel from './ColumnPanel';
import { COLUMNS } from './DrinkTable';
import { DROPDOWN_CONFIGS, PRODUCER_FIELD, buildDropdownOptions, countOptions } from '../utils/filterHelpers';
import './FilterBar.css';

export default function FilterBar({ category, drinks, activeFilters, onChange, columnLayout, onColumnLayoutChange }) {
  const configs = DROPDOWN_CONFIGS[category] || [];
  const producerLabel = { wine: 'Producer', beer: 'Brewery', whiskey: 'Distillery', others: 'Distillery' }[category] ?? 'Producer';

  const hasAnyFilter = activeFilters.producerSearch ||
    configs.some(c => activeFilters[c.key]?.size > 0) ||
    activeFilters.abvMin !== '' || activeFilters.abvMax !== '';

  const clearAll = () => {
    const reset = { producerSearch: '', abvMin: '', abvMax: '' };
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
        const counts = countOptions(drinks, conf, activeFilters, category);
        return (
          <FilterDropdown
            key={conf.key}
            label={conf.label}
            specialOptions={special}
            options={options}
            selected={activeFilters[conf.key] ?? new Set()}
            counts={counts}
            onChange={next => onChange({ ...activeFilters, [conf.key]: next })}
          />
        );
      })}
      <AbvFilter
        abvMin={activeFilters.abvMin ?? ''}
        abvMax={activeFilters.abvMax ?? ''}
        onChange={({ abvMin, abvMax }) => onChange({ ...activeFilters, abvMin, abvMax })}
      />
      {hasAnyFilter && (
        <button className="filter-clear-all" onClick={clearAll}>Clear all</button>
      )}
      <div className="filter-bar-spacer" />
      {onColumnLayoutChange && (
        <ColumnPanel
          allColumns={COLUMNS[category] || []}
          columnLayout={columnLayout}
          onChange={onColumnLayoutChange}
        />
      )}
    </div>
  );
}
