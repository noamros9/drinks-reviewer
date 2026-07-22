import { useEffect, useState } from 'react';
import PublicDrinkList from '../components/PublicDrinkList';

export default function CatalogPage() {
  const [status, setStatus] = useState('loading');
  const [entries, setEntries] = useState([]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/catalog')
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(data => { if (!cancelled) { setEntries(data); setStatus('done'); } })
      .catch(err => { if (!cancelled) setStatus(err === 404 ? 'private' : 'error'); });
    return () => { cancelled = true; };
  }, []);

  if (status === 'loading') return <div className="category-page"><p className="empty-state">Loading&hellip;</p></div>;
  if (status === 'private') return <div className="category-page"><p className="empty-state">This catalog isn&apos;t public.</p></div>;
  if (status === 'error') return <div className="category-page"><p className="empty-state">Couldn&apos;t load the catalog right now.</p></div>;

  return (
    <div className="category-page">
      <div className="page-header">
        <h1>Catalog</h1>
        <span className="count-badge">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
      </div>
      <PublicDrinkList entries={entries} />
    </div>
  );
}
