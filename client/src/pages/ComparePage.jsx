import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { FIELDS } from './AdminPage';
import { buildWeightedRatings, avgLotPrice, drinkLabel } from '../utils/analyticsHelpers';
import './ComparePage.css';

const TITLES = { wine: 'Wine', beer: 'Beer', whiskey: 'Whiskey', others: 'Others' };

function fieldValue(drink, field) {
  const value = drink[field.key];
  if (field.type === 'tags') return (value || []).join(', ') || '—';
  return value || value === 0 ? value : '—';
}

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category');
  const aId = searchParams.get('a');
  const bId = searchParams.get('b');
  const validCategory = Boolean(category && FIELDS[category]);
  const [drinks, setDrinks] = useState([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!validCategory) { setLoaded(true); return; }
    setLoaded(false);
    fetch(`/api/${category}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { setDrinks(Array.isArray(data) ? data : []); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [category, validCategory]);

  if (!validCategory) {
    return (
      <div className="compare-page">
        <p className="empty-state">Unknown category. <button type="button" onClick={() => navigate('/')}>Go home</button></p>
      </div>
    );
  }

  if (!loaded) return null;

  const a = drinks.find(d => d.id === aId);
  const b = drinks.find(d => d.id === bId);

  if (!a || !b) {
    return (
      <div className="compare-page">
        <p className="empty-state">
          Couldn&apos;t find both drinks to compare.{' '}
          <button type="button" onClick={() => navigate(`/${category}`)}>Back to {TITLES[category]}</button>
        </p>
      </div>
    );
  }

  const weights = buildWeightedRatings(drinks);
  const fields = FIELDS[category];
  const maxTastings = Math.max(a.tastings?.length ?? 0, b.tastings?.length ?? 0);

  return (
    <div className="compare-page">
      <div className="page-header">
        <h1>Compare</h1>
        <button type="button" className="compare-back" onClick={() => navigate(`/${category}`)}>← Back to {TITLES[category]}</button>
      </div>
      <table className="compare-table" data-testid="compare-fields-table">
        <thead>
          <tr>
            <th />
            <th>{drinkLabel(a)}</th>
            <th>{drinkLabel(b)}</th>
          </tr>
        </thead>
        <tbody>
          {fields.map(field => (
            <tr key={field.key}>
              <th>{field.label}</th>
              <td>{fieldValue(a, field)}</td>
              <td>{fieldValue(b, field)}</td>
            </tr>
          ))}
          <tr className="compare-stats-row">
            <th>Weighted Rating</th>
            <td>{weights.get(a.id) ?? '—'}</td>
            <td>{weights.get(b.id) ?? '—'}</td>
          </tr>
          <tr>
            <th>Avg Lot Price</th>
            <td>{avgLotPrice(a) ?? '—'}</td>
            <td>{avgLotPrice(b) ?? '—'}</td>
          </tr>
          <tr>
            <th>Tastings</th>
            <td>{a.tastingCount ?? 0}</td>
            <td>{b.tastingCount ?? 0}</td>
          </tr>
        </tbody>
      </table>

      {maxTastings > 0 && (
        <table className="compare-table compare-history-table" data-testid="compare-history-table">
          <thead>
            <tr>
              <th>Tasting</th>
              <th>{drinkLabel(a)}</th>
              <th>{drinkLabel(b)}</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: maxTastings }, (_, i) => (
              <tr key={i}>
                <th>#{i + 1}</th>
                <td>{tastingCell(a.tastings?.[i], category)}</td>
                <td>{tastingCell(b.tastings?.[i], category)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function tastingCell(tasting, category) {
  if (!tasting) return '—';
  const vintage = category === 'wine' && tasting.vintage ? ` (${tasting.vintage})` : '';
  return `${tasting.date} — ${tasting.rating}${vintage}`;
}
