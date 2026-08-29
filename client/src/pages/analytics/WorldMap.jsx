import { useMemo, useRef, useState } from 'react';
import { ComposableMap, ZoomableGroup, Geographies, Geography, Marker, useZoomPanContext } from 'react-simple-maps';
import { geoCentroid } from 'd3-geo';
// 50m rather than 110m: at the new 40x ceiling the 110m outlines turn blocky.
import worldCountries50m from 'world-atlas/countries-50m.json';
// Built by dissolving Natural Earth's UK subdivisions into one feature via
// `npx mapshaper -dissolve`, which produced invalid ring winding for this shape.
// Fixed by running the dissolve through topojson-server instead. If this ever
// needs regenerating, validate the output with d3-geo's geoPath().bounds() on
// the projected feature before committing it.
import ukConstituentCountries from '../../data/geo/uk-constituent-countries.json';
import { REGION_SEP, regionLeaf } from '../../utils/filterHelpers';
import './GeographicSection.css';

// Two variables share the map: how much you've drunk from a country (the fill) and how
// you rated it (a pip at the country's centre). Both are 5-level CSS classes rather than
// inline colours so each ramp can invert for dark mode — on a near-black background "more"
// has to read as brighter, not darker.
export const LEVELS = 5;

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

// Absolute 0-10 bins wasted the map: real country averages span roughly 4-8, so 14 of 22
// countries landed in one shade. Quantiles over the *distinct* counts present keep the ramp
// spread no matter how lopsided the collection gets (Israel has 87, half the rest have 1-3).
// Ties are why distinct values matter — quantiling the raw list puts six 1-drink countries
// across two levels and strands the bottom one empty.
export function countLevels(counts) {
  const distinct = [...new Set(counts.filter(n => n > 0))].sort((a, b) => a - b);
  if (!distinct.length) return () => -1;
  const edges = Array.from({ length: LEVELS - 1 }, (_, i) =>
    distinct[Math.floor((distinct.length * (i + 1)) / LEVELS)]);
  return (count) => {
    if (!(count > 0)) return -1;
    let level = 0;
    while (level < edges.length && edges[level] !== undefined && count >= edges[level]) level++;
    return level;
  };
}

export function ratingLevel(avgRating) {
  if (typeof avgRating !== 'number' || avgRating <= 0) return -1;
  return Math.min(LEVELS - 1, Math.floor((avgRating / 10) * LEVELS));
}

// Shoelace over lon/lat. Only used to rank a feature's pieces against each other, so it
// doesn't need to be a real spherical area.
const ringArea = ring => Math.abs(ring.reduce((sum, [x, y], i) => {
  const [x2, y2] = ring[(i + 1) % ring.length];
  return sum + (x * y2 - x2 * y);
}, 0)) / 2;

// world-atlas folds overseas territories into the parent feature, so a plain geoCentroid
// averages them in and puts France's pip at 6.8W 43.1N — the Bay of Biscay. Norway's lands
// in Sweden. Take the centroid of the largest landmass instead.
export function mainlandCentroid(geo) {
  const geometry = geo.geometry;
  if (geometry?.type !== 'MultiPolygon' || geometry.coordinates.length < 2) return geoCentroid(geo);
  const biggest = geometry.coordinates.reduce((a, b) => (ringArea(b[0]) > ringArea(a[0]) ? b : a));
  return geoCentroid({ type: 'Feature', geometry: { type: 'Polygon', coordinates: biggest } });
}

const meanCoords = (list) => (list.length
  ? { lat: list.reduce((s, c) => s + c.lat, 0) / list.length, lon: list.reduce((s, c) => s + c.lon, 0) / list.length }
  : null);

// Groups "Toscana", "Toscana / Chianti" and "Toscana / Chianti Classico" — three dots ~30km
// apart, indistinguishable zoomed out — under one parent that carries their combined count.
//
// Rows arrive per category (buildRegionLeaderboard keys on category||country||region) but
// coordinates and marker keys don't include the category, so two categories sharing a region
// would render overlapping markers under a duplicate React key. Merging on country||region
// first removes that.
export function buildRegionTree(regions, regionCoordinates) {
  const merged = new Map();
  for (const r of regions) {
    const key = `${r.country}||${r.region}`;
    const prev = merged.get(key);
    if (!prev) { merged.set(key, { ...r }); continue; }
    const total = prev.count + r.count;
    prev.avgRating = (prev.avgRating * prev.count + r.avgRating * r.count) / total;
    prev.count = total;
  }

  const parents = new Map();
  for (const r of merged.values()) {
    const top = r.region.split(REGION_SEP)[0];
    const key = `${r.country}||${top}`;
    if (!parents.has(key)) {
      parents.set(key, { category: r.category, country: r.country, region: top, count: 0, own: null, children: [] });
    }
    const node = parents.get(key);
    node.count += r.count;
    if (r.region === top) node.own = r;
    else node.children.push({ ...r, coords: regionCoordinates[`${r.country}||${r.region}`] });
  }

  const nodes = [];
  for (const node of parents.values()) {
    const children = node.children.filter(c => c.coords).sort((a, b) => b.count - a.count);
    const coords = regionCoordinates[`${node.country}||${node.region}`] ?? meanCoords(children.map(c => c.coords));
    if (!coords) continue;
    const rated = [node.own, ...node.children].filter(r => r && typeof r.avgRating === 'number');
    const weight = rated.reduce((s, r) => s + r.count, 0);
    nodes.push({
      ...node,
      children,
      coords,
      ownCount: node.own?.count ?? 0,
      avgRating: weight ? rated.reduce((s, r) => s + r.avgRating * r.count, 0) / weight : undefined,
    });
  }
  return nodes;
}

// Area, not radius, should track count — a 15-drink region at 15x the radius would swallow
// the country it sits in. The ceiling is low on purpose: at world zoom Israel is about two
// pixels wide, so anything bigger than this stops looking like a marker on a country and
// starts looking like a marker in the sea next to it.
const RADIUS_MIN = 1.8;
const RADIUS_MAX = 5;
export function dotRadius(count, maxCount) {
  if (!(maxCount > 1) || !(count > 0)) return RADIUS_MIN;
  const t = Math.sqrt(count) / Math.sqrt(maxCount);
  return RADIUS_MIN + t * (RADIUS_MAX - RADIUS_MIN);
}

// Below this the map shows one dot per top-level region; at or above it, parents split into
// their subregions. Tuned by eye against Italy and Israel, the two crowded cases.
export const EXPAND_ZOOM = 3;

// 8x left Chianti and Chianti Classico about six pixels apart. At 40x they're ~30px.
export const MAX_ZOOM = 40;

// Long enough to move the pointer from a dot onto its tooltip without it vanishing.
const TOOLTIP_LEAVE_MS = 260;

// Every mark counter-scales against the ZoomableGroup's zoom (`k`) so it keeps a constant
// on-screen size instead of growing with the map.
function ScaledCircle({ r, strokeWidth = 1, ...props }) {
  const { k } = useZoomPanContext();
  return <circle r={r / k} strokeWidth={strokeWidth / k} {...props} />;
}

// The "expandable" affordance. A plain ring at world zoom just reads as a fuzzy edge on the
// dot, so the ring is broken into one arc per subregion — it says "two things are folded in
// here", not merely "something is". Gaps are a fixed share of the circumference so the arcs
// stay legible at any radius.
const SEGMENT_GAP_FRACTION = 0.16;
export function segmentDashArray(radius, segments) {
  const circumference = 2 * Math.PI * radius;
  if (segments < 2) return undefined; // a single arc is just a circle
  const gap = (circumference / segments) * SEGMENT_GAP_FRACTION;
  return `${circumference / segments - gap} ${gap}`;
}

function ExpandableRing({ r, segments, k, ...props }) {
  return (
    <circle
      r={r / k}
      strokeWidth={1.8 / k}
      strokeDasharray={segmentDashArray(r / k, segments)}
      strokeLinecap="round"
      className="world-map-region-halo"
      {...props}
    />
  );
}

// Stroke width scales with the SVG transform, so at 40x a flat 0.5 border renders as a fat
// white band that swallows small countries. Counter-scale it like every other mark.
// react-simple-maps hard-defaults Geography to tabIndex="0", which made all 241 country
// paths tab stops — including the ~220 with no drinks — and gave every one the UA's black
// focus ring on click. Only a country you can actually open belongs in the tab order;
// clickableProps re-adds tabIndex 0 for those.
function CountryShape(props) {
  const { k } = useZoomPanContext();
  return <Geography stroke="var(--bg-elevated)" strokeWidth={0.5 / k} tabIndex={-1} {...props} />;
}

function RatingPip({ level }) {
  const { k } = useZoomPanContext();
  return <circle r={2.4 / k} strokeWidth={0.8 / k} className={`world-map-rating-pip world-map-rating-l${level}`} />;
}

export default function WorldMap({ countryStats, regions, regionCoordinates, onSelectCountry, onSelectRegion, worldGeo = worldCountries50m, ukGeo = ukConstituentCountries, initialZoom = 1 }) {
  const wrapperRef = useRef(null);
  const leaveTimer = useRef(null);
  const [tooltip, setTooltip] = useState(null); // { x, y, name, count, note, rows }

  const statsByCountry = useMemo(
    () => new Map(countryStats.map(r => [canonicalName(r.country), r])),
    [countryStats]
  );
  const levelOf = useMemo(() => countLevels(countryStats.map(r => r.count)), [countryStats]);

  const tree = useMemo(() => buildRegionTree(regions, regionCoordinates), [regions, regionCoordinates]);
  const maxRegionCount = useMemo(() => Math.max(1, ...tree.map(n => n.count)), [tree]);

  const positionTooltip = (e) => {
    const box = wrapperRef.current.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  // A tooltip with clickable rows has to survive the trip from the dot to the tooltip, so it
  // stops chasing the cursor and lingers briefly on mouse-out. A plain one still follows the
  // pointer and vanishes instantly.
  const showTooltip = (e, name, count, note, rows) => {
    clearTimeout(leaveTimer.current);
    setTooltip({ ...positionTooltip(e), name, count, note, rows: rows?.length ? rows : null });
  };
  const moveTooltip = (e) => setTooltip(t => (t && !t.rows ? { ...t, ...positionTooltip(e) } : t));
  const hideTooltip = () => { clearTimeout(leaveTimer.current); setTooltip(null); };
  // Callers that showed a tooltip with rows use this instead: the caller knows, so the
  // decision stays out of the state updater, which React may run more than once.
  const deferHideTooltip = () => {
    clearTimeout(leaveTimer.current);
    leaveTimer.current = setTimeout(() => setTooltip(null), TOOLTIP_LEAVE_MS);
  };
  const holdTooltip = () => clearTimeout(leaveTimer.current);

  const clickableProps = (name, count, onSelect) => ({
    role: 'button',
    tabIndex: 0,
    'aria-label': `${name}: ${count} drinks`,
    onClick: onSelect,
    onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); } },
  });

  const countryProps = (displayName, stat, geo) => ({
    'data-testid': `country-${displayName}`,
    geography: geo,
    className: `world-map-country world-map-count-l${levelOf(stat?.count ?? 0)}${stat ? ' world-map-country-clickable' : ''}`,
    ...(stat ? clickableProps(displayName, stat.count, () => onSelectCountry(stat.country)) : {}),
    onMouseEnter: e => showTooltip(e, displayName, stat?.count ?? 0, stat ? `avg ${stat.avgRating.toFixed(1)}` : null),
    onMouseMove: moveTooltip,
    onMouseLeave: hideTooltip,
  });

  // Pips live inside <Geographies> so they can reuse the already-parsed features — the
  // render prop hands over geographies but no `path`, and worldGeo arrives as TopoJSON.
  const renderPip = (geo, stat) => {
    const level = ratingLevel(stat?.avgRating);
    if (level < 0) return null;
    const [lon, lat] = mainlandCentroid(geo);
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return null;
    return <Marker coordinates={[lon, lat]}><RatingPip level={level} /></Marker>;
  };

  return (
    <div className="world-map-wrapper" ref={wrapperRef}>
      {/* Framed on the inhabited world: at the default 800x600 the bottom ~40% was Antarctica
          and empty ocean, which made the map read as mostly blank. */}
      <ComposableMap width={800} height={420} projection="geoMercator" projectionConfig={{ scale: 118, center: [10, 22] }}>
        <ZoomableGroup minZoom={1} maxZoom={MAX_ZOOM} zoom={initialZoom}>
          <Geographies geography={worldGeo}>
            {({ geographies }) => geographies
              .filter(geo => geo.properties.name !== 'United Kingdom')
              .map(geo => {
                const stat = statsByCountry.get(canonicalName(geo.properties.name));
                return (
                  <g key={geo.rsmKey}>
                    <CountryShape {...countryProps(geo.properties.name, stat, geo)} />
                    {renderPip(geo, stat)}
                  </g>
                );
              })}
          </Geographies>
          <Geographies geography={ukGeo}>
            {({ geographies }) => geographies.map(geo => {
              const stat = statsByCountry.get(geo.properties.geonunit);
              return (
                <g key={geo.rsmKey}>
                  <CountryShape {...countryProps(geo.properties.geonunit, stat, geo)} />
                  {renderPip(geo, stat)}
                </g>
              );
            })}
          </Geographies>
          <RegionLayer
            nodes={tree}
            maxCount={maxRegionCount}
            onSelectRegion={onSelectRegion}
            clickableProps={clickableProps}
            showTooltip={showTooltip}
            moveTooltip={moveTooltip}
            hideTooltip={hideTooltip}
            deferHideTooltip={deferHideTooltip}
          />
        </ZoomableGroup>
      </ComposableMap>
      <MapLegend />
      {tooltip && (
        <div
          className={`world-map-tooltip${tooltip.rows ? ' world-map-tooltip-interactive' : ''}`}
          style={{ left: tooltip.x + 12, top: tooltip.y + 12 }}
          onMouseEnter={holdTooltip}
          onMouseLeave={hideTooltip}
        >
          <div className="world-map-tooltip-head">
            <span>{tooltip.name}</span>
            {tooltip.note && <span className="world-map-tooltip-note">{tooltip.note}</span>}
            <span className="count-badge">{tooltip.count}</span>
          </div>
          {tooltip.rows && (
            <ul className="world-map-tooltip-rows">
              {tooltip.rows.map(row => (
                <li key={row.key}>
                  <button
                    type="button"
                    data-testid={`tooltip-row-${row.label}`}
                    onClick={() => { hideTooltip(); onSelectRegion(row.target); }}
                  >
                    <span className="world-map-tooltip-row-name">{row.label}</span>
                    {row.avg != null && <span className="world-map-tooltip-note">{row.avg.toFixed(1)}</span>}
                    <span className="count-badge">{row.count}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Children first (biggest first, as sorted), then the parent's own drinks last so the list
// reads as "what's inside" before "and the rest".
function subregionRows(node) {
  if (!node.children.length) return null;
  const rows = node.children.map(c => ({
    key: `${c.country}||${c.region}`,
    label: regionLeaf(c.region),
    avg: c.avgRating,
    count: c.count,
    target: c,
  }));
  if (node.ownCount > 0) {
    rows.push({
      key: `${node.country}||${node.region}||own`,
      label: `${node.region} itself`,
      avg: node.own?.avgRating,
      count: node.ownCount,
      target: node.own,
    });
  }
  return rows;
}

function RegionLayer({ nodes, maxCount, onSelectRegion, clickableProps, showTooltip, moveTooltip, hideTooltip, deferHideTooltip }) {
  const { k } = useZoomPanContext();
  const expanded = k >= EXPAND_ZOOM;

  const marks = [];
  for (const node of nodes) {
    // Zoomed out a parent stands for everything beneath it; zoomed in it drops to its own
    // drinks and the children speak for themselves.
    const showChildren = expanded && node.children.length > 0;
    const count = showChildren ? node.ownCount : node.count;
    if (count > 0 || !showChildren) {
      marks.push({
        key: `${node.country}||${node.region}`,
        label: `${node.region}, ${node.country}`,
        avg: showChildren ? node.own?.avgRating : node.avgRating,
        // Collapsed, the tooltip lists what's folded inside so you can jump straight to a
        // subregion without hunting for its dot. The parent's own drinks get a row too,
        // otherwise the rows wouldn't add up to the headline count.
        rows: !showChildren ? subregionRows(node) : null,
        // The ring is the "there's more inside" affordance, one arc per subregion, so a
        // parent reads as expandable — and as how-many — before you zoom.
        halo: !showChildren ? node.children.length : 0,
        testId: regionLeaf(node.region),
        count,
        coords: node.coords,
        target: node,
      });
    }
    if (showChildren) {
      for (const child of node.children) {
        marks.push({
          key: `${child.country}||${child.region}`,
          label: `${child.region}, ${child.country}`,
          avg: child.avgRating,
          rows: null,
          halo: 0,
          testId: regionLeaf(child.region),
          count: child.count,
          coords: child.coords,
          target: child,
        });
      }
    }
  }

  return marks.map(m => {
    const r = dotRadius(m.count, maxCount);
    const hover = {
      onMouseEnter: e => showTooltip(e, m.label, m.count, m.avg != null ? `avg ${m.avg.toFixed(1)}` : null, m.rows),
      onMouseMove: moveTooltip,
      onMouseLeave: m.rows ? deferHideTooltip : hideTooltip,
    };
    return (
      <Marker key={m.key} coordinates={[m.coords.lon, m.coords.lat]}>
        {m.halo > 0 && (
          <ExpandableRing r={r + 3} segments={m.halo} k={k} data-testid={`region-halo-${m.testId}`} {...hover} />
        )}
        <ScaledCircle
          r={r}
          className="world-map-region-marker"
          data-testid={`region-marker-${m.testId}`}
          {...clickableProps(m.label, m.count, () => onSelectRegion(m.target))}
          {...hover}
        />
      </Marker>
    );
  });
}

function MapLegend() {
  return (
    <div className="world-map-legend">
      <div className="world-map-legend-row">
        <span className="world-map-legend-label">Rated drinks</span>
        <span className="world-map-legend-scale">
          {Array.from({ length: LEVELS }, (_, i) => (
            <i key={i} className={`world-map-legend-swatch world-map-count-l${i}`} />
          ))}
        </span>
        <span className="world-map-legend-ends">fewer → more</span>
      </div>
      <div className="world-map-legend-row">
        <span className="world-map-legend-label">Avg rating</span>
        <span className="world-map-legend-scale">
          {Array.from({ length: LEVELS }, (_, i) => (
            <i key={i} className={`world-map-legend-pip world-map-rating-l${i}`} />
          ))}
        </span>
        <span className="world-map-legend-ends">lower → higher</span>
      </div>
    </div>
  );
}
