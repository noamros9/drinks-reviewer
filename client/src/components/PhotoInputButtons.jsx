import { useState, useRef, useEffect } from 'react';

export default function PhotoInputButtons({ hasPhoto, label, variant, onSelect, testId }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const pick = e => {
    onSelect(e.target.files[0] || null);
    setOpen(false);
  };

  return (
    <span className="photo-input-buttons" ref={ref}>
      <button
        type="button"
        className={`${variant}${hasPhoto ? ' has-photo' : ''}`}
        onClick={() => setOpen(o => !o)}
        data-testid={testId && `${testId}-trigger`}
      >
        {hasPhoto ? 'Change photo' : label}
      </button>
      {open && (
        <div className="photo-input-menu">
          <label className="photo-input-option">
            📷 Take Photo
            <input type="file" accept="image/*" capture="environment" data-testid={testId && `${testId}-camera`} onChange={pick} />
          </label>
          <label className="photo-input-option">
            🖼️ Choose from Gallery
            <input type="file" accept="image/*" data-testid={testId} onChange={pick} />
          </label>
        </div>
      )}
    </span>
  );
}
