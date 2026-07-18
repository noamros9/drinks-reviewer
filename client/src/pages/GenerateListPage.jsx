import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DrinkList from '../components/DrinkList';
import './RecommendPage.css';
import './GenerateListPage.css';

const TITLES = { wine: 'Wine', beer: 'Beer', whiskey: 'Whiskey', others: 'Others' };

function CatalogueList({ entries, testId, emptyText, onClick }) {
  return entries.length === 0
    ? <p className="empty-state">{emptyText}</p>
    : (
      <ol className="recommend-list" data-testid={testId}>
        {entries.map(entry => (
          <li key={`${entry.category}-${entry.id}`}>
            <button type="button" className="recommend-link" onClick={() => onClick(entry)}>
              {entry.label} <span className="recommend-category">({TITLES[entry.category] || entry.category})</span>
            </button>
            {entry.reason && <span className="recommend-reason">{entry.reason}</span>}
          </li>
        ))}
      </ol>
    );
}

export default function GenerateListPage() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [status, setStatus] = useState('idle');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [catalogue, setCatalogue] = useState({});

  useEffect(() => {
    fetch('/api/tags').catch(() => {});
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = prompt.trim();
    if (!trimmed) return;
    setStatus('loading');
    setError('');
    fetch('/api/generate-list', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: trimmed }),
    })
      .then(async r => {
        if (!r.ok) {
          const body = await r.json().catch(() => ({}));
          setError(body.error || '');
          throw new Error();
        }
        return r.json();
      })
      .then(result => {
        setData(result);
        setStatus('done');
        const owned = [...(result.inCollection || []), ...(result.elsewhereInCatalogue || [])];
        const categories = [...new Set(owned.map(e => e.category))];
        Promise.all(categories.map(c => fetch(`/api/${c}`).then(r => r.ok ? r.json() : []).then(d => [c, d])))
          .then(pairs => setCatalogue(Object.fromEntries(pairs)))
          .catch(() => {});
      })
      .catch(() => setStatus('error'));
  };

  const handleResultClick = (entry) => {
    const drink = (catalogue[entry.category] || []).find(d => d.id === entry.id);
    if (!drink) return;
    navigate('/admin', { state: { drink, category: entry.category, tab: 'tastings' } });
  };

  const { inCollection = [], elsewhereInCatalogue = [], toBuy = [] } = data || {};

  return (
    <div className="recommend-page generate-list-page">
      <div className="page-header">
        <h1>Generate a list</h1>
      </div>

      <form className="generate-list-form" onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="e.g. something bold for a barbecue"
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          aria-label="Describe what you're looking for"
        />
        <button type="submit" className="btn-outline" disabled={status === 'loading' || !prompt.trim()}>
          Generate
        </button>
      </form>

      {status === 'loading' && (
        <p className="empty-state">Generating your list&hellip; this can take up to 30 seconds.</p>
      )}

      {status === 'error' && (
        <p className="empty-state">{error || "Couldn't generate a list right now."}</p>
      )}

      {status === 'done' && (
        <>
          <h3 className="recommend-section-title">In my collection</h3>
          <CatalogueList
            entries={inCollection}
            testId="generate-list-collection"
            emptyText="Nothing in your collection matches that."
            onClick={handleResultClick}
          />

          <h3 className="recommend-section-title">Elsewhere in your catalogue</h3>
          <CatalogueList
            entries={elsewhereInCatalogue}
            testId="generate-list-elsewhere"
            emptyText="Nothing else in your catalogue matches that."
            onClick={handleResultClick}
          />

          <h3 className="recommend-section-title">To buy</h3>
          <DrinkList entries={toBuy} linked testId="generate-list-to-buy" emptyText="No purchasable matches found." />
        </>
      )}
    </div>
  );
}
