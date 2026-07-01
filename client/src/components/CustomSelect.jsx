import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import './CustomSelect.css';

export default function CustomSelect({ id, value, onChange, options, placeholder = 'Select…', compact = false }) {
  const [open, setOpen] = useState(false);
  const [menuStyle, setMenuStyle] = useState({});
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const close = e => {
      if (!ref.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  // Close on any scroll when compact — the portal menu doesn't follow table scroll
  useEffect(() => {
    if (!open || !compact) return;
    const close = () => setOpen(false);
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [open, compact]);

  const handleOpen = () => {
    if (compact && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      // Use viewport coordinates — menu is portaled to <body> so position:fixed is truly viewport-relative
      setMenuStyle({ position: 'fixed', top: rect.bottom + 4, left: rect.left, right: 'auto', minWidth: rect.width, zIndex: 9999 });
    }
    setOpen(o => !o);
  };

  const menu = (
    <ul ref={menuRef} className="custom-select-menu" style={compact ? menuStyle : undefined}>
      <li className={!value ? 'cs-selected' : ''} onMouseDown={() => { onChange(''); setOpen(false); }}>{placeholder}</li>
      {options.map(opt => (
        <li key={opt} className={value === opt ? 'cs-selected' : ''} onMouseDown={() => { onChange(opt); setOpen(false); }}>{opt}</li>
      ))}
    </ul>
  );

  return (
    <div ref={ref} className={`custom-select${compact ? ' custom-select-compact' : ''}`} onClick={e => e.stopPropagation()}>
      <button ref={triggerRef} id={id} type="button" className={`custom-select-trigger${open ? ' open' : ''}`} onClick={handleOpen}>
        <span className={value ? '' : 'cs-placeholder'}>{value || placeholder}</span>
        <svg width="10" height="6" viewBox="0 0 10 6" aria-hidden="true"><path d="M0 0l5 6 5-6z" fill="currentColor"/></svg>
      </button>
      {open && (compact ? createPortal(menu, document.body) : menu)}
    </div>
  );
}
