import { useState, useRef, useEffect, useLayoutEffect } from 'react';

export default function FilterDropdown({ label, options, specialOptions, selected, counts = {}, onChange }) {
  const [open, setOpen] = useState(false);
  const [alignRight, setAlignRight] = useState(false);
  const ref = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useLayoutEffect(() => {
    if (open && menuRef.current) {
      setAlignRight(menuRef.current.getBoundingClientRect().right > window.innerWidth);
    }
  }, [open]);

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
          {options.map(opt => (
            <label key={opt} className="filter-option">
              <input type="checkbox" checked={selected.has(opt)} onChange={() => toggle(opt)} />
              <span>{opt}</span>
              {counts[opt] != null && <span className="filter-option-count">{counts[opt]}</span>}
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
