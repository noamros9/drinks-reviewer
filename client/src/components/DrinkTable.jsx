import { useState, useRef } from 'react';
import { OLD_WORLD, NEW_WORLD } from '../utils/filterHelpers';

export const COLUMNS = {
  wine: [
    { key: 'producer',      label: 'Producer' },
    { key: 'seriesAndName', label: 'Name' },
    { key: 'wineCategory',  label: 'Type' },
    { key: 'variety',       label: 'Variety' },
    { key: 'country',       label: 'Country' },
    { key: 'region',        label: 'Region' },
    { key: 'abv',           label: 'ABV' },
    { key: 'lastTasted',    label: 'Last Tasted' },
    { key: 'lastRanking',   label: 'Last' },
    { key: 'avgRanking',    label: 'Avg' },
    { key: 'notionLink',    label: 'Notion' },
  ],
  beer: [
    { key: 'brewery',     label: 'Brewery' },
    { key: 'name',        label: 'Name' },
    { key: 'style',       label: 'Style' },
    { key: 'country',     label: 'Country' },
    { key: 'abv',         label: 'ABV' },
    { key: 'lastTasted',  label: 'Last Tasted' },
    { key: 'lastRanking', label: 'Last' },
    { key: 'avgRanking',  label: 'Avg' },
    { key: 'notionLink',  label: 'Notion' },
  ],
  whiskey: [
    { key: 'distillery',  label: 'Distillery' },
    { key: 'name',        label: 'Name' },
    { key: 'country',     label: 'Country' },
    { key: 'age',         label: 'Age' },
    { key: 'style',       label: 'Style' },
    { key: 'abv',         label: 'ABV' },
    { key: 'lastTasted',  label: 'Last Tasted' },
    { key: 'lastRanking', label: 'Last' },
    { key: 'avgRanking',  label: 'Avg' },
    { key: 'notionLink',  label: 'Notion' },
  ],
  others: [
    { key: 'drinkCategory', label: 'Category' },
    { key: 'distillery',    label: 'Distillery' },
    { key: 'name',          label: 'Name' },
    { key: 'country',       label: 'Country' },
    { key: 'style',         label: 'Style' },
    { key: 'age',           label: 'Age' },
    { key: 'abv',           label: 'ABV' },
    { key: 'lastTasted',    label: 'Last Tasted' },
    { key: 'lastRanking',   label: 'Last' },
    { key: 'avgRanking',    label: 'Avg' },
    { key: 'notionLink',    label: 'Notion' },
  ],
  all: [
    { key: '_category',   label: 'Category' },
    { key: '_producer',   label: 'Producer' },
    { key: 'name',        label: 'Name' },
    { key: 'country',     label: 'Country' },
    { key: 'abv',         label: 'ABV' },
    { key: 'lastTasted',  label: 'Last Tasted' },
    { key: 'lastRanking', label: 'Last' },
    { key: 'avgRanking',  label: 'Avg' },
    { key: 'notionLink',  label: 'Notion' },
  ],
};

export default function DrinkTable({ category, drinks, onEdit, columnLayout, onColumnLayoutChange }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [dragKey, setDragKey] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  const dragWidth = useRef(0);

  const allCols = COLUMNS[category] || [];
  const colMap = Object.fromEntries(allCols.map(c => [c.key, c]));
  const order = columnLayout?.order ?? allCols.map(c => c.key);
  const hidden = columnLayout?.hidden ?? new Set();
  const visibleCols = order.filter(k => !hidden.has(k)).map(k => colMap[k]).filter(Boolean);

  const ensureLayout = () =>
    columnLayout ?? { order: allCols.map(c => c.key), hidden: new Set() };

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('asc');
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

  const handleDragStart = (key, e) => { setDragKey(key); dragWidth.current = e.currentTarget.offsetWidth; };
  const handleDragOver = (e, key) => { e.preventDefault(); setDragOverKey(key); };
  const handleDragEnd = () => { setDragOverKey(null); setDragKey(null); };
  const handleDrop = (targetKey) => {
    setDragOverKey(null);
    setDragKey(null);
    if (!dragKey || dragKey === targetKey || !onColumnLayoutChange) return;
    const lay = ensureLayout();
    const newOrder = [...lay.order];
    const fromIdx = newOrder.indexOf(dragKey);
    const toIdx = newOrder.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragKey);
    onColumnLayoutChange({ ...lay, order: newOrder });
  };

  const hideColumn = (e, key) => {
    e.stopPropagation();
    if (!onColumnLayoutChange) return;
    const lay = ensureLayout();
    const next = new Set(lay.hidden);
    next.add(key);
    onColumnLayoutChange({ ...lay, hidden: next });
  };

  const getCellClass = (colKey, value) => {
    if (category !== 'wine') return '';
    if (colKey === 'wineCategory') {
      const map = { Red: 'wine-type-red', White: 'wine-type-white', Rose: 'wine-type-rose', Sparkling: 'wine-type-sparkling', Fortified: 'wine-type-fortified' };
      return map[value] || '';
    }
    if (colKey === 'country') {
      if (OLD_WORLD.includes(value)) return 'wine-country-old-world';
      if (NEW_WORLD.includes(value)) return 'wine-country-new-world';
      return value && value !== '—' ? 'wine-country-other' : '';
    }
    return '';
  };

  const sorted = [...drinks].sort((a, b) => {
    if (!sortKey) return 0;
    let av = a[sortKey] ?? '';
    let bv = b[sortKey] ?? '';
    if (sortKey === 'lastTasted') {
      const toInt = (s) => {
        if (!s) return 0;
        const [d, m, y] = s.split('/');
        return parseInt(y) * 10000 + parseInt(m) * 100 + parseInt(d);
      };
      av = toInt(av);
      bv = toInt(bv);
    }
    if (av < bv) return sortDir === 'asc' ? -1 : 1;
    if (av > bv) return sortDir === 'asc' ? 1 : -1;
    return 0;
  });

  if (drinks.length === 0) {
    return <p className="empty-state">No entries yet. Add one via Admin.</p>;
  }

  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            {visibleCols.map(col => (
              <th
                key={col.key}
                className={`sortable${dragKey === col.key ? ' col-header-dragging' : ''}${dragOverKey === col.key ? ' col-drag-over' : ''}`}
                style={{ transform: getHeaderTransform(col.key) }}
                onClick={() => handleSort(col.key)}
                draggable={!!onColumnLayoutChange}
                onDragStart={e => handleDragStart(col.key, e)}
                onDragOver={e => handleDragOver(e, col.key)}
                onDrop={() => handleDrop(col.key)}
                onDragEnd={handleDragEnd}
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
            {onEdit && <th>Actions</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map(drink => (
            <tr key={drink.id}>
              {visibleCols.map(col => (
                <td key={col.key} className={getCellClass(col.key, drink[col.key]) || undefined}>
                  {col.key === 'notionLink' && drink[col.key] ? (
                    <a href={drink[col.key]} target="_blank" rel="noopener noreferrer">↗ Open</a>
                  ) : (
                    drink[col.key] ?? '—'
                  )}
                </td>
              ))}
              {onEdit && (
                <td>
                  <button className="btn-edit" onClick={() => onEdit(drink)}>Edit</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
