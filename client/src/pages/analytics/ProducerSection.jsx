import { useState } from 'react';
import StyleLeaderboardTable from './StyleLeaderboardTable';
import ProducerConsistencyTable from './ProducerConsistencyTable';
import { buildProducerLeaderboard, buildProducerConsistency } from '../../utils/analyticsHelpers';
import './RatingSection.css';
import './GeographicSection.css';
import './StyleSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];
const ALL_CATS = ['wine', 'beer', 'whiskey', 'others'];

const BLOCK_HEADING = {
  wine:    'Wine — producers',
  beer:    'Beer — breweries',
  whiskey: 'Whiskey — distilleries',
  others:  'Others — distilleries',
};

function ProducerBlock({ category, drinks }) {
  const rows = buildProducerLeaderboard(drinks, category);
  const consistency = buildProducerConsistency(drinks, category);

  const onSelectProducer = (name) => window.open(`/${category}?producer=${encodeURIComponent(name)}`, '_blank');

  return (
    <div className="style-block">
      <h3 className="analytics-subsection-title">{BLOCK_HEADING[category]}</h3>
      <StyleLeaderboardTable rows={rows} label="Producer" onSelectStyle={onSelectProducer} />

      <h4 className="style-undiscovered-title">Consistency</h4>
      <ProducerConsistencyTable data={consistency} onSelectProducer={onSelectProducer} />
    </div>
  );
}

export default function ProducerSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const category = override ?? globalCategory;
  const cats = category === 'all' ? ALL_CATS : [category];

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <div className="category-tabs" data-testid="producer-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {cats.map(c => (
        <ProducerBlock key={c} category={c} drinks={drinks.filter(d => d._category === c)} />
      ))}
    </div>
  );
}
