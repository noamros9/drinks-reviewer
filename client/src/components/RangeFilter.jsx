import { useState, useRef, useEffect } from 'react';
import { useDropdownAlign } from '../hooks/useDropdownAlign';
import './RangeFilter.css';

export default function RangeFilter({ config, min, max, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { alignRight, menuRef } = useDropdownAlign(open);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const hasActive = min !== '' || max !== '';
  const maxFallback = config.unbounded ? '∞' : config.max;

  const label = hasActive
    ? `${config.label} ${min !== '' ? min : config.min}–${max !== '' ? max : maxFallback}${config.unit}`
    : config.label;

  return (
    <div className="filter-dropdown filter-dropdown--range" ref={ref}>
      <button
        className={`filter-dropdown-btn${hasActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        data-testid={`filter-${config.key}`}
      >
        {label}
        <span className="filter-chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className={`filter-dropdown-menu${alignRight ? ' filter-dropdown-menu--right' : ''}`} ref={menuRef}>
          <div className="range-filter-row">
            <span className="range-filter-label">Min</span>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step}
              value={min}
              onChange={e => onChange(e.target.value, max)}
              placeholder={String(config.min)}
              className="range-input"
              data-testid={`${config.key}-min`}
            />
            {config.unit && <span className="range-unit">{config.unit}</span>}
          </div>
          <div className="range-filter-row">
            <span className="range-filter-label">Max</span>
            <input
              type="number"
              min={config.min}
              max={config.max}
              step={config.step}
              value={max}
              onChange={e => onChange(min, e.target.value)}
              placeholder={String(maxFallback)}
              className="range-input"
              data-testid={`${config.key}-max`}
            />
            {config.unit && <span className="range-unit">{config.unit}</span>}
          </div>
          {hasActive && (
            <button
              className="filter-clear-btn"
              onClick={() => onChange('', '')}
            >
              Clear filter
            </button>
          )}
        </div>
      )}
    </div>
  );
}
