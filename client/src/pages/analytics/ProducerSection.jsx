import StyleLeaderboardTable from './StyleLeaderboardTable';
import ProducerConsistencyTable from './ProducerConsistencyTable';
import { buildProducerLeaderboard, buildProducerConsistency } from '../../utils/analyticsHelpers';
import './RatingSection.css';
import './GeographicSection.css';
import './StyleSection.css';

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
  const category = globalCategory;
  const cats = category === 'all' ? ALL_CATS : [category];

  return (
    <div className="analytics-section">
      {cats.map(c => (
        <ProducerBlock key={c} category={c} drinks={drinks.filter(d => d._category === c)} />
      ))}
    </div>
  );
}
