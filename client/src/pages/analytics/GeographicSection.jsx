import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CountryRankingTable from './CountryRankingTable';
import WorldMap from './WorldMap';
import RegionLeaderboard from './RegionLeaderboard';
import CategoryBarChart from '../../components/CategoryBarChart';
import { buildCountryRanking, buildOldNewWorldBreakdown, buildRegionLeaderboard } from '../../utils/analyticsHelpers';
import './RatingSection.css';
import './GeographicSection.css';

const CATEGORY_FILTERS = ['all', 'wine', 'beer', 'whiskey', 'others'];
const REGION_CATEGORIES = new Set(['wine', 'whiskey']);

export default function GeographicSection({ drinks, globalCategory }) {
  const [override, setOverride] = useState(null);
  const [regionCountry, setRegionCountry] = useState('all');
  const [regionCoordinates, setRegionCoordinates] = useState({});
  const navigate = useNavigate();
  const category = override ?? globalCategory;

  useEffect(() => {
    fetch('/api/region-coordinates')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(setRegionCoordinates)
      .catch(() => {});
  }, []);

  const scoped = category === 'all' ? drinks : drinks.filter(d => d._category === category);
  const countryRanking = buildCountryRanking(scoped);
  const total = countryRanking.reduce((s, r) => s + r.count, 0);

  const wineDrinks = drinks.filter(d => d._category === 'wine');
  const oldNewWorld = buildOldNewWorldBreakdown(wineDrinks);

  const regionSourceDrinks = scoped.filter(d => REGION_CATEGORIES.has(d._category));
  const regionCountries = [...new Set(regionSourceDrinks.map(d => d.country).filter(Boolean))].sort();
  const regionFilteredDrinks = regionCountry === 'all' ? regionSourceDrinks : regionSourceDrinks.filter(d => d.country === regionCountry);
  const regionRows = buildRegionLeaderboard(regionFilteredDrinks, 10);
  const mapRegions = buildRegionLeaderboard(regionSourceDrinks, Infinity);

  const handleSelectCountry = (country) => navigate(`/${category}?country=${encodeURIComponent(country)}`);
  const handleSelectRegion = (r) => navigate(`/${r.category}?region=${encodeURIComponent(r.region)}`);
  const handleOldNewWorldClick = () => {};

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <span className="count-badge">{total} {total === 1 ? 'drink' : 'drinks'} with country data</span>
        <div className="category-tabs" data-testid="geo-category-filter">
          <span className="scope-label">Scope</span>
          {CATEGORY_FILTERS.map(c => (
            <button key={c} className={category === c ? 'active' : ''} onClick={() => setOverride(c)}>
              {c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
      </div>
      {total === 0
        ? <p className="empty-state">No country data yet.</p>
        : (
          <>
            <CountryRankingTable rows={countryRanking} onSelectCountry={handleSelectCountry} />

            <h3 className="analytics-subsection-title">World Map</h3>
            <WorldMap
              countryStats={countryRanking}
              regions={mapRegions}
              regionCoordinates={regionCoordinates}
              onSelectCountry={handleSelectCountry}
              onSelectRegion={handleSelectRegion}
            />

            <h3 className="analytics-subsection-title">
              Old World vs New World <span className="scope-note">(wine only, always all categories)</span>
            </h3>
            <CategoryBarChart
              data={oldNewWorld.map(b => ({ category: b.label, avgRating: b.avgRating, count: b.count }))}
              onBarClick={handleOldNewWorldClick}
              dataKey="avgRating" domain={[0, 10]} emptyLabel="no rated drinks"
              describeBar={(label, value) => `${label}: average rating ${value}`}
              describeTooltip={(label, value, count) => <><strong>{value}</strong> avg — {label} ({count} rated)</>}
            />

            <h3 className="analytics-subsection-title">Regions</h3>
            {regionSourceDrinks.length === 0
              ? <p className="empty-state">No region data for this scope.</p>
              : (
                <>
                  <div className="category-tabs" data-testid="geo-region-country-filter">
                    <span className="scope-label">Country</span>
                    <button className={regionCountry === 'all' ? 'active' : ''} onClick={() => setRegionCountry('all')}>All</button>
                    {regionCountries.map(c => (
                      <button key={c} className={regionCountry === c ? 'active' : ''} onClick={() => setRegionCountry(c)}>
                        {c}
                      </button>
                    ))}
                  </div>
                  <RegionLeaderboard rows={regionRows} />
                </>
              )}
          </>
        )}
    </div>
  );
}
