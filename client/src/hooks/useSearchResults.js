import { useEffect, useState } from 'react';

const DEBOUNCE_MS = 300;

// Debounced, multi-category Atlas Search lookup. Returns null when there's no active
// query (skip filtering entirely), or a Set of matched drink ids otherwise.
export function useSearchResults(categories, query) {
  const [ids, setIds] = useState(null);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setIds(null);
      return;
    }
    let stale = false;
    const timer = setTimeout(() => {
      const cats = Array.isArray(categories) ? categories : [categories];
      Promise.all(
        cats.map(cat =>
          fetch(`/api/${cat}/search?q=${encodeURIComponent(q)}`)
            .then(r => r.ok ? r.json() : [])
            .catch(() => [])
        )
      ).then(results => { if (!stale) setIds(new Set(results.flat().map(d => d.id))); });
    }, DEBOUNCE_MS);
    return () => { stale = true; clearTimeout(timer); };
  }, [JSON.stringify(categories), query]);

  return ids;
}
