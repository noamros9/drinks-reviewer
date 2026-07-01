import { useState, useRef, useEffect } from 'react';
import './AutocompleteInput.css';

export default function AutocompleteInput({ id, name, value, onChange, suggestions = [], placeholder = '' }) {
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const wrapRef = useRef(null);

  const filtered = value
    ? suggestions.filter(s => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
    : [];

  useEffect(() => { setActiveIdx(-1); }, [value]);

  useEffect(() => {
    const close = e => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const pick = val => { onChange({ target: { name, value: val } }); setOpen(false); };

  const onKeyDown = e => {
    if (!open || !filtered.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, -1)); }
    else if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(filtered[activeIdx]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div ref={wrapRef} className="autocomplete-wrap">
      <input
        id={id}
        name={name}
        type="text"
        value={value}
        onChange={e => { onChange(e); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <ul className="autocomplete-menu">
          {filtered.map((s, i) => (
            <li
              key={s}
              className={i === activeIdx ? 'ac-active' : ''}
              onMouseDown={() => pick(s)}
            >
              {s}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
