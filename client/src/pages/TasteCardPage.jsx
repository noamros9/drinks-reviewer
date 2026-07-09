import { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import './RecommendPage.css';
import './TasteCardPage.css';

const TITLES = { wine: 'Wine', beer: 'Beer', whiskey: 'Whiskey', others: 'Others' };

const FIELD_LABELS = {
  wineCategory: 'Category', variety: 'Variety', sweetness: 'Sweetness', country: 'Country',
  region: 'Region', abv: 'ABV', style: 'Style', age: 'Age', drinkCategory: 'Category',
};

function formatValue(field, value) {
  if (value == null) return null;
  if (Array.isArray(value)) return value.length ? value.join(' / ') : null;
  if (typeof value === 'object' && 'avg' in value) {
    return value.min === value.max ? `${value.avg}` : `${value.avg} (${value.min}–${value.max})`;
  }
  return String(value);
}

function TasteProfileFields({ profile }) {
  const profileFields = Object.keys(profile).filter(f => !['category', 'entryCount', 'topTags'].includes(f));
  return (
    <>
      <div className="taste-profile-entry">
        <dt>Based on</dt>
        <dd>{profile.entryCount} rated {profile.entryCount === 1 ? 'entry' : 'entries'}</dd>
      </div>
      {profileFields.map(field => {
        const formatted = formatValue(field, profile[field]);
        if (!formatted) return null;
        return (
          <div className="taste-profile-entry" key={field}>
            <dt>{FIELD_LABELS[field] || field}</dt>
            <dd>{formatted}</dd>
          </div>
        );
      })}
      {profile.topTags?.length > 0 && (
        <div className="taste-profile-entry">
          <dt>Top tags</dt>
          <dd className="taste-profile-tags">
            {profile.topTags.map(tag => <span className="taste-profile-tag" key={tag}>{tag}</span>)}
          </dd>
        </div>
      )}
    </>
  );
}

export default function TasteCardPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const category = searchParams.get('category');
  const [status, setStatus] = useState('loading');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setStatus('loading');
    fetch('/api/taste-card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    })
      .then(async r => {
        if (!r.ok) { setError((await r.json().catch(() => ({}))).error || ''); throw new Error(); }
        return r.json();
      })
      .then(result => { setData(result); setStatus('done'); })
      .catch(() => setStatus('error'));
  }, [category]);

  if (status === 'loading') {
    return (
      <div className="taste-card-page">
        <p className="empty-state">Building your taste card&hellip; this can take up to 30 seconds.</p>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="taste-card-page">
        <p className="empty-state">
          {error || "Couldn't build a taste card right now."}{' '}
          <button type="button" onClick={() => navigate(-1)}>Go back</button>
        </p>
      </div>
    );
  }

  const { profile, disliked, analysis, availableInIsrael = [], notAvailable = [], styleExplorations = [] } = data || {};

  return (
    <div className="taste-card-page">
      <div className="page-header">
        <h1>Your {TITLES[category] || category} taste card</h1>
        <button type="button" className="recommend-back" onClick={() => navigate(-1)}>← Back</button>
      </div>

      {analysis && <p className="taste-profile-analysis">{analysis}</p>}

      <dl className="taste-profile-card" data-testid="taste-profile">
        <TasteProfileFields profile={profile} />
      </dl>

      {disliked && (
        <>
          <h3 className="recommend-section-title">What you tend to avoid</h3>
          <dl className="taste-profile-card" data-testid="taste-profile-disliked">
            <TasteProfileFields profile={disliked} />
          </dl>
        </>
      )}

      <h3 className="recommend-section-title">Available in Israel</h3>
      {availableInIsrael.length === 0
        ? <p className="empty-state">No purchasable matches found.</p>
        : (
          <ul className="recommend-list" data-testid="taste-card-available">
            {availableInIsrael.map((entry, i) => (
              <li key={i}>
                <a href={entry.url} target="_blank" rel="noreferrer">{entry.name}</a>
                {entry.description && <span className="recommend-reason">{entry.description}</span>}
              </li>
            ))}
          </ul>
        )}

      <h3 className="recommend-section-title">Not readily available</h3>
      {notAvailable.length === 0
        ? <p className="empty-state">Nothing else to show.</p>
        : (
          <ul className="recommend-list" data-testid="taste-card-unavailable">
            {notAvailable.map((entry, i) => (
              <li key={i}>
                {entry.name}
                {entry.description && <span className="recommend-reason">{entry.description}</span>}
              </li>
            ))}
          </ul>
        )}

      {styleExplorations.length > 0 && (
        <section data-testid="style-explorations">
          <h3 className="recommend-section-title">Styles worth exploring</h3>
          {styleExplorations.map((se, i) => (
            <div className="style-exploration" data-testid={`style-exploration-${i}`} key={i}>
              <h4>{se.style}</h4>
              {se.why && <p className="recommend-reason">{se.why}</p>}
              {se.availableInIsrael.length > 0 && (
                <ul className="recommend-list">
                  {se.availableInIsrael.map((entry, j) => (
                    <li key={j}>
                      <a href={entry.url} target="_blank" rel="noreferrer">{entry.name}</a>
                      {entry.description && <span className="recommend-reason">{entry.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
              {se.notAvailable.length > 0 && (
                <ul className="recommend-list">
                  {se.notAvailable.map((entry, j) => (
                    <li key={j}>
                      {entry.name}
                      {entry.description && <span className="recommend-reason">{entry.description}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
