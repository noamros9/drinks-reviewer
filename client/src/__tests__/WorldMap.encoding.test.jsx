import { render, screen, fireEvent, act } from '@testing-library/react';
import WorldMap, { countLevels, ratingLevel, mainlandCentroid, buildRegionTree, dotRadius, segmentDashArray, EXPAND_ZOOM } from '../pages/analytics/WorldMap';

const WORLD_GEO = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Italy' }, geometry: { type: 'Polygon', coordinates: [[[12, 42], [13, 42], [13, 43], [12, 43], [12, 42]]] } },
  ],
};
const UK_GEO = { type: 'FeatureCollection', features: [] };

// Toscana's own 2 drinks plus two subregions, all within a few degrees.
const TOSCANA = [
  { category: 'wine', country: 'Italy', region: 'Toscana', avgRating: 8, count: 2 },
  { category: 'wine', country: 'Italy', region: 'Toscana / Chianti', avgRating: 7, count: 1 },
  { category: 'wine', country: 'Italy', region: 'Toscana / Chianti Classico', avgRating: 9, count: 1 },
];
const TOSCANA_COORDS = {
  'Italy||Toscana': { lat: 43.4, lon: 11.1 },
  'Italy||Toscana / Chianti': { lat: 43.6, lon: 11.3 },
  'Italy||Toscana / Chianti Classico': { lat: 43.5, lon: 11.2 },
};

function renderMap(props = {}) {
  return render(
    <WorldMap
      countryStats={[{ country: 'Italy', avgRating: 7.5, count: 4 }]}
      regions={TOSCANA}
      regionCoordinates={TOSCANA_COORDS}
      onSelectCountry={() => {}}
      onSelectRegion={() => {}}
      worldGeo={WORLD_GEO}
      ukGeo={UK_GEO}
      {...props}
    />
  );
}

// ── Country fill: quantile bins over distinct counts ──────────────

test('a lopsided count distribution still spreads across all five levels', () => {
  // The real shape of the data: one country at 87, most at 1-3.
  const counts = [87, 16, 15, 11, 6, 5, 5, 4, 3, 3, 2, 2, 1, 1, 1, 1, 1, 1];
  const level = countLevels(counts);
  const used = new Set(counts.map(level));
  expect(used.size).toBe(5);
  expect(level(1)).toBe(0);
  expect(level(87)).toBe(4);
});

test('a country with no drinks is below level 0', () => {
  expect(countLevels([1, 2, 3])(0)).toBe(-1);
  expect(countLevels([])(5)).toBe(-1);
});

test('level rises monotonically with count', () => {
  const level = countLevels([1, 2, 5, 10, 40, 80]);
  const levels = [1, 2, 5, 10, 40, 80].map(level);
  expect(levels).toEqual([...levels].sort((a, b) => a - b));
});

test('the country fill class reflects its level', () => {
  renderMap();
  expect(screen.getByTestId('country-Italy')).toHaveClass('world-map-count-l4');
});

test('rating levels only exist for real ratings', () => {
  expect(ratingLevel(undefined)).toBe(-1);
  expect(ratingLevel(0)).toBe(-1);
  expect(ratingLevel(2)).toBe(1);
  expect(ratingLevel(10)).toBe(4);
});

// ── Centroid: the France-in-the-Bay-of-Biscay regression ──────────

test('the centroid follows the largest landmass, ignoring far-flung territories', () => {
  // A France-shaped feature: a big mainland ring plus a tiny remote one (French Guiana).
  const mainland = [[[-2, 43], [-2, 50], [6, 50], [6, 43], [-2, 43]]];
  const overseas = [[[-54, 3], [-54, 4], [-53, 4], [-53, 3], [-54, 3]]];
  const geo = { type: 'Feature', geometry: { type: 'MultiPolygon', coordinates: [mainland, overseas] } };
  const [lon, lat] = mainlandCentroid(geo);
  expect(lon).toBeGreaterThan(-3);
  expect(lat).toBeGreaterThan(40);
});

test('a single-polygon country keeps its plain centroid', () => {
  const geo = { type: 'Feature', geometry: { type: 'Polygon', coordinates: [[[12, 42], [12, 43], [13, 43], [13, 42], [12, 42]]] } };
  const [lon, lat] = mainlandCentroid(geo);
  expect(lon).toBeCloseTo(12.5, 1);
  expect(lat).toBeCloseTo(42.5, 1);
});

// ── Region dot sizing ─────────────────────────────────────────────

test('dot radius grows with count but sub-linearly', () => {
  const small = dotRadius(1, 16);
  const big = dotRadius(16, 16);
  expect(big).toBeGreaterThan(small);
  // 16x the drinks must not mean 16x the radius.
  expect(big / small).toBeLessThan(4);
});

test('a lone region falls back to the minimum radius', () => {
  expect(dotRadius(1, 1)).toBe(dotRadius(0, 0));
});

test('dot radius counter-scales so it stays the same size on screen', () => {
  const solo = { regions: [{ category: 'wine', country: 'Italy', region: 'Sicilia', avgRating: 7, count: 1 }],
    regionCoordinates: { 'Italy||Sicilia': { lat: 37.5, lon: 14.1 } } };
  const r = (zoom) => Number(renderMap({ ...solo, initialZoom: zoom })
    .container.querySelector('[data-testid="region-marker-Sicilia"]').getAttribute('r'));
  expect(r(1) / r(4)).toBeCloseTo(4, 5);
});

// ── Subregion rollup and zoom expansion ───────────────────────────

test('a parent rolls up its own drinks plus every descendant', () => {
  const [toscana] = buildRegionTree(TOSCANA, TOSCANA_COORDS);
  expect(toscana.region).toBe('Toscana');
  expect(toscana.count).toBe(4);
  expect(toscana.ownCount).toBe(2);
  expect(toscana.children).toHaveLength(2);
});

test('a parent no drink names directly is positioned from its children', () => {
  // Puglia: subregions only, no bare-Puglia drinks and so no coordinate of its own.
  const [puglia] = buildRegionTree(
    [{ category: 'wine', country: 'Italy', region: 'Puglia / Salento', avgRating: 8, count: 3 }],
    { 'Italy||Puglia / Salento': { lat: 40.2, lon: 18.0 } }
  );
  expect(puglia.region).toBe('Puglia');
  expect(puglia.coords).toEqual({ lat: 40.2, lon: 18.0 });
  expect(puglia.ownCount).toBe(0);
});

test('the same region in two categories merges into one node', () => {
  const rows = [
    { category: 'wine', country: 'Scotland', region: 'Speyside', avgRating: 8, count: 1 },
    { category: 'whiskey', country: 'Scotland', region: 'Speyside', avgRating: 6, count: 3 },
  ];
  const nodes = buildRegionTree(rows, { 'Scotland||Speyside': { lat: 57.1, lon: -3.8 } });
  expect(nodes).toHaveLength(1);
  expect(nodes[0].count).toBe(4);
  expect(nodes[0].avgRating).toBeCloseTo(6.5, 5);
});

test('a region with no cached coordinate is dropped', () => {
  expect(buildRegionTree(TOSCANA, {})).toHaveLength(0);
});

test('zoomed out, a parent shows a halo and its children are hidden', () => {
  renderMap();
  expect(screen.getByTestId('region-halo-Toscana')).toBeInTheDocument();
  expect(screen.getByTestId('region-marker-Toscana')).toBeInTheDocument();
  expect(screen.queryByTestId('region-marker-Chianti')).not.toBeInTheDocument();
});

test('zoomed in past the threshold, the parent splits into its subregions', () => {
  renderMap({ initialZoom: EXPAND_ZOOM });
  expect(screen.getByTestId('region-marker-Chianti')).toBeInTheDocument();
  expect(screen.getByTestId('region-marker-Chianti Classico')).toBeInTheDocument();
  expect(screen.queryByTestId('region-halo-Toscana')).not.toBeInTheDocument();
});

test('the ring is split into one arc per subregion', () => {
  // Two subregions -> two dashes, each just under half the circumference.
  const [dash, gap] = segmentDashArray(10, 2).split(' ').map(Number);
  expect(dash + gap).toBeCloseTo(Math.PI * 10, 5); // half the circumference
  expect(dash).toBeGreaterThan(gap);
  // More subregions -> shorter arcs.
  const [dash3] = segmentDashArray(10, 3).split(' ').map(Number);
  expect(dash3).toBeLessThan(dash);
});

test('a single subregion draws an unbroken ring, not one dash', () => {
  expect(segmentDashArray(10, 1)).toBeUndefined();
});

test('the ring on a two-subregion parent is actually dashed in the DOM', () => {
  renderMap();
  expect(screen.getByTestId('region-halo-Toscana')).toHaveAttribute('stroke-dasharray');
});

test('a region with no subregions never gets a halo', () => {
  renderMap({
    regions: [{ category: 'wine', country: 'Italy', region: 'Sicilia', avgRating: 7, count: 1 }],
    regionCoordinates: { 'Italy||Sicilia': { lat: 37.5, lon: 14.1 } },
  });
  expect(screen.getByTestId('region-marker-Sicilia')).toBeInTheDocument();
  expect(screen.queryByTestId('region-halo-Sicilia')).not.toBeInTheDocument();
});

test('a collapsed parent advertises the rolled-up total', () => {
  renderMap();
  expect(screen.getByTestId('region-marker-Toscana')).toHaveAttribute('aria-label', 'Toscana, Italy: 4 drinks');
});

test('an expanded parent drops to its own drinks only', () => {
  renderMap({ initialZoom: EXPAND_ZOOM });
  expect(screen.getByTestId('region-marker-Toscana')).toHaveAttribute('aria-label', 'Toscana, Italy: 2 drinks');
});

test('a parent with no drinks of its own disappears once expanded', () => {
  const regions = [{ category: 'wine', country: 'Italy', region: 'Puglia / Salento', avgRating: 8, count: 3 }];
  const coords = { 'Italy||Puglia / Salento': { lat: 40.2, lon: 18.0 } };
  renderMap({ regions, regionCoordinates: coords, initialZoom: EXPAND_ZOOM });
  expect(screen.getByTestId('region-marker-Salento')).toBeInTheDocument();
  expect(screen.queryByTestId('region-marker-Puglia')).not.toBeInTheDocument();
});

// ── Legend ────────────────────────────────────────────────────────

test('the legend explains both channels', () => {
  renderMap();
  expect(screen.getByText('Rated drinks')).toBeInTheDocument();
  expect(screen.getByText('Avg rating')).toBeInTheDocument();
});

// ── Tooltip: avg, subregion rows, and staying open ────────────────

test('a region tooltip shows its average, the way a country tooltip does', () => {
  renderMap();
  fireEvent.mouseEnter(screen.getByTestId('region-marker-Toscana'));
  // 2 drinks @ 8, 1 @ 7, 1 @ 9 -> 8.0
  expect(screen.getByText('avg 8.0')).toBeInTheDocument();
});

test('a collapsed parent lists its subregions, with the parent\'s own drinks last', () => {
  renderMap();
  fireEvent.mouseEnter(screen.getByTestId('region-marker-Toscana'));
  const rows = screen.getAllByRole('button', { name: /Chianti|Toscana itself/ });
  expect(rows.map(r => r.textContent)).toEqual([
    'Chianti7.01', 'Chianti Classico9.01', 'Toscana itself8.02',
  ]);
});

test('clicking a subregion row opens that subregion', () => {
  const onSelectRegion = vi.fn();
  renderMap({ onSelectRegion });
  fireEvent.mouseEnter(screen.getByTestId('region-marker-Toscana'));
  fireEvent.click(screen.getByTestId('tooltip-row-Chianti'));
  expect(onSelectRegion).toHaveBeenCalledWith(expect.objectContaining({ region: 'Toscana / Chianti' }));
});

test('a region with no subregions gets a plain tooltip with no rows', () => {
  renderMap({
    regions: [{ category: 'wine', country: 'Italy', region: 'Sicilia', avgRating: 7, count: 1 }],
    regionCoordinates: { 'Italy||Sicilia': { lat: 37.5, lon: 14.1 } },
  });
  fireEvent.mouseEnter(screen.getByTestId('region-marker-Sicilia'));
  expect(screen.getByText('avg 7.0')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /itself/ })).not.toBeInTheDocument();
});

test('a tooltip with rows survives the trip from the dot to the tooltip', async () => {
  vi.useFakeTimers();
  try {
    renderMap();
    const dot = screen.getByTestId('region-marker-Toscana');
    fireEvent.mouseEnter(dot);
    fireEvent.mouseLeave(dot);
    // Still there mid-flight, so the pointer can reach it.
    act(() => vi.advanceTimersByTime(100));
    expect(screen.getByTestId('tooltip-row-Chianti')).toBeInTheDocument();
    // Reaching it cancels the dismissal.
    fireEvent.mouseEnter(screen.getByTestId('tooltip-row-Chianti').closest('.world-map-tooltip'));
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.getByTestId('tooltip-row-Chianti')).toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('a tooltip with rows closes once the pointer leaves without reaching it', () => {
  vi.useFakeTimers();
  try {
    renderMap();
    const dot = screen.getByTestId('region-marker-Toscana');
    fireEvent.mouseEnter(dot);
    fireEvent.mouseLeave(dot);
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByTestId('tooltip-row-Chianti')).not.toBeInTheDocument();
  } finally {
    vi.useRealTimers();
  }
});

test('an interactive tooltip stops chasing the cursor so it can be reached', () => {
  renderMap();
  const dot = screen.getByTestId('region-marker-Toscana');
  fireEvent.mouseEnter(dot, { clientX: 10, clientY: 10 });
  const before = screen.getByTestId('tooltip-row-Chianti').closest('.world-map-tooltip').style.left;
  fireEvent.mouseMove(dot, { clientX: 200, clientY: 200 });
  expect(screen.getByTestId('tooltip-row-Chianti').closest('.world-map-tooltip').style.left).toBe(before);
});

// react-simple-maps defaults every Geography to tabIndex="0", which put all 241 country
// paths in the tab order and gave each the browser's black focus ring on click.
test('only countries you can actually open are in the tab order', () => {
  renderMap({ countryStats: [] });
  expect(screen.getByTestId('country-Italy')).toHaveAttribute('tabindex', '-1');
});

test('a country with drinks stays keyboard reachable', () => {
  renderMap();
  expect(screen.getByTestId('country-Italy')).toHaveAttribute('tabindex', '0');
});
