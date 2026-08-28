import { useState, useRef, useEffect } from 'react';
import { useDropdownAlign } from '../hooks/useDropdownAlign';

export default function FilterDropdown({ label, options, specialOptions, selected, counts = {}, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const { alignRight, menuRef } = useDropdownAlign(open);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (value) => {
    const next = new Set(selected);
    next.has(value) ? next.delete(value) : next.add(value);
    onChange(next);
  };

  const clear = (e) => {
    e.stopPropagation();
    onChange(new Set());
  };

  const hasActive = selected.size > 0;
  // Options are plain strings for flat filters, or {value, label, depth} for hierarchical
  // ones. Normalizing here keeps this component generic -- it never knows about regions.
  const opts = options.map(o => (typeof o === 'string' ? { value: o, label: o, depth: 0 } : o));

  return (
    <div className="filter-dropdown" ref={ref}>
      <button
        className={`filter-dropdown-btn${hasActive ? ' active' : ''}`}
        onClick={() => setOpen(o => !o)}
        data-testid={`filter-dropdown-${label.toLowerCase()}`}
      >
        {label}
        {hasActive && <span className="filter-count">{selected.size}</span>}
        <span className="filter-chevron">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div className={`filter-dropdown-menu${alignRight ? ' filter-dropdown-menu--right' : ''}`} ref={menuRef}>
          {specialOptions.length > 0 && (
            <>
              {specialOptions.map(opt => (
                <label key={opt} className="filter-option">
                  <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
                  <span>{opt}</span>
                  {counts[opt] != null && <span className="filter-option-count">{counts[opt]}</span>}
                </label>
              ))}
              <div className="filter-separator" />
            </>
          )}
          {opts.map(({ value, label: optLabel, depth }) => (
            <label
              key={value}
              className="filter-option"
              title={value}
              style={depth ? { paddingLeft: `${0.85 + depth * 0.9}rem` } : undefined}
            >
              <input type="checkbox" checked={selected.has(value)} onChange={() => toggle(value)} />
              <span>{optLabel}</span>
              {counts[value] != null && <span className="filter-option-count">{counts[value]}</span>}
            </label>
          ))}
          {hasActive && (
            <button className="filter-clear-btn" onClick={clear}>Clear filter</button>
          )}
        </div>
      )}
    </div>
  );
}
