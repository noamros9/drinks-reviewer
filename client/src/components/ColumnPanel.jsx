import { useState, useRef, useEffect } from 'react';

export default function ColumnPanel({ allColumns, columnLayout, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const dragKey = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const order = columnLayout?.order ?? allColumns.map(c => c.key);
  const hidden = columnLayout?.hidden ?? new Set();
  const colMap = Object.fromEntries(allColumns.map(c => [c.key, c]));
  const hiddenCount = order.filter(k => hidden.has(k)).length;

  const ensureLayout = () =>
    columnLayout ?? { order: allColumns.map(c => c.key), hidden: new Set() };

  const toggleColumn = (key) => {
    const lay = ensureLayout();
    const next = new Set(lay.hidden);
    next.has(key) ? next.delete(key) : next.add(key);
    onChange({ ...lay, hidden: next });
  };

  const handleDragStart = (key) => { dragKey.current = key; };
  const handleDrop = (targetKey) => {
    if (!dragKey.current || dragKey.current === targetKey) return;
    const lay = ensureLayout();
    const newOrder = [...lay.order];
    const fromIdx = newOrder.indexOf(dragKey.current);
    const toIdx = newOrder.indexOf(targetKey);
    if (fromIdx === -1 || toIdx === -1) return;
    newOrder.splice(fromIdx, 1);
    newOrder.splice(toIdx, 0, dragKey.current);
    onChange({ ...lay, order: newOrder });
    dragKey.current = null;
  };

  return (
    <div className="filter-dropdown" ref={ref}>
      <button
        className={`filter-dropdown-btn${hiddenCount > 0 ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        data-testid="column-panel-btn"
      >
        Columns
        {hiddenCount > 0 && <span className="filter-count">{hiddenCount}</span>}
        <span className="filter-chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="filter-dropdown-menu col-panel-menu">
          {order.map(key => {
            const col = colMap[key];
            if (!col) return null;
            return (
              <div
                key={key}
                className="col-panel-row"
                draggable
                onDragStart={() => handleDragStart(key)}
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(key)}
                data-testid={`col-panel-row-${key}`}
              >
                <span className="col-panel-handle">⠿</span>
                <label className="col-panel-label">
                  <input
                    type="checkbox"
                    checked={!hidden.has(key)}
                    onChange={() => toggleColumn(key)}
                    data-testid={`col-toggle-${key}`}
                  />
                  <span>{col.label}</span>
                </label>
              </div>
            );
          })}
          <button className="filter-clear-btn" onClick={() => onChange(null)}>Reset to default</button>
        </div>
      )}
    </div>
  );
}
