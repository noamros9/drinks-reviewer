import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import DrinkList from '../components/DrinkList';
import './RecommendPage.css';

const TITLES = { wine: 'Wine', beer: 'Beer', whiskey: 'Whiskey', others: 'Others' };

function parseSeeds(raw) {
  return (raw || '').split(',').filter(Boolean).map(pair => {
    const [id, category] = pair.split(':');
    return { id, category };
  });
}

export default function RecommendPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const seeds = parseSeeds(searchParams.get('seeds'));
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [catalogue, setCatalogue] = useState({});

  useEffect(() => {
    if (seeds.length < 1) { setStatus('error'); return; }
    setStatus('loading');
    fetch('/api/recommend', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seeds }),
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(result => { setData(result); setStatus('done'); })
      .catch(() => setStatus('error'));
  }, [searchParams.get('seeds')]);

  useEffect(() => {
    if (!data?.ownCatalogue?.length) return;
    const categories = [...new Set(data.ownCatalogue.map(e => e.category))];
    Promise.all(categories.map(c => fetch(`/api/${c}`).then(r => r.ok ? r.json() : []).then(d => [c, d])))
      .then(pairs => setCatalogue(Object.fromEntries(pairs)))
      .catch(() => {});
  }, [data]);

  const handleOwnClick = (entry) => {
    const drink = (catalogue[entry.category] || []).find(d => d.id === entry.id);
    if (!drink) return;
    navigate('/admin', { state: { drink, category: entry.category, tab: 'tastings' } });
  };

  if (status === 'loading') {
    return (
      <div className="recommend-page">
        <p className="empty-state">Finding recommendations&hellip; this can take up to 30 seconds.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="recommend-page">
        <p className="empty-state">
          Couldn&apos;t get recommendations right now.{' '}
          <button type="button" onClick={() => navigate(-1)}>Go back</button>
        </p>
      </div>
    );
  }

  const { ownCatalogue = [], availableInIsrael = [], notAvailable = [] } = data || {};

  return (
    <div className="recommend-page">
      <div className="page-header">
        <h1>Recommended for you</h1>
        <button type="button" className="btn-outline" onClick={() => navigate(-1)}>← Back</button>
      </div>

      <h3 className="recommend-section-title">Already in your catalogue</h3>
      {ownCatalogue.length === 0
        ? <p className="empty-state">No close matches in your catalogue.</p>
        : (
          <ul className="recommend-list" data-testid="recommend-own-catalogue">
            {ownCatalogue.map(entry => (
              <li key={`${entry.category}-${entry.id}`}>
                <button type="button" className="recommend-link" onClick={() => handleOwnClick(entry)}>
                  {entry.label} <span className="recommend-category">({TITLES[entry.category] || entry.category})</span>
                </button>
                {entry.reason && <span className="recommend-reason">{entry.reason}</span>}
              </li>
            ))}
          </ul>
        )}

      <h3 className="recommend-section-title">Available in Israel</h3>
      <DrinkList entries={availableInIsrael} linked testId="recommend-available" emptyText="No purchasable matches found." />

      <h3 className="recommend-section-title">Not readily available</h3>
      <DrinkList entries={notAvailable} testId="recommend-unavailable" emptyText="Nothing else to show." />
    </div>
  );
}
