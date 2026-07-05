import { useState } from 'react';
import StyleLeaderboardTable from './StyleLeaderboardTable';
import { buildStyleLeaderboard, buildUndiscovered } from '../../utils/analyticsHelpers';
import './RatingSection.css';
import './GeographicSection.css';
import './StyleSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];
const ALL_CATS = ['wine', 'beer', 'whiskey', 'others'];

const BLOCK_CONFIG = {
  wine:    { heading: 'Wine — varieties',     label: 'Variety', urlField: 'variety' },
  beer:    { heading: 'Beer — styles',        label: 'Style',   urlField: 'style' },
  whiskey: { heading: 'Whiskey — styles',     label: 'Style',   urlField: 'style' },
  others:  { heading: 'Others — styles',      label: 'Style',   urlField: 'style' },
};

function StyleBlock({ category, drinks }) {
  const [splitBlends, setSplitBlends] = useState(true);
  const { heading, label, urlField } = BLOCK_CONFIG[category];
  const isWine = category === 'wine';
  const blendMode = isWine && !splitBlends;

  const rows = buildStyleLeaderboard(drinks, category, { splitBlends });
  const undiscovered = buildUndiscovered(rows);

  // Blend mode is display-only: a whole-blend string won't match the split-grape filter.
  const onSelectStyle = blendMode
    ? undefined
    : (style) => window.open(`/${category}?${urlField}=${encodeURIComponent(style)}`, '_blank');

  return (
    <div className="style-block">
      <h3 className="analytics-subsection-title">{heading}</h3>
      {isWine && (
        <div className="category-tabs" data-testid="wine-blend-toggle">
          <button className={splitBlends ? 'active' : ''} onClick={() => setSplitBlends(true)}>By grape</button>
          <button className={!splitBlends ? 'active' : ''} onClick={() => setSplitBlends(false)}>By blend</button>
        </div>
      )}
      <StyleLeaderboardTable rows={rows} label={label} onSelectStyle={onSelectStyle} />

      <h4 className="style-undiscovered-title">Undiscovered <span className="scope-note">(avg ≥ 8, ≤ 3 tasted)</span></h4>
      {undiscovered.length === 0
        ? <p className="empty-state">Nothing undiscovered here.</p>
        : (
          <ul className="style-undiscovered-list">
            {undiscovered.map(r => (
              <li key={r.style}>
                <span className="style-undiscovered-name">{r.style}</span>
                <span className="style-undiscovered-meta">{r.avgRating} avg · {r.count} tasted</span>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}

export default function StyleSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const category = override ?? globalCategory;
  const cats = category === 'all' ? ALL_CATS : [category];

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <div className="category-tabs" data-testid="style-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {cats.map(c => (
        <StyleBlock key={c} category={c} drinks={drinks.filter(d => d._category === c)} />
      ))}
    </div>
  );
}
