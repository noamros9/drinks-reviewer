import { useState, useRef, useEffect } from 'react';
import { useDropdownAlign } from '../hooks/useDropdownAlign';
import './ColumnPanel.css';

const ROW_H = 36;

export default function ColumnPanel({ allColumns, columnLayout, onChange }) {
  const [open, setOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState(null);
  const [hoverIndex, setHoverIndex] = useState(null);
  const ref = useRef(null);
  const { alignRight, menuRef } = useDropdownAlign(open);

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

  const getTransform = (idx) => {
    if (dragIndex === null || hoverIndex === null || dragIndex === hoverIndex) return undefined;
    if (dragIndex < hoverIndex && idx > dragIndex && idx <= hoverIndex) return `translateY(-${ROW_H}px)`;
    if (dragIndex > hoverIndex && idx >= hoverIndex && idx < dragIndex) return `translateY(${ROW_H}px)`;
    return undefined;
  };

  const handlePointerDown = (idx, e) => {
    setDragIndex(idx);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const handlePointerMove = (e) => {
    if (dragIndex === null) return;
    const row = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-row-index]');
    if (row) setHoverIndex(Number(row.dataset.rowIndex));
  };

  const handleDrop = (targetIdx) => {
    if (dragIndex !== null && dragIndex !== targetIdx) {
      const lay = ensureLayout();
      const newOrder = [...lay.order];
      const [moved] = newOrder.splice(dragIndex, 1);
      newOrder.splice(targetIdx, 0, moved);
      onChange({ ...lay, order: newOrder });
    }
    setDragIndex(null);
    setHoverIndex(null);
  };
  const handlePointerUp = () => {
    if (dragIndex !== null && hoverIndex !== null) handleDrop(hoverIndex);
    else { setDragIndex(null); setHoverIndex(null); }
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
        <div className={`filter-dropdown-menu col-panel-menu${alignRight ? ' filter-dropdown-menu--right' : ''}`} ref={menuRef}>
          {order.map((key, idx) => {
            const col = colMap[key];
            if (!col) return null;
            const tf = getTransform(idx);
            return (
              <div
                key={key}
                className={`col-panel-row${dragIndex === idx ? ' col-panel-dragging' : ''}`}
                style={{ transform: tf }}
                data-row-index={idx}
                onPointerDown={e => handlePointerDown(idx, e)}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
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
