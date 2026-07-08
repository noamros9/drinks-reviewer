import { useEffect, useMemo, useState } from 'react';
import CountryRankingTable from './CountryRankingTable';
import WorldMap from './WorldMap';
import RegionLeaderboard from './RegionLeaderboard';
import CategoryBarChart from '../../components/CategoryBarChart';
import ScopeTabs from '../../components/ScopeTabs';
import { useScopeCategory } from '../../hooks/useScopeCategory';
import { buildCountryRanking, buildOldNewWorldBreakdown, buildRegionLeaderboard } from '../../utils/analyticsHelpers';
import './RatingSection.css';
import './GeographicSection.css';

const REGION_CATEGORIES = new Set(['wine', 'whiskey']);

export default function GeographicSection({ drinks, globalCategory }) {
  const [category, setOverride] = useScopeCategory(globalCategory);
  const [regionCountry, setRegionCountry] = useState('all');
  const [regionCoordinates, setRegionCoordinates] = useState({});

  useEffect(() => {
    fetch('/api/region-coordinates')
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(setRegionCoordinates)
      .catch(() => {});
  }, []);

  useEffect(() => { setRegionCountry('all'); }, [category]);

  const scoped = useMemo(
    () => category === 'all' ? drinks : drinks.filter(d => d._category === category),
    [drinks, category]
  );
  const countryRanking = useMemo(() => buildCountryRanking(scoped), [scoped]);
  const total = countryRanking.reduce((s, r) => s + r.count, 0);

  const wineDrinks = useMemo(() => drinks.filter(d => d._category === 'wine'), [drinks]);
  const oldNewWorld = useMemo(() => buildOldNewWorldBreakdown(wineDrinks), [wineDrinks]);

  const regionSourceDrinks = useMemo(
    () => scoped.filter(d => REGION_CATEGORIES.has(d._category)),
    [scoped]
  );
  const regionCountries = useMemo(
    () => [...new Set(regionSourceDrinks.map(d => d.country).filter(Boolean))].sort(),
    [regionSourceDrinks]
  );
  const regionFilteredDrinks = useMemo(
    () => regionCountry === 'all' ? regionSourceDrinks : regionSourceDrinks.filter(d => d.country === regionCountry),
    [regionSourceDrinks, regionCountry]
  );
  const regionRows = useMemo(() => buildRegionLeaderboard(regionFilteredDrinks, 10), [regionFilteredDrinks]);
  const mapRegions = useMemo(() => buildRegionLeaderboard(regionSourceDrinks, Infinity), [regionSourceDrinks]);

  const handleSelectCountry = (country) => window.open(`/${category}?country=${encodeURIComponent(country)}`, '_blank');
  const handleSelectRegion = (r) => window.open(`/${r.category}?region=${encodeURIComponent(r.region)}`, '_blank');
  const handleOldNewWorldClick = () => {};

  return (
    <div className="analytics-section">
      <div className="analytics-section-header">
        <span className="count-badge">{total} {total === 1 ? 'drink' : 'drinks'} with country data</span>
        <ScopeTabs category={category} onChange={setOverride} testId="geo-category-filter" />
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
