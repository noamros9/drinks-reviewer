import { useState, useRef } from 'react';
import { OLD_WORLD, NEW_WORLD } from '../utils/filterHelpers';
import CustomSelect from './CustomSelect';
import './DrinkTable.css';

// Saved layouts predate columns added later; append any column missing from a saved order
// instead of silently dropping it.
export function resolveColumnOrder(savedOrder, allCols) {
  const keys = allCols.map(c => c.key);
  if (!savedOrder) return keys;
  return [...savedOrder, ...keys.filter(k => !savedOrder.includes(k))];
}

export function deriveFromFiltered(tastings, vintage) {
  const filtered = vintage ? tastings.filter(t => t.vintage === vintage) : tastings;
  if (!filtered.length) return {};
  const ratings = filtered.map(t => t.rating);
  const last = filtered[filtered.length - 1];
  return {
    avgRating: Math.round(ratings.reduce((a, b) => a + b, 0) / ratings.length * 100) / 100,
    lastRating: last.rating,
    lastTasted: last.date,
    tastingCount: filtered.length,
  };
}

export const COLUMNS = {
  wine: [
    { key: 'producer',      label: 'Producer' },
    { key: 'seriesAndName', label: 'Name' },
    { key: 'wineCategory',  label: 'Type' },
    { key: 'sweetness',     label: 'Sweetness' },
    { key: 'variety',       label: 'Variety' },
    { key: 'country',       label: 'Country' },
    { key: 'region',        label: 'Region' },
    { key: 'abv',           label: 'ABV' },
    { key: 'vintage',       label: 'Vintage' },
    { key: 'photo',         label: 'Photo' },
    { key: 'tags',          label: 'Tags' },
    { key: 'lastTasted',    label: 'Last Tasted' },
    { key: 'lastRating',    label: 'Last Rating' },
    { key: 'avgRating',     label: 'Avg Rating' },
    { key: 'weightedRating', label: 'Weighted Rating' },
    { key: 'vivinoScore',   label: 'Vivino' },
    { key: 'tastingCount',  label: 'Tastings' },
  ],
  beer: [
    { key: 'brewery',      label: 'Brewery' },
    { key: 'name',         label: 'Name' },
    { key: 'style',        label: 'Style' },
    { key: 'country',      label: 'Country' },
    { key: 'abv',          label: 'ABV' },
    { key: 'photo',        label: 'Photo' },
    { key: 'tags',         label: 'Tags' },
    { key: 'lastTasted',   label: 'Last Tasted' },
    { key: 'lastRating',   label: 'Last Rating' },
    { key: 'avgRating',    label: 'Avg Rating' },
    { key: 'weightedRating', label: 'Weighted Rating' },
    { key: 'tastingCount', label: 'Tastings' },
  ],
  whiskey: [
    { key: 'distillery',   label: 'Distillery' },
    { key: 'name',         label: 'Name' },
    { key: 'country',      label: 'Country' },
    { key: 'region',       label: 'Region' },
    { key: 'age',          label: 'Age' },
    { key: 'style',        label: 'Style' },
    { key: 'abv',          label: 'ABV' },
    { key: 'photo',        label: 'Photo' },
    { key: 'tags',         label: 'Tags' },
    { key: 'lastTasted',   label: 'Last Tasted' },
    { key: 'lastRating',   label: 'Last Rating' },
    { key: 'avgRating',    label: 'Avg Rating' },
    { key: 'weightedRating', label: 'Weighted Rating' },
    { key: 'tastingCount', label: 'Tastings' },
  ],
  others: [
    { key: 'drinkCategory', label: 'Category' },
    { key: 'distillery',    label: 'Distillery' },
    { key: 'name',          label: 'Name' },
    { key: 'country',       label: 'Country' },
    { key: 'style',         label: 'Style' },
    { key: 'age',           label: 'Age' },
    { key: 'abv',           label: 'ABV' },
    { key: 'photo',         label: 'Photo' },
    { key: 'tags',          label: 'Tags' },
    { key: 'lastTasted',    label: 'Last Tasted' },
    { key: 'lastRating',    label: 'Last Rating' },
    { key: 'avgRating',     label: 'Avg Rating' },
    { key: 'weightedRating', label: 'Weighted Rating' },
    { key: 'tastingCount',  label: 'Tastings' },
  ],
  all: [
    { key: '_category',   label: 'Category' },
    { key: '_producer',   label: 'Producer' },
    { key: 'name',        label: 'Name' },
    { key: 'country',     label: 'Country' },
    { key: 'abv',         label: 'ABV' },
    { key: 'photo',       label: 'Photo' },
    { key: 'tags',        label: 'Tags' },
    { key: 'lastTasted',  label: 'Last Tasted' },
    { key: 'lastRating',  label: 'Last Rating' },
    { key: 'avgRating',   label: 'Avg Rating' },
    { key: 'weightedRating', label: 'Weighted Rating' },
  ],
  collection: [
    { key: '_category',   label: 'Category' },
    { key: '_producer',   label: 'Producer' },
    { key: 'name',        label: 'Name' },
    { key: 'country',     label: 'Country' },
    { key: 'abv',         label: 'ABV' },
    { key: 'price',       label: 'Price' },
    { key: 'photo',       label: 'Photo' },
    { key: 'collectionTags', label: 'Collection Tags' },
  ],
};

const TAG_CHIP_KEYS = new Set(['tags', 'collectionTags', 'variety']);

export default function DrinkTable({ category, drinks, onEdit, renderRowExtra, columnLayout, onColumnLayoutChange, onCellClick, filterableCols, sortKey: propSortKey, sortDir: propSortDir, onSort, activeVintage, selectedIds, onToggleRow, onToggleAll }) {
  const [intKey, setIntKey] = useState(null);
  const [intDir, setIntDir] = useState('asc');
  const sortKey = onSort !== undefined ? propSortKey : intKey;
  const sortDir = onSort !== undefined ? propSortDir : intDir;
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const dragWidth = useRef(0);
  const [selectedVintages, setSelectedVintages] = useState({});

  const allCols = COLUMNS[category] || [];
  const colMap = Object.fromEntries(allCols.map(c => [c.key, c]));
  const order = columnLayout?.order ?? allCols.map(c => c.key);
  const hidden = columnLayout?.hidden instanceof Set ? columnLayout.hidden : new Set(Array.isArray(columnLayout?.hidden) ? columnLayout.hidden : []);
  const visibleCols = order.filter(k => !hidden.has(k)).map(k => colMap[k]).filter(Boolean);

  const ensureLayout = () =>
    columnLayout ?? { order: allCols.map(c => c.key), hidden: new Set() };

  const handleSort = (key) => {
    if (onSort) {
      onSort(key);
    } else if (intKey === key) {
      setIntDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setIntKey(key);
      setIntDir('asc');
    }
  };

  const getHeaderTransform = (key) => {
    if (!dragKey || !dragOverKey || dragKey === dragOverKey) return undefined;
    const keys = visibleCols.map(c => c.key);
    const from = keys.indexOf(dragKey);
    const to = keys.indexOf(dragOverKey);
    const idx = keys.indexOf(key);
    if (from < to && idx > from && idx <= to) return `translateX(-${dragWidth.current}px)`;
    if (from > to && idx >= to && idx < from) return `translateX(${dragWidth.current}px)`;
    return undefined;
  };

  const handlePointerDown = (key, e) => {
    if (!onColumnLayoutChange) return;
    setDragKey(key);
    dragWidth.current = e.currentTarget.offsetWidth;
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (!dragKey) return;
    const th = document.elementFromPoint(e.clientX, e.clientY)?.closest('th[data-col-key]');
    if (th) setDragOverKey(th.dataset.colKey);
  };
  const handleDrop = (targetKey) => {
    setDragOverKey(null);
    setDragKey(null);
    if (!dragKey || dragKey === targetKey || !onColumnLayoutChange) return;
    const lay = ensureLayout();
    const newOrder = [...lay.order];
    const fromIdx = newOrder.indexOf(dragKey);
    const toIdx = newOrder.indexOf(targetKey);
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragKey);
    onColumnLayoutChange({ ...lay, order: newOrder });
  };
  const handlePointerUp = () => {
    if (dragKey && dragOverKey) handleDrop(dragOverKey);
    else { setDragKey(null); setDragOverKey(null); }
  };

  const hideColumn = (e, key) => {
    e.stopPropagation();
    const lay = ensureLayout();
    const next = new Set(lay.hidden);
    next.add(key);
    onColumnLayoutChange({ ...lay, hidden: next });
  };

  const getChipClass = (colKey, value) => {
    if (colKey === '_category') {
      const map = { Wine: 'chip-cat-wine', Beer: 'chip-cat-beer', Whiskey: 'chip-cat-whiskey', Others: 'chip-cat-others' };
      return map[value] || '';
    }
    if (colKey === 'wineCategory') {
      const map = { Red: 'chip-wine-red', White: 'chip-wine-white', 'Rosé': 'chip-wine-rose', Sparkling: 'chip-wine-sparkling', Fortified: 'chip-wine-fortified' };
      return map[value] || '';
    }
    if (colKey === 'sweetness') {
      const map = { Dry: 'chip-sweetness-dry', 'Off-Dry': 'chip-sweetness-offdry', Sweet: 'chip-sweetness-sweet', 'Extra-Dry': 'chip-sweetness-extradry' };
      return map[value] || '';
    }
    if (colKey === 'drinkCategory') {
      const map = { Rum: 'chip-others-rum', Vodka: 'chip-others-vodka', Liqueur: 'chip-others-liqueur' };
      return map[value] || 'chip-others-generic';
    }
    if (colKey === 'style') {
      if (category === 'whiskey') {
        const map = { 'Single Malt': 'chip-whiskey-singlemalt', Bourbon: 'chip-whiskey-bourbon' };
        return map[value] || 'chip-whiskey-style';
      }
      if (category === 'beer') {
        if (!value) return '';
        const STOUTS = new Set(['Stout', 'Porter']);
        const LAGERS = new Set(['Lager', 'Helles Lager', 'Hoppy Lager', 'Pilsner', 'Pale Lager']);
        if (STOUTS.has(value)) return 'chip-beer-stout';
        if (LAGERS.has(value)) return 'chip-beer-lager';
        return 'chip-beer-ale';
      }
    }
    if (colKey === 'country' && category === 'wine') {
      if (value === 'Israel') return 'chip-country-israel';
      if (OLD_WORLD.includes(value)) return 'chip-country-old-world';
      if (NEW_WORLD.includes(value)) return 'chip-country-new-world';
      return value && value !== '—' ? 'chip-country-other' : '';
    }
    return '';
  };

  const NUMERIC_KEYS = new Set(['abv', 'lastRating', 'avgRating', 'weightedRating', 'age', 'vivinoScore', 'price']);

  const sorted = [...drinks].sort((a, b) => {
    if (!sortKey) return 0;
    let av = a[sortKey] ?? '';
    let bv = b[sortKey] ?? '';
    if (sortKey === 'lastTasted') {
      const toInt = (s) => {
        if (!s) return 0;
        const [d, m, y] = s.split('/');
        return parseInt(y, 10) * 10000 + parseInt(m, 10) * 100 + parseInt(d, 10);
      };
      av = toInt(av);
      bv = toInt(bv);
    } else if (NUMERIC_KEYS.has(sortKey)) {
      av = parseFloat(av) || 0;
      bv = parseFloat(bv) || 0;
    }
    if (av === bv) return 0;
    const sign = av < bv ? -1 : 1;
    return sortDir === 'asc' ? sign : -sign;
  });

  if (drinks.length === 0) {
    return <p className="empty-state">No entries yet. Add one via Admin.</p>;
  }

  const allSelected = selectedIds && sorted.length > 0 && sorted.every(d => selectedIds.has(d.id));

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {selectedIds && (
              <th>
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={() => onToggleAll(sorted.map(d => d.id), !allSelected)}
                  aria-label="Select all rows"
                />
              </th>
            )}
            {visibleCols.map(col => (
              <th
                key={col.key}
                className={`sortable${dragKey === col.key ? ' col-header-dragging' : ''}${dragOverKey === col.key ? ' col-drag-over' : ''}`}
                style={{ transform: getHeaderTransform(col.key) }}
                onClick={() => handleSort(col.key)}
                data-col-key={col.key}
                onPointerDown={e => handlePointerDown(col.key, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
              >
                {col.label}
                {sortKey === col.key && (sortDir === 'asc' ? ' ↑' : ' ↓')}
                {onColumnLayoutChange && (
                  <button
                    className="col-hide-btn"
                    onClick={e => hideColumn(e, col.key)}
                    title={`Hide ${col.label}`}
                    data-testid={`col-hide-${col.key}`}
                  >×</button>
                )}
              </th>
            ))}
            {renderRowExtra && <th>Stock</th>}
            {onEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(drink => {
            const selVintage = activeVintage ?? selectedVintages[drink.id] ?? null;
            const derived = drink.tastings?.length ? deriveFromFiltered(drink.tastings, selVintage) : null;
            const uniqueVintages = drink.tastings?.length
              ? [...new Set(drink.tastings.map(t => t.vintage).filter(Boolean))]
              : [];
            return (
            <tr key={drink.id}>
              {selectedIds && (
                <td>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(drink.id)}
                    onChange={() => onToggleRow(drink.id)}
                    aria-label={`Select row ${drink.id}`}
                  />
                </td>
              )}
              {visibleCols.map(col => {
                const raw = (derived && ['avgRating','lastRating','lastTasted','tastingCount'].includes(col.key))
                  ? derived[col.key]
                  : drink[col.key];
                const chipClass = getChipClass(col.key, raw);
                const isFilterable = onCellClick && filterableCols?.has(col.key) && raw != null && raw !== '—';
                let content;
                if (col.key === 'vintage' && uniqueVintages.length > 0) {
                  content = (
                    <CustomSelect
                      compact
                      value={selVintage ?? ''}
                      onChange={v => setSelectedVintages(prev => ({ ...prev, [drink.id]: v || null }))}
                      options={uniqueVintages}
                      placeholder="All"
                    />
                  );
                } else if (TAG_CHIP_KEYS.has(col.key)) {
                  const tags = Array.isArray(raw) ? raw : [];
                  const canFilter = onCellClick && filterableCols?.has(col.key);
                  content = tags.length > 0
                    ? (
                      <div className="tag-chips-cell">
                        {tags.map(tag => (
                          <span
                            key={tag}
                            className={`tag-chip-cell${canFilter ? ' cell-filterable' : ''}`}
                            onClick={canFilter ? () => onCellClick(col.key, tag) : undefined}
                          >{tag}</span>
                        ))}
                      </div>
                    )
                    : '—';
                } else if (col.key === 'photo') {
                  const lastTastingPhoto = drink.tastings?.length > 0
                    ? drink.tastings[drink.tastings.length - 1].imageUrl
                    : undefined;
                  const photoUrl = raw ?? drink.collectionImageUrl ?? lastTastingPhoto;
                  content = photoUrl ? <img src={photoUrl} alt="" className="table-thumb" /> : '—';
                } else if (chipClass) {
                  content = (
                    <span
                      className={`status-chip ${chipClass}${isFilterable ? ' cell-filterable' : ''}`}
                      onClick={isFilterable ? () => onCellClick(col.key, raw) : undefined}
                    >{raw ?? '—'}</span>
                  );
                } else if (isFilterable) {
                  content = <span className="cell-filterable" onClick={() => onCellClick(col.key, raw)}>{raw}</span>;
                } else {
                  content = raw ?? '—';
                }
                return <td key={col.key}>{content}</td>;
              })}
              {renderRowExtra && <td className="stock-cell">{renderRowExtra(drink)}</td>}
              {onEdit && (
                <td>
                  <button className="btn-edit" onClick={() => onEdit(drink)}>Edit</button>
                </td>
              )}
            </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
