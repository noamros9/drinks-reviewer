import { useState, useEffect, useRef } from 'react';
import './CustomSelect.css';

export default function CustomSelect({ id, value, onChange, options, placeholder = 'Select…', compact = false }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const ref = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Close on scroll when in compact/fixed mode — the fixed menu won't follow the table
  useEffect(() => {
    if (!open || !compact) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open, compact]);

  const handleOpen = () => {
    if (compact && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setMenuStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, minWidth: rect.width, zIndex: 9999 });
    }
    setOpen(o => !o);
  };

  return (
    <div ref={ref} className={`custom-select${compact ? ' custom-select-compact' : ''}`} onClick={e => e.stopPropagation()}>
      <button ref={triggerRef} id={id} type="button" className={`custom-select-trigger${open ? ' open' : ''}`} onClick={handleOpen}>
        <span className={value ? '' : 'cs-placeholder'}>{value || placeholder}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg>
      </button>
      {open && (
        <ul className="custom-select-menu" style={compact ? menuStyle : undefined}>
          <li className={!value ? 'cs-selected' : ''} onMouseDown={() => { onChange(''); setOpen(false); }}>{placeholder}</li>
          {options.map(opt => (
            <li key={opt} className={value === opt ? 'cs-selected' : ''} onMouseDown={() => { onChange(opt); setOpen(false); }}>{opt}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
