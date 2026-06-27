import FilterDropdown from './FilterDropdown';
import AbvFilter from './AbvFilter';
import ColumnPanel from './ColumnPanel';
import { COLUMNS } from './DrinkTable';
import { DROPDOWN_CONFIGS, PRODUCER_FIELD, buildDropdownOptions, countOptions, buildInitialFilters } from '../utils/filterHelpers';
import './FilterBar.css';

export default function FilterBar({ category, drinks, activeFilters, onChange, columnLayout, onColumnLayoutChange }) {
  const configs = DROPDOWN_CONFIGS[category] || [];
  const producerLabel = { wine: 'Producer', beer: 'Brewery', whiskey: 'Distillery', others: 'Distillery' }[category] ?? 'Producer';

  const hasAnyFilter = activeFilters.producerSearch ||
    configs.some(c => activeFilters[c.key]?.size > 0) ||
    activeFilters.abvMin !== '' || activeFilters.abvMax !== '';

  const clearAll = () => onChange(buildInitialFilters(category));

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
      {hasAnyFilter && (
        <div className="filter-chips">
          {activeFilters.producerSearch && (
            <span className="filter-chip">
              {producerLabel}: {activeFilters.producerSearch}
              <button onClick={() => onChange({ ...activeFilters, producerSearch: '' })} aria-label="Remove producer filter">×</button>
            </span>
          )}
          {configs.flatMap(conf =>
            [...(activeFilters[conf.key] ?? [])].map(val => (
              <span key={`${conf.key}-${val}`} className="filter-chip">
                {val}
                <button onClick={() => { const next = new Set(activeFilters[conf.key]); next.delete(val); onChange({ ...activeFilters, [conf.key]: next }); }} aria-label={`Remove ${val} filter`}>×</button>
              </span>
            ))
          )}
          {(activeFilters.abvMin || activeFilters.abvMax) && (
            <span className="filter-chip">
              ABV: {activeFilters.abvMin || '0'}–{activeFilters.abvMax || '∞'}
              <button onClick={() => onChange({ ...activeFilters, abvMin: '', abvMax: '' })} aria-label="Remove ABV filter">×</button>
            </span>
          )}
        </div>
      )}
    </div>
  );
}
