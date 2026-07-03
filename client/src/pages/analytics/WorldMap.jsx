import { useMemo, useRef, useState } from 'react';
import { ComposableMap, ZoomableGroup, Geographies, Geography, Marker, useZoomPanContext } from 'react-simple-maps';
import worldCountries110m from 'world-atlas/countries-110m.json';
import ukConstituentCountries from '../../data/geo/uk-constituent-countries.json';
import './GeographicSection.css';

// Sequential blue ramp (steps 100/300/500/600/700), light -> dark, for magnitude encoding.
const RATING_SCALE = ['#cde2fb', '#6da7ec', '#256abf', '#184f95', '#0d366b'];
const NO_DATA_FILL = 'var(--border)';

const COUNTRY_NAME_ALIASES = {
  USA: 'United States of America',
  'United States': 'United States of America',
  'Czech Republic': 'Czechia',
};

// ponytail: covers only the mismatches seen in today's data; extend if a new
// country name doesn't match world-atlas's `properties.name`.
export function canonicalName(name) {
  return COUNTRY_NAME_ALIASES[name] ?? name;
}

function colorForRating(avgRating) {
  if (typeof avgRating !== 'number' || avgRating <= 0) return NO_DATA_FILL;
  const idx = Math.min(RATING_SCALE.length - 1, Math.floor((avgRating / 10) * RATING_SCALE.length));
  return RATING_SCALE[idx];
}

// Counter-scales against the ZoomableGroup's current zoom (`k`) so the marker
// stays a constant on-screen size instead of growing/shrinking with the map.
function RegionMarkerDot(props) {
  const { k } = useZoomPanContext();
  return <circle r={4 / k} strokeWidth={1 / k} {...props} />;
}

export default function WorldMap({ countryStats, regions, regionCoordinates, onSelectCountry, onSelectRegion, worldGeo = worldCountries110m, ukGeo = ukConstituentCountries }) {
  const wrapperRef = useRef(null);
  const [tooltip, setTooltip] = useState(null); // { x, y, name, count }

  const statsByCountry = useMemo(
    () => new Map(countryStats.map(r => [canonicalName(r.country), r])),
    [countryStats]
  );

  const markers = useMemo(() => regions
    .map(r => ({ ...r, coords: regionCoordinates[`${r.country}||${r.region}`] }))
    .filter(r => r.coords), [regions, regionCoordinates]);

  const positionTooltip = (e) => {
    const box = wrapperRef.current.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const showTooltip = (e, name, count) => setTooltip({ ...positionTooltip(e), name, count });
  const moveTooltip = (e) => setTooltip(t => t && { ...t, ...positionTooltip(e) });
  const hideTooltip = () => setTooltip(null);

  const clickableProps = (name, count, onSelect) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': `${name}: ${count} drinks`,
    onClick: onSelect,
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } },
  });

  return (
    <div className="world-map-wrapper" ref={wrapperRef}>
      <ComposableMap projection="geoMercator" projectionConfig={{ scale: 110 }}>
        <ZoomableGroup minZoom={1} maxZoom={8}>
          <Geographies geography={worldGeo}>
            {({ geographies }) => geographies
              .filter(geo => geo.properties.name !== 'United Kingdom')
              .map(geo => {
                const stat = statsByCountry.get(canonicalName(geo.properties.name));
                return (
                  <Geography
                    key={geo.rsmKey}
                    data-testid={`country-${geo.properties.name}`}
                    geography={geo}
                    fill={colorForRating(stat?.avgRating)}
                    stroke="var(--bg-elevated)"
                    strokeWidth={0.5}
                    className={stat ? 'world-map-country-clickable' : ''}
                    {...(stat ? clickableProps(geo.properties.name, stat.count, () => onSelectCountry(stat.country)) : {})}
                    onMouseEnter={e => showTooltip(e, geo.properties.name, stat?.count ?? 0)}
                    onMouseMove={moveTooltip}
                    onMouseLeave={hideTooltip}
                  />
                );
              })}
          </Geographies>
          <Geographies geography={ukGeo}>
            {({ geographies }) => geographies.map(geo => {
              const stat = statsByCountry.get(geo.properties.geonunit);
              return (
                <Geography
                  key={geo.rsmKey}
                  data-testid={`country-${geo.properties.geonunit}`}
                  geography={geo}
                  fill={colorForRating(stat?.avgRating)}
                  stroke="var(--bg-elevated)"
                  strokeWidth={0.5}
                  className={stat ? 'world-map-country-clickable' : ''}
                  {...(stat ? clickableProps(geo.properties.geonunit, stat.count, () => onSelectCountry(stat.country)) : {})}
                  onMouseEnter={e => showTooltip(e, geo.properties.geonunit, stat?.count ?? 0)}
                  onMouseMove={moveTooltip}
                  onMouseLeave={hideTooltip}
                />
              );
            })}
          </Geographies>
          {markers.map(m => (
            <Marker key={`${m.country}||${m.region}`} coordinates={[m.coords.lon, m.coords.lat]}>
              <RegionMarkerDot
                className="world-map-region-marker"
                data-testid={`region-marker-${m.region}`}
                {...clickableProps(`${m.region}, ${m.country}`, m.count, () => onSelectRegion(m))}
                onMouseEnter={e => showTooltip(e, `${m.region}, ${m.country}`, m.count)}
                onMouseMove={moveTooltip}
                onMouseLeave={hideTooltip}
              />
            </Marker>
          ))}
        </ZoomableGroup>
      </ComposableMap>
      {tooltip && (
        <div className="world-map-tooltip" style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}>
          <span>{tooltip.name}</span>
          <span className="count-badge">{tooltip.count}</span>
        </div>
      )}
    </div>
  );
}
