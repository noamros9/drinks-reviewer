import { useState, useRef, useEffect } from 'react';
import './AbvFilter.css';

export default function AbvFilter({ abvMin, abvMax, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasActive = abvMin !== '' || abvMax !== '';

  const label = hasActive
    ? `ABV ${abvMin !== '' ? abvMin : '0'}–${abvMax !== '' ? abvMax : '∞'}%`
    : 'ABV';

  return (
    <div className="filter-dropdown filter-dropdown--abv" ref={ref}>
      <button
        className={`filter-dropdown-btn${hasActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        data-testid="filter-abv"
      >
        {label}
        <span className="filter-chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className="filter-dropdown-menu">
          <div className="abv-filter-row">
            <span className="abv-filter-label">Min</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={abvMin}
              onChange={e => onChange({ abvMin: e.target.value, abvMax })}
              placeholder="0"
              className="abv-input"
              data-testid="abv-min"
            />
            <span className="abv-unit">%</span>
          </div>
          <div className="abv-filter-row">
            <span className="abv-filter-label">Max</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.1"
              value={abvMax}
              onChange={e => onChange({ abvMin, abvMax: e.target.value })}
              placeholder="∞"
              className="abv-input"
              data-testid="abv-max"
            />
            <span className="abv-unit">%</span>
          </div>
          {hasActive && (
            <button
              className="filter-clear-btn"
              onClick={() => onChange({ abvMin: '', abvMax: '' })}
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
