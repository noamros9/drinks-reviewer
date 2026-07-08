import { useNavigate } from 'react-router-dom';
import StyleLeaderboardTable from './StyleLeaderboardTable';
import AbvRatingScatter from '../../components/AbvRatingScatter';
import { buildVintageLeaderboard, buildAgeVsRatingScatter } from '../../utils/analyticsHelpers';
import './RatingSection.css';

// Wine-only, so deliberately has no Scope tabs like sibling sections — the
// "(wine only)" note below is a static label, not an interactive filter row.
export default function VintageSection({ drinks }) {
  const navigate = useNavigate();
  const wine = drinks.filter(d => d._category === 'wine');
  const rows = buildVintageLeaderboard(wine);
  const scatterPoints = buildAgeVsRatingScatter(wine);

  const onSelectVintage = (year) => window.open(`/wine?vintage=${encodeURIComponent(year)}`, '_blank');
  const handleSelectDrink = (entry) => navigate('/admin', { state: { drink: entry.drink, category: entry.category, tab: 'tastings' } });

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <span className="scope-note">(wine only)</span>
      </div>
      <h3 className="analytics-subsection-title">Best Vintages</h3>
      <StyleLeaderboardTable rows={rows} label="Vintage" onSelectStyle={onSelectVintage} />

      <h3 className="analytics-subsection-title">Age at Tasting vs Rating</h3>
      {scatterPoints.length === 0
        ? <p className="empty-state">No age data yet.</p>
        : <AbvRatingScatter points={scatterPoints} onPointClick={handleSelectDrink} xKey="age" xLabel="Age at tasting" xUnit=" yrs" />}
    </div>
  );
}
