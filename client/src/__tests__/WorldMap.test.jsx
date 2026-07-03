import { render, screen, fireEvent } from '@testing-library/react';
import WorldMap, { canonicalName } from '../pages/analytics/WorldMap';

const WORLD_GEO = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { name: 'Italy' }, geometry: { type: 'Polygon', coordinates: [[[12, 42], [13, 42], [13, 43], [12, 43], [12, 42]]] } },
    { type: 'Feature', properties: { name: 'United Kingdom' }, geometry: { type: 'Polygon', coordinates: [[[-2, 54], [-1, 54], [-1, 55], [-2, 55], [-2, 54]]] } },
  ],
};

const UK_GEO = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { geonunit: 'Scotland' }, geometry: { type: 'Polygon', coordinates: [[[-4, 57], [-3, 57], [-3, 58], [-4, 58], [-4, 57]]] } },
  ],
};

const COUNTRY_STATS = [
  { country: 'Italy', avgRating: 7.5, count: 76 },
  { country: 'Scotland', avgRating: 8.9, count: 15 },
];

const REGIONS = [
  { country: 'Italy', region: 'Chianti', avgRating: 8, count: 1 },
  { country: 'Israel', region: 'Galilee', avgRating: 8.2, count: 16 }, // no coordinate cached -> no marker
];

const REGION_COORDINATES = {
  'Italy||Chianti': { lat: 43.4, lon: 11.3 },
};

function renderMap(props = {}) {
  return render(
    <WorldMap
      countryStats={COUNTRY_STATS}
      regions={REGIONS}
      regionCoordinates={REGION_COORDINATES}
      onSelectCountry={() => {}}
      onSelectRegion={() => {}}
      worldGeo={WORLD_GEO}
      ukGeo={UK_GEO}
      {...props}
    />
  );
}

describe('canonicalName', () => {
  test.each([
    ['USA', 'United States of America'],
    ['United States', 'United States of America'],
    ['Czech Republic', 'Czechia'],
    ['Italy', 'Italy'],
  ])('%s -> %s', (input, expected) => {
    expect(canonicalName(input)).toBe(expected);
  });
});

test('renders a Geography per country feature, skipping the superseded "United Kingdom" world feature', () => {
  renderMap();
  expect(screen.getByTestId('country-Italy')).toBeInTheDocument();
  expect(screen.queryByTestId('country-United Kingdom')).not.toBeInTheDocument();
  expect(screen.getByTestId('country-Scotland')).toBeInTheDocument();
});

test('only renders a marker for a region that has a cached coordinate', () => {
  renderMap();
  expect(screen.getByTestId('region-marker-Chianti')).toBeInTheDocument();
  expect(screen.queryByTestId('region-marker-Galilee')).not.toBeInTheDocument();
});

test('clicking a region marker fires onSelectRegion with that region', () => {
  const onSelectRegion = vi.fn();
  renderMap({ onSelectRegion });
  fireEvent.click(screen.getByTestId('region-marker-Chianti'));
  expect(onSelectRegion).toHaveBeenCalledWith(expect.objectContaining({ country: 'Italy', region: 'Chianti' }));
});

test('a region marker is keyboard-activatable', () => {
  const onSelectRegion = vi.fn();
  renderMap({ onSelectRegion });
  fireEvent.keyDown(screen.getByTestId('region-marker-Chianti'), { key: 'Enter' });
  expect(onSelectRegion).toHaveBeenCalled();
});

test('hovering a country shows a tooltip with its name and a grey drink-count badge', () => {
  renderMap();
  fireEvent.mouseEnter(screen.getByTestId('country-Italy'));
  expect(screen.getByText('Italy')).toBeInTheDocument();
  expect(screen.getByText('76')).toHaveClass('count-badge');
  fireEvent.mouseLeave(screen.getByTestId('country-Italy'));
  expect(screen.queryByText('Italy')).not.toBeInTheDocument();
});

test('a country with no matching stat shows a tooltip with a 0 count', () => {
  renderMap({ countryStats: [] });
  fireEvent.mouseEnter(screen.getByTestId('country-Italy'));
  expect(screen.getByText('Italy')).toBeInTheDocument();
  expect(screen.getByText('0')).toHaveClass('count-badge');
});

test('hovering a UK constituent-country overlay feature shows its own name and count', () => {
  renderMap();
  fireEvent.mouseEnter(screen.getByTestId('country-Scotland'));
  expect(screen.getByText('Scotland')).toBeInTheDocument();
  expect(screen.getByText('15')).toHaveClass('count-badge');
});

test('a UK constituent country with no matching stat shows a 0 count', () => {
  renderMap({ countryStats: [] });
  fireEvent.mouseEnter(screen.getByTestId('country-Scotland'));
  expect(screen.getByText('0')).toHaveClass('count-badge');
});

test('moving the mouse over a country updates the tooltip position', () => {
  renderMap();
  fireEvent.mouseEnter(screen.getByTestId('country-Italy'), { clientX: 10, clientY: 10 });
  fireEvent.mouseMove(screen.getByTestId('country-Italy'), { clientX: 50, clientY: 60 });
  const tooltip = screen.getByText('Italy').closest('.world-map-tooltip');
  expect(tooltip).toHaveStyle({ left: '62px', top: '72px' });
});

test('hovering a region marker shows its name and count', () => {
  renderMap();
  fireEvent.mouseEnter(screen.getByTestId('region-marker-Chianti'));
  expect(screen.getByText('Chianti, Italy')).toBeInTheDocument();
  expect(screen.getByText('1')).toHaveClass('count-badge');
});

test('clicking a country with stat data fires onSelectCountry with its original country name', () => {
  const onSelectCountry = vi.fn();
  renderMap({ onSelectCountry });
  fireEvent.click(screen.getByTestId('country-Italy'));
  expect(onSelectCountry).toHaveBeenCalledWith('Italy');
});

test('a country with no stat data is not clickable', () => {
  const onSelectCountry = vi.fn();
  renderMap({ onSelectCountry, countryStats: [] });
  fireEvent.click(screen.getByTestId('country-Italy'));
  expect(onSelectCountry).not.toHaveBeenCalled();
  expect(screen.getByTestId('country-Italy')).not.toHaveClass('world-map-country-clickable');
});

test('a UK constituent country with stat data fires onSelectCountry with its own name', () => {
  const onSelectCountry = vi.fn();
  renderMap({ onSelectCountry });
  fireEvent.click(screen.getByTestId('country-Scotland'));
  expect(onSelectCountry).toHaveBeenCalledWith('Scotland');
});

test('a country with stat data is keyboard-activatable', () => {
  const onSelectCountry = vi.fn();
  renderMap({ onSelectCountry });
  fireEvent.keyDown(screen.getByTestId('country-Italy'), { key: 'Enter' });
  expect(onSelectCountry).toHaveBeenCalledWith('Italy');
});
