import { useEffect, useMemo, useState } from 'react';
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

function tastingCell(tasting, category) {
  if (!tasting) return '—';
  const vintage = category === 'wine' && tasting.vintage ? ` (${tasting.vintage})` : '';
  return `${tasting.date} — ${tasting.rating}${vintage}`;
}

export default function ComparePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category');
  const ids = (searchParams.get('ids') || '').split(',').filter(Boolean);
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

  const weights = useMemo(() => buildWeightedRatings(drinks), [drinks]);

  if (!validCategory) {
    return (
      <div className="compare-page">
        <p className="empty-state">Unknown category. <button type="button" onClick={() => navigate('/')}>Go home</button></p>
      </div>
    );
  }

  if (!loaded) return null;

  const compared = ids.length >= 2 ? ids.map(id => drinks.find(d => d.id === id)) : [];
  const allFound = compared.length >= 2 && compared.every(Boolean);

  if (!allFound) {
    return (
      <div className="compare-page">
        <p className="empty-state">
          Couldn&apos;t find both drinks to compare.{' '}
          <button type="button" onClick={() => navigate(`/${category}`)}>Back to {TITLES[category]}</button>
        </p>
      </div>
    );
  }

  const fields = FIELDS[category];
  const maxTastings = Math.max(...compared.map(d => d.tastings?.length ?? 0));

  return (
    <div className="compare-page">
      <div className="page-header">
        <h1>Compare</h1>
        <button type="button" className="compare-back" onClick={() => navigate(`/${category}`)}>← Back to {TITLES[category]}</button>
      </div>
      <div className="compare-table-wrap">
        <table className="compare-table" data-testid="compare-fields-table">
          <thead>
            <tr>
              <th />
              {compared.map(d => <th key={d.id}>{drinkLabel(d)}</th>)}
            </tr>
          </thead>
          <tbody>
            {fields.map(field => (
              <tr key={field.key}>
                <th>{field.label}</th>
                {compared.map(d => <td key={d.id}>{fieldValue(d, field)}</td>)}
              </tr>
            ))}
            <tr className="compare-stats-row">
              <th>Weighted Rating</th>
              {compared.map(d => <td key={d.id}>{weights.get(d.id) ?? '—'}</td>)}
            </tr>
            <tr>
              <th>Avg Lot Price</th>
              {compared.map(d => <td key={d.id}>{avgLotPrice(d) ?? '—'}</td>)}
            </tr>
            <tr>
              <th>Tastings</th>
              {compared.map(d => <td key={d.id}>{d.tastingCount ?? 0}</td>)}
            </tr>
          </tbody>
        </table>
      </div>

      {maxTastings > 0 && (
        <div className="compare-table-wrap">
          <table className="compare-table compare-history-table" data-testid="compare-history-table">
            <thead>
              <tr>
                <th>Tasting</th>
                {compared.map(d => <th key={d.id}>{drinkLabel(d)}</th>)}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: maxTastings }, (_, i) => (
                <tr key={i}>
                  <th>#{i + 1}</th>
                  {compared.map(d => <td key={d.id}>{tastingCell(d.tastings?.[i], category)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
