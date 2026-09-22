import { useEffect, useState } from 'react';
import { resolveColumnOrder } from '../components/DrinkTable';

// Per-list column order + hidden set, remembered in localStorage under `key`. Storage is a
// per-browser convenience: a private window or blocked site data must not break the page,
// so every read and write is guarded and an unreadable layout means "no saved layout".
function load(key, columns) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const { order, hidden } = JSON.parse(raw);
    return { order: resolveColumnOrder(order, columns || []), hidden: new Set(hidden) };
  } catch { return null; }
}

function save(key, layout) {
  try {
    if (!layout) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify({ order: layout.order, hidden: [...layout.hidden] }));
  } catch { /* storage unavailable — the layout still applies for this session */ }
}

export function useColumnLayout(key, columns) {
  const [layout, setLayout] = useState(() => load(key, columns));

  // The Category page reuses one hook across categories, each with its own saved layout.
  useEffect(() => { setLayout(load(key, columns)); }, [key]);

  const update = (next) => {
    setLayout(next);
    save(key, next);
  };

  return [layout, update];
}
