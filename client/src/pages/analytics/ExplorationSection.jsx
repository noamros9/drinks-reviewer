import { useNavigate } from 'react-router-dom';
import BestOfLeaderboard from './BestOfLeaderboard';
import RevisitLeaderboard from './RevisitLeaderboard';
import StatTileRow from '../../components/StatTileRow';
import ScopeTabs from '../../components/ScopeTabs';
import { useScopeCategory } from '../../hooks/useScopeCategory';
import {
  buildBestOf, buildExplorerScore, buildNewCountriesThisYear, buildNewStylesThisYear, buildDrinksToRevisit,
} from '../../utils/analyticsHelpers';
import './RatingSection.css';
import './StyleSection.css';
import './ExplorationSection.css';

export default function ExplorationSection({ drinks, globalCategory }) {
  const [category, setOverride] = useScopeCategory(globalCategory);
  const navigate = useNavigate();

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const bestOf = buildBestOf(scoped, 10);
  const explorerScore = buildExplorerScore(scoped);
  const newCountries = buildNewCountriesThisYear(scoped);
  const newStyles = buildNewStylesThisYear(scoped);
  const toRevisit = buildDrinksToRevisit(scoped);

  const handleSelectDrink = (entry) => {
    navigate('/admin', { state: { drink: entry.drink, category: entry.category, tab: 'tastings' } });
  };

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <ScopeTabs category={category} onChange={setOverride} testId="exploration-category-filter" />
      </div>

      <h3 className="analytics-subsection-title">Explorer Score</h3>
      <StatTileRow tiles={[{ label: 'Countries explored', value: `${explorerScore.pct}%` }]} />
      {explorerScore.countries.length > 0 && (
        <ul className="style-undiscovered-list" data-testid="explorer-score-countries">
          {explorerScore.countries.map(c => (
            <li key={c}><span className="style-undiscovered-name">{c}</span></li>
          ))}
        </ul>
      )}

      <h3 className="analytics-subsection-title">Newly Unlocked This Year</h3>
      <div className="exploration-unlocked-columns">
        <div>
          <h4 className="style-undiscovered-title">Countries</h4>
          {newCountries.length === 0
            ? <p className="empty-state">None yet this year.</p>
            : (
              <ul className="style-undiscovered-list" data-testid="new-countries-list">
                {newCountries.map(r => (
                  <li key={r.country}>
                    <span className="style-undiscovered-name">{r.country}</span>
                    <span className="style-undiscovered-meta">{r.firstTasted}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
        <div>
          <h4 className="style-undiscovered-title">Styles / Varieties</h4>
          {newStyles.length === 0
            ? <p className="empty-state">None yet this year.</p>
            : (
              <ul className="style-undiscovered-list" data-testid="new-styles-list">
                {newStyles.map(r => (
                  <li key={`${r.category}-${r.style}`}>
                    <span className="style-undiscovered-name">{r.style} <span className="scope-note">({r.category})</span></span>
                    <span className="style-undiscovered-meta">{r.firstTasted}</span>
                  </li>
                ))}
              </ul>
            )}
        </div>
      </div>

      <h3 className="analytics-subsection-title">
        Drinks to Revisit <span className="scope-note">(avg &ge; 8, last tasted over a year ago)</span>
      </h3>
      <RevisitLeaderboard rows={toRevisit} onSelectDrink={handleSelectDrink} />

      <h3 className="analytics-subsection-title">Best Of (weighted rating)</h3>
      <BestOfLeaderboard rows={bestOf} onSelectDrink={handleSelectDrink} />
    </div>
  );
}
