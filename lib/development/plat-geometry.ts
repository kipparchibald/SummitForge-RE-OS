// lib/development/plat-geometry.ts
// Full-coverage plat on the REAL parcel ring (curved / irregular boundaries).
// Every interior cell is assigned to a lot OR a road — nothing left over.
// Roads are double-loaded when depth allows; modules from zoning + nearby comps.

import { presetFor, inferCounty } from './land-engine';

export type LngLat = [number, number];

export type LayoutStyle = 'grid' | 'hunter_chase';

export interface DesignParams {
  lotWidthFt: number;
  lotDepthFt: number;
  rowFt: number;
  pavementFt?: number;
  nsStreets: number;
  perimFt: number;
  source: string;
  sampleSize?: number;
  medianLotAcres?: number;
  maxBlockFt?: number;
  preferredAxis?: 'ew' | 'ns' | 'auto';
  zoningCode?: string;
  zoningLabel?: string;
  /**
   * hunter_chase = long-narrow lots, loop connectors, cul-de-sacs, multi-access
   * (modeled on Hunter Chase Sub. near Rigby — connected streets, courts/circles)
   */
  layoutStyle?: LayoutStyle;
  /** Cul-de-sac bulb radius (ft) — Hunter Chase courts ~50' */
  culDeSacRadiusFt?: number;
}

export interface PlatOutput {
  metrics: {
    acres: number;
    lots: number;
    roadLF: number;
    avgLotAcres: number;
    bboxFt: [number, number];
    density: number;
    doubleLoadedPct: number;
    roadPerLot: number;
    /** Share of parcel area assigned to lots or roads (target ≈ 1) */
    coveragePct: number;
    roadAcres: number;
    lotAcresTotal: number;
  };
  design: DesignParams & {
    axis: 'ew' | 'ns';
    roadCount: number;
    crossStreetCount: number;
    layoutScore: number;
    cellFt: number;
  };
  geojson: GeoJSON.FeatureCollection;
  svg: string;
  layoutNotes: string[];
  /** Closed outer ring in project feet for debugging */
  boundaryFt?: number[][];
}

const FT_PER_DEG_LAT = 364320;
const ROAD_ID = -1;

type Axis = 'ew' | 'ns';

function transform(ring: LngLat[]) {
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const lon0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const kx = Math.cos((lat0 * Math.PI) / 180) * FT_PER_DEG_LAT;
  const ky = FT_PER_DEG_LAT;
  const pts: number[][] = ring.map(([lo, la]) => [(lo - lon0) * kx, (la - lat0) * ky]);
  return { pts, lon0, lat0, kx, ky };
}

function pip(x: number, y: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0];
    const yi = poly[i][1];
    const xj = poly[j][0];
    const yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-15) + xi) inside = !inside;
  }
  return inside;
}

function areaAcres(poly: number[][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    a += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return Math.abs(a) / 2 / 43560;
}

function coverLen(poly: number[][], isH: boolean, pos: number): number {
  const hits: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i];
    const p2 = poly[(i + 1) % poly.length];
    const a1 = isH ? p1[1] : p1[0];
    const a2 = isH ? p2[1] : p2[0];
    if ((a1 <= pos && a2 > pos) || (a2 <= pos && a1 > pos)) {
      const t = (pos - a1) / (a2 - a1 + 1e-15);
      hits.push(isH ? p1[0] + t * (p2[0] - p1[0]) : p1[1] + t * (p2[1] - p1[1]));
    }
  }
  hits.sort((a, b) => a - b);
  let L = 0;
  for (let i = 0; i + 1 < hits.length; i += 2) L += hits[i + 1] - hits[i];
  return L;
}

/** One lot = entire parcel (curved boundary), 100% coverage, no internal road. */
function designSingleLotPlat(
  ring: LngLat[],
  pts: number[][],
  closed: number[][],
  minx: number,
  maxx: number,
  miny: number,
  maxy: number,
  W: number,
  H: number,
  acres: number,
  lon0: number,
  lat0: number,
  kx: number,
  ky: number,
  D: DesignParams,
  opts: { reason: string }
): PlatOutput {
  const pad = 28;
  const scale = Math.min(780 / (W || 1), 580 / (H || 1));
  const sx = (x: number) => pad + (x - minx) * scale;
  const sy = (y: number) => pad + (maxy - y) * scale;
  const bpath =
    'M' + closed.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' L') + ' Z';
  const svgW = W * scale + pad * 2;
  const svgH = H * scale + pad * 2;
  const svg = `<svg viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fafafa">
  <path d="${bpath}" fill="#f7f4ec" stroke="#111" stroke-width="2.2"/>
  <text x="${(svgW / 2).toFixed(0)}" y="${(svgH / 2).toFixed(0)}" text-anchor="middle" dominant-baseline="middle" font-size="14" fill="#444">Lot 1 · ${acres.toFixed(2)} ac</text>
  <text x="${pad}" y="${(svgH - 8).toFixed(0)}" font-size="10" fill="#666">Real parcel boundary · 100% assigned to Lot 1</text>
</svg>`;
  const toLL = (x: number, y: number): LngLat => [lon0 + x / kx, lat0 + y / ky];
  return {
    metrics: {
      acres: +acres.toFixed(2),
      lots: 1,
      roadLF: 0,
      avgLotAcres: +acres.toFixed(3),
      bboxFt: [Math.round(W), Math.round(H)],
      density: acres > 0 ? +(1 / acres).toFixed(2) : 0,
      doubleLoadedPct: 0,
      roadPerLot: 0,
      coveragePct: 100,
      roadAcres: 0,
      lotAcresTotal: +acres.toFixed(3),
    },
    design: {
      ...D,
      axis: W >= H ? 'ew' : 'ns',
      roadCount: 0,
      crossStreetCount: 0,
      layoutScore: 1,
      cellFt: 0,
    },
    geojson: {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: { lot: 1, acres: +acres.toFixed(3) },
          geometry: {
            type: 'Polygon',
            coordinates: [closed.map((p) => toLL(p[0], p[1]))],
          },
        },
      ],
    },
    svg,
    layoutNotes: [
      `Platted on the REAL GIS parcel boundary (${ring.length} vertices) — not a concept square.`,
      opts.reason,
      'Full coverage: 100% of the property assigned to Lot 1 (no leftover land).',
      D.zoningLabel ? `Zoning: ${D.zoningCode || '—'} · ${D.zoningLabel}` : `Design: ${D.source}`,
    ],
    boundaryFt: closed,
  };
}

/**
 * Hunter Chase–style long-narrow lot module.
 * HC plat: ~145–149′ frontage × ~290–320′ depth ≈ 1.0 ac (proforma: "Long Narrow Lots").
 */
export function longNarrowModule(
  lotAcres: number,
  opts?: { urban?: boolean; minFrontage?: number }
): { lotWidthFt: number; lotDepthFt: number } {
  const area = Math.max(4000, lotAcres * 43560);
  const urban = !!opts?.urban;
  // Target depth/width ≈ 2.05 (Hunter Chase long-narrow)
  const aspect = urban ? 1.35 : 2.05;
  let w = Math.round(Math.sqrt(area / aspect));
  const minF = opts?.minFrontage ?? (urban ? 70 : 140);
  const maxF = urban ? 100 : 155;
  w = Math.max(minF, Math.min(maxF, w));
  let d = Math.round(area / w);
  const minD = urban ? 90 : 260;
  if (d < minD) {
    d = minD;
    w = Math.max(minF, Math.round(area / d));
  }
  return { lotWidthFt: w, lotDepthFt: d };
}

export function defaultDesign(county: string): DesignParams {
  const p = presetFor(county);
  // Default to Hunter Chase long-narrow proportions (not square lots)
  const mod = longNarrowModule(p.lotAcres, {
    urban: p.urban,
    minFrontage: p.urban ? Math.min(p.frontageFtPerLot, 90) : 140,
  });
  return {
    lotWidthFt: mod.lotWidthFt,
    lotDepthFt: mod.lotDepthFt,
    rowFt: p.rowFt,
    pavementFt: p.pavementFt,
    nsStreets: 0,
    perimFt: 20,
    source: 'county-preset-hunter-chase',
    medianLotAcres: p.lotAcres,
    maxBlockFt: p.urban ? 520 : 700,
    preferredAxis: 'auto',
    layoutStyle: 'hunter_chase',
    culDeSacRadiusFt: 50,
  };
}

type RoadSpec = {
  axis: Axis;
  pos: number;
  isCross: boolean;
  /** through local, loop end connector, perimeter access, or cul-de-sac bulb */
  kind?: 'through' | 'loop' | 'access' | 'culdesac';
  /** Cul-de-sac center (project feet) */
  cx?: number;
  cy?: number;
  radius?: number;
  label?: string;
};

type Skeleton = {
  roads: RoadSpec[];
  axis: Axis;
  pitch: number;
  LOTW: number;
  LOTD: number;
  ROW: number;
  primaryPositions: number[];
  score: number;
  nBands: number;
  style: LayoutStyle;
  streetNames: string[];
};

const HC_STREET_NAMES = [
  'Billman Loop',
  'Severson Drive',
  'Garfield Street',
  'Palisades Creek Court',
  'Fall Creek Circle',
  'Abbey Lane',
  'Chase Way',
  'Hunter Court',
  'Aspen Drive',
  'Creek View Lane',
];

/** Choose road skeleton — Hunter Chase style: loops, end connectors, cul-de-sacs. */
function planSkeleton(
  pts: number[][],
  minx: number,
  maxx: number,
  miny: number,
  maxy: number,
  D: DesignParams
): Skeleton {
  const W = maxx - minx;
  const H = maxy - miny;
  const style: LayoutStyle = D.layoutStyle || 'hunter_chase';
  const axes: Axis[] =
    D.preferredAxis === 'ew'
      ? ['ew', 'ns']
      : D.preferredAxis === 'ns'
        ? ['ns', 'ew']
        : W >= H
          ? ['ew', 'ns']
          : ['ns', 'ew'];

  const variants: DesignParams[] = [D];
  const minArea = (D.medianLotAcres || (D.lotWidthFt * D.lotDepthFt) / 43560) * 43560;
  const cityLock = /annex|city-of|rigby/i.test(D.source || '') || /annex|city/i.test(D.zoningLabel || '');
  const minW = cityLock ? D.lotWidthFt : style === 'hunter_chase' ? Math.min(D.lotWidthFt, 140) : 40;
  for (const mul of cityLock ? [1.0, 1.1] : [1.0, 1.05, 0.97]) {
    const w = Math.max(minW, Math.round(D.lotWidthFt * mul));
    const d = Math.max(cityLock ? D.lotDepthFt : style === 'hunter_chase' ? 260 : 80, Math.ceil(minArea / w));
    variants.push({ ...D, lotWidthFt: w, lotDepthFt: d, perimFt: Math.min(D.perimFt, 18) });
  }

  let best: Skeleton | null = null;
  const bulbR = D.culDeSacRadiusFt ?? 50;

  for (const design of variants) {
    const LOTW = design.lotWidthFt;
    const LOTD = design.lotDepthFt;
    const ROW = design.rowFt;
    const pitch = LOTD * 2 + ROW;
    const maxBlock = design.maxBlockFt || 700;

    for (const axis of axes) {
      const depthSpan = axis === 'ew' ? H : W;
      const alongSpan = axis === 'ew' ? W : H;
      const depthMin = axis === 'ew' ? miny : minx;
      const alongMin = axis === 'ew' ? minx : miny;
      const depthMax = axis === 'ew' ? maxy : maxx;
      const alongMax = axis === 'ew' ? maxx : minx + alongSpan;
      const PERIM = design.perimFt;
      const usableDepth = depthSpan - 2 * PERIM;
      const usableAlong = alongSpan - 2 * PERIM;
      if (usableDepth < LOTD + ROW * 0.5) continue;

      let nBands = Math.max(1, Math.floor((usableDepth + 1e-6) / pitch));
      if (nBands === 1 && usableDepth >= pitch * 1.85) nBands = 2;
      if (nBands === 0) nBands = 1;

      const used = nBands * pitch;
      const origin = depthMin + PERIM + Math.max(0, (usableDepth - used) / 2);

      const primaryPositions: number[] = [];
      for (let b = 0; b < nBands; b++) {
        primaryPositions.push(origin + b * pitch + LOTD + ROW / 2);
      }

      // Hunter Chase: loop connectors near BOTH ends + optional mid (connected streets)
      // Grid style: evenly spaced crosses only
      const connectorPlans: number[][] = [];
      if (style === 'hunter_chase' && usableAlong > LOTW * 4) {
        const endInset = Math.min(usableAlong * 0.12, LOTW * 1.5 + ROW);
        const left = alongMin + PERIM + endInset;
        const right = alongMin + PERIM + usableAlong - endInset;
        if (right - left > LOTW * 3) {
          connectorPlans.push([left, right]); // pure loop ends
          if (usableAlong > maxBlock * 1.4) {
            connectorPlans.push([left, (left + right) / 2, right]); // loop + mid
          }
          if (usableAlong > maxBlock * 2.2) {
            const t1 = left + (right - left) / 3;
            const t2 = left + (2 * (right - left)) / 3;
            connectorPlans.push([left, t1, t2, right]);
          }
        } else {
          connectorPlans.push([(left + right) / 2]);
        }
      } else {
        const maxCross = Math.min(3, Math.max(0, Math.floor(usableAlong / maxBlock) - 1));
        for (let nCross = 0; nCross <= maxCross; nCross++) {
          const pos: number[] = [];
          for (let c = 1; c <= nCross; c++) {
            pos.push(alongMin + PERIM + (usableAlong * c) / (nCross + 1));
          }
          connectorPlans.push(pos);
        }
        if (!connectorPlans.length) connectorPlans.push([]);
      }

      for (const connectors of connectorPlans) {
        const roads: RoadSpec[] = primaryPositions.map((pos, i) => ({
          axis,
          pos,
          isCross: false,
          kind: 'through' as const,
          label: HC_STREET_NAMES[i % HC_STREET_NAMES.length],
        }));

        connectors.forEach((pos, i) => {
          roads.push({
            axis: axis === 'ew' ? 'ns' : 'ew',
            pos,
            isCross: true,
            kind: i === 0 || i === connectors.length - 1 ? 'loop' : 'through',
            label: HC_STREET_NAMES[(primaryPositions.length + i) % HC_STREET_NAMES.length],
          });
        });

        // Cul-de-sac courts (Hunter Chase: Palisades Creek Court, Fall Creek Circle)
        // Place between loop connectors on outer street bands — not on top of connectors
        if (style === 'hunter_chase' && primaryPositions.length >= 1 && usableAlong > LOTW * 6) {
          const first = primaryPositions[0];
          const last = primaryPositions[primaryPositions.length - 1];
          const places: { along: number; depth: number; name: string }[] = [];
          if (connectors.length >= 2) {
            const a0 = connectors[0];
            const a1 = connectors[connectors.length - 1];
            const mid = (a0 + a1) / 2;
            // Offset mid courts slightly left/right for two courts
            places.push({
              along: mid - (a1 - a0) * 0.18,
              depth: first,
              name: 'Palisades Creek Court',
            });
            if (last !== first) {
              places.push({
                along: mid + (a1 - a0) * 0.18,
                depth: last,
                name: 'Fall Creek Circle',
              });
            }
          } else {
            // No loops yet — court at far end of first street
            places.push({
              along: alongMin + PERIM + usableAlong * 0.82,
              depth: first,
              name: 'Hunter Court',
            });
          }
          for (const pl of places) {
            const cx = axis === 'ew' ? pl.along : pl.depth;
            const cy = axis === 'ew' ? pl.depth : pl.along;
            roads.push({
              axis,
              pos: pl.depth,
              isCross: false,
              kind: 'culdesac',
              cx,
              cy,
              radius: bulbR,
              label: pl.name,
            });
          }
        }

        // Perimeter access stubs (Hunter Chase multi-access: 3700E / 3800E / 100N)
        if (style === 'hunter_chase' && primaryPositions.length >= 1) {
          const midAlong = alongMin + usableAlong / 2;
          const midPrimary = primaryPositions[Math.floor(primaryPositions.length / 2)];
          // Access toward min-depth and max-depth edges
          for (const edgeDepth of [depthMin + PERIM * 0.4, depthMax - PERIM * 0.4]) {
            roads.push({
              axis: axis === 'ew' ? 'ns' : 'ew',
              pos: midAlong,
              isCross: true,
              kind: 'access',
              label: 'Access',
              // mark as short access visually; raster still uses full line through parcel
              cx: axis === 'ew' ? midAlong : edgeDepth,
              cy: axis === 'ew' ? edgeDepth : midAlong,
              radius: ROW,
            });
          }
          void midPrimary;
        }

        const lotsPerRow = Math.max(1, Math.floor(usableAlong / LOTW));
        const estLots = nBands * 2 * lotsPerRow;
        let roadLF = 0;
        for (const r of roads) {
          if (r.kind === 'culdesac' && r.radius) {
            roadLF += 2 * Math.PI * r.radius * 0.75; // bulb arc
          } else {
            roadLF += coverLen(pts, r.axis === 'ew', r.pos);
          }
        }
        // Score: lots first; reward loops/connectors (HC connectivity); mild road penalty
        const loopBonus = connectors.length >= 2 ? 400 : connectors.length === 1 ? 100 : -200;
        const cdsBonus = roads.filter((r) => r.kind === 'culdesac').length * 80;
        const score =
          estLots * 5000 -
          roadLF * 0.35 -
          Math.max(0, connectors.length - 2) * 40 +
          nBands * 120 +
          loopBonus +
          cdsBonus +
          (style === 'hunter_chase' ? 200 : 0);
        if (!best || score > best.score) {
          best = {
            roads,
            axis,
            pitch,
            LOTW,
            LOTD,
            ROW,
            primaryPositions,
            score,
            nBands,
            style,
            streetNames: roads.map((r) => r.label || 'Street').filter(Boolean),
          };
        }
      }
    }
  }

  // Fallback: single centered spine
  if (!best) {
    const axis: Axis = W >= H ? 'ew' : 'ns';
    const pos = axis === 'ew' ? (miny + maxy) / 2 : (minx + maxx) / 2;
    best = {
      roads: [{ axis, pos, isCross: false, kind: 'through', label: HC_STREET_NAMES[0] }],
      axis,
      pitch: D.lotDepthFt * 2 + D.rowFt,
      LOTW: D.lotWidthFt,
      LOTD: D.lotDepthFt,
      ROW: D.rowFt,
      primaryPositions: [pos],
      score: 0,
      nBands: 1,
      style,
      streetNames: [HC_STREET_NAMES[0]],
    };
  }
  return best;
}

/**
 * Distance from point to nearest road (centerline or cul-de-sac bulb).
 */
function distToRoad(x: number, y: number, roads: RoadSpec[]): number {
  let d = Infinity;
  for (const r of roads) {
    if (r.kind === 'culdesac' && r.cx != null && r.cy != null && r.radius != null) {
      // Distance outside bulb edge (negative = inside road)
      const dist = Math.hypot(x - r.cx, y - r.cy) - r.radius;
      // Treat as "distance to road body" — 0 at edge, negative inside
      const toRoad = Math.max(0, dist);
      if (toRoad < d) d = toRoad;
      // If inside bulb, distance 0 for ROW purposes
      if (dist <= 0) d = 0;
      continue;
    }
    const dist = r.axis === 'ew' ? Math.abs(y - r.pos) : Math.abs(x - r.pos);
    if (dist < d) d = dist;
  }
  return d;
}

/**
 * Map interior non-road cell to a lot key from the double-loaded module grid.
 * Returns null only if somehow unmapped (caller assigns remainder).
 */
function lotKeyForCell(
  x: number,
  y: number,
  sk: Skeleton,
  minx: number,
  miny: number
): string | null {
  const { axis, LOTW, LOTD, ROW, primaryPositions, roads } = sk;
  const depth = axis === 'ew' ? y : x;
  const along = axis === 'ew' ? x : y;

  // Find nearest primary road
  let bestP = primaryPositions[0];
  let bestD = Math.abs(depth - bestP);
  let bestIdx = 0;
  for (let i = 0; i < primaryPositions.length; i++) {
    const d = Math.abs(depth - primaryPositions[i]);
    if (d < bestD) {
      bestD = d;
      bestP = primaryPositions[i];
      bestIdx = i;
    }
  }

  // Side of road: -1 or +1
  const side = depth >= bestP ? 1 : -1;
  // Depth band from road face (0 = closest to road)
  const fromRoad = bestD - ROW / 2;
  if (fromRoad < -ROW * 0.1) return null; // inside ROW — should already be road
  const depthSlot = Math.max(0, Math.floor(fromRoad / Math.max(LOTD, 1)));
  // Cap at one depth slot per side for double-load; deeper residual still gets slot (extra depth = same lot band stretched)
  const depthBand = Math.min(depthSlot, 0); // single depth band per side (full residual depth → same lot row)

  // Along index — account for cross-street gaps by using continuous along
  const along0 = axis === 'ew' ? minx : miny;
  const alongIdx = Math.floor((along - along0) / Math.max(LOTW, 1));

  // If near a cross street ROW, still assign (cross is road); here only lots
  for (const r of roads) {
    if (!r.isCross) continue;
    const ad = r.axis === 'ew' ? Math.abs(y - r.pos) : Math.abs(x - r.pos);
    if (ad < ROW / 2) return null;
  }

  return `R${bestIdx}_S${side}_A${alongIdx}_D${depthBand}`;
}

/** Flood-fill unlabeled interior cells into remainder lots. */
function assignRemainders(
  labels: Int32Array,
  inside: Uint8Array,
  cols: number,
  rows: number,
  nextId: number
): number {
  let id = nextId;
  const keyToId = new Map<string, number>();
  // First pass already used positive ids; unlabeled inside = 0
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!inside[i] || labels[i] !== 0) continue;
      // BFS flood
      const q = [i];
      labels[i] = id;
      let head = 0;
      while (head < q.length) {
        const cur = q[head++];
        const cy = Math.floor(cur / cols);
        const cx = cur % cols;
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          const ni = ny * cols + nx;
          if (!inside[ni] || labels[ni] !== 0) continue;
          labels[ni] = id;
          q.push(ni);
        }
      }
      id++;
    }
  }
  void keyToId;
  return id;
}

/** Build simple multipolygon exterior rings from raster labels (cell quads). */
function polygonsFromLabels(
  labels: Int32Array,
  inside: Uint8Array,
  cols: number,
  rows: number,
  originX: number,
  originY: number,
  cell: number,
  wantId: number
): number[][][] {
  // Collect cell rects then merge only as individual quads (acceptable for SVG fill)
  const polys: number[][][] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!inside[i] || labels[i] !== wantId) continue;
      const x0 = originX + c * cell;
      const y0 = originY + r * cell;
      const x1 = x0 + cell;
      const y1 = y0 + cell;
      polys.push([
        [x0, y0],
        [x1, y0],
        [x1, y1],
        [x0, y1],
        [x0, y0],
      ]);
    }
  }
  return polys;
}

/** Merge horizontal runs of same label into fewer rects for cleaner SVG. */
function rectsFromLabels(
  labels: Int32Array,
  inside: Uint8Array,
  cols: number,
  rows: number,
  originX: number,
  originY: number,
  cell: number,
  wantId: number
): { x0: number; y0: number; x1: number; y1: number }[] {
  const rects: { x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let r = 0; r < rows; r++) {
    let c = 0;
    while (c < cols) {
      const i = r * cols + c;
      if (!inside[i] || labels[i] !== wantId) {
        c++;
        continue;
      }
      let c2 = c + 1;
      while (c2 < cols) {
        const j = r * cols + c2;
        if (!inside[j] || labels[j] !== wantId) break;
        c2++;
      }
      rects.push({
        x0: originX + c * cell,
        y0: originY + r * cell,
        x1: originX + c2 * cell,
        y1: originY + (r + 1) * cell,
      });
      c = c2;
    }
  }
  return rects;
}

function designVariants(base: DesignParams): DesignParams[] {
  const minArea = (base.medianLotAcres || (base.lotWidthFt * base.lotDepthFt) / 43560) * 43560;
  const variants: DesignParams[] = [base];
  // City annexation modules (e.g. Rigby R-1 80′) must not shrink below ordinance frontage
  const cityLock = /annex|city-of|rigby/i.test(base.source || '') || /annex|city/i.test(base.zoningLabel || '');
  const minW = cityLock ? base.lotWidthFt : 40;
  for (const mul of cityLock ? [1.0, 1.1] : [1.0, 1.12, 0.92]) {
    const w = Math.max(minW, Math.round(base.lotWidthFt * mul));
    const d = Math.max(cityLock ? base.lotDepthFt : 80, Math.ceil(minArea / w));
    variants.push({ ...base, lotWidthFt: w, lotDepthFt: d });
  }
  return variants;
}

/**
 * Design a full-coverage plat inside the real parcel ring.
 * Boundary may be curved/irregular — lots and roads are clipped to it via raster.
 */
export function designPlat(ring: LngLat[], county?: string, design?: DesignParams): PlatOutput {
  const cty = county || inferCounty();
  const D0 = design || defaultDesign(cty);
  const { pts, lon0, lat0, kx, ky } = transform(ring);

  // Ensure closed ring for path
  const closed =
    pts.length > 2 &&
    (pts[0][0] !== pts[pts.length - 1][0] || pts[0][1] !== pts[pts.length - 1][1])
      ? [...pts, pts[0]]
      : pts;

  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const minx = Math.min(...xs);
  const maxx = Math.max(...xs);
  const miny = Math.min(...ys);
  const maxy = Math.max(...ys);
  const W = maxx - minx;
  const H = maxy - miny;
  const acres = areaAcres(pts);

  // Too small for internal streets: entire parcel = Lot 1 (full coverage, real boundary)
  const minLotAc = D0.medianLotAcres || (D0.lotWidthFt * D0.lotDepthFt) / 43560;
  if (acres < minLotAc * 1.35 || Math.min(W, H) < D0.lotDepthFt + D0.rowFt) {
    return designSingleLotPlat(ring, pts, closed, minx, maxx, miny, maxy, W, H, acres, lon0, lat0, kx, ky, D0, {
      reason:
        acres < minLotAc * 1.35
          ? `Parcel (${acres.toFixed(2)} ac) is under ~1.35× min lot size — single lot, no internal road.`
          : 'Parcel too narrow for double-loaded street section — single lot, no internal road.',
    });
  }

  // Pick best design module + skeleton
  let bestSk: Skeleton | null = null;
  let bestD = D0;
  for (const D of designVariants(D0)) {
    const sk = planSkeleton(pts, minx, maxx, miny, maxy, D);
    if (!bestSk || sk.score > bestSk.score) {
      bestSk = sk;
      bestD = {
        ...D,
        lotWidthFt: sk.LOTW,
        lotDepthFt: sk.LOTD,
        rowFt: sk.ROW,
      };
    }
  }
  const sk = bestSk!;
  const D = bestD;

  // --- Raster full coverage ---
  // Cell size: balance fidelity vs speed (target ≤ ~8k cells; large farms need coarser cells)
  const targetCells = 8000;
  const cell = Math.max(
    10,
    Math.min(80, Math.ceil(Math.sqrt((Math.max(W, 1) * Math.max(H, 1)) / targetCells)))
  );
  const cols = Math.max(1, Math.ceil(W / cell) + 1);
  const rows = Math.max(1, Math.ceil(H / cell) + 1);
  const originX = minx;
  const originY = miny;
  const n = cols * rows;
  const inside = new Uint8Array(n);
  const labels = new Int32Array(n); // 0 unknown, ROAD_ID road, >0 lot

  let interiorCount = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const cx = originX + (c + 0.5) * cell;
      const cy = originY + (r + 0.5) * cell;
      const i = r * cols + c;
      if (pip(cx, cy, pts)) {
        inside[i] = 1;
        interiorCount++;
      }
    }
  }

  // Mark roads
  const halfRow = sk.ROW / 2;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!inside[i]) continue;
      const cx = originX + (c + 0.5) * cell;
      const cy = originY + (r + 0.5) * cell;
      if (distToRoad(cx, cy, sk.roads) <= halfRow) {
        labels[i] = ROAD_ID;
      }
    }
  }

  // Assign lot keys → integer ids
  const keyToId = new Map<string, number>();
  let nextLotId = 1;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      if (!inside[i] || labels[i] !== 0) continue;
      const cx = originX + (c + 0.5) * cell;
      const cy = originY + (r + 0.5) * cell;
      const key = lotKeyForCell(cx, cy, sk, minx, miny);
      if (!key) continue;
      let id = keyToId.get(key);
      if (id == null) {
        id = nextLotId++;
        keyToId.set(key, id);
      }
      labels[i] = id;
    }
  }

  // Any remaining interior (curved edge slivers, odd corners) → remainder lots via flood fill
  nextLotId = assignRemainders(labels, inside, cols, rows, nextLotId);

  // Count cells per lot / road
  const lotCellCount = new Map<number, number>();
  let roadCells = 0;
  let labeled = 0;
  for (let i = 0; i < n; i++) {
    if (!inside[i]) continue;
    labeled++;
    if (labels[i] === ROAD_ID) roadCells++;
    else if (labels[i] > 0) {
      lotCellCount.set(labels[i], (lotCellCount.get(labels[i]) || 0) + 1);
    }
  }

  // Drop tiny speck lots (< ~1/4 of target module) by absorbing into nearest larger lot
  const minCells = Math.max(
    2,
    Math.floor(((D.lotWidthFt * D.lotDepthFt) / (cell * cell)) * 0.2)
  );
  const absorbTiny = () => {
    for (const [id, count] of [...lotCellCount.entries()]) {
      if (count >= minCells) continue;
      // reassign cells to nearest non-tiny lot or road neighbor
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (labels[i] !== id) continue;
          let best = ROAD_ID;
          let bestD = Infinity;
          for (let rr = 0; rr < rows; rr++) {
            for (let cc = 0; cc < cols; cc++) {
              const j = rr * cols + cc;
              const lid = labels[j];
              if (lid === id || !inside[j]) continue;
              if (lid > 0 && (lotCellCount.get(lid) || 0) < minCells) continue;
              const dist = Math.abs(rr - r) + Math.abs(cc - c);
              if (dist < bestD) {
                bestD = dist;
                best = lid;
              }
            }
          }
          // Local search only for speed
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [2, 0],
            [-2, 0],
            [0, 2],
            [0, -2],
            [3, 0],
            [0, 3],
          ]) {
            const nx = c + dx;
            const ny = r + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const j = ny * cols + nx;
            const lid = labels[j];
            if (lid === id || !inside[j]) continue;
            if (lid > 0 && (lotCellCount.get(lid) || 0) < minCells) continue;
            const dist = Math.abs(dx) + Math.abs(dy);
            if (dist < bestD) {
              bestD = dist;
              best = lid;
            }
          }
          labels[i] = best;
        }
      }
      lotCellCount.delete(id);
    }
  };
  // Only absorb when not too many lots (O(n²) guard) — use local neighbor absorb
  if (lotCellCount.size < 400) {
    // local-only absorb for tiny lots
    for (const [id, count] of [...lotCellCount.entries()]) {
      if (count >= minCells) continue;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const i = r * cols + c;
          if (labels[i] !== id) continue;
          let best = labels[i];
          for (const [dx, dy] of [
            [1, 0],
            [-1, 0],
            [0, 1],
            [0, -1],
            [2, 0],
            [0, 2],
            [-2, 0],
            [0, -2],
          ]) {
            const nx = c + dx;
            const ny = r + dy;
            if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
            const lid = labels[ny * cols + nx];
            if (lid !== id && inside[ny * cols + nx] && (lid === ROAD_ID || (lid > 0 && (lotCellCount.get(lid) || 0) >= minCells))) {
              best = lid;
              break;
            }
          }
          labels[i] = best;
        }
      }
      lotCellCount.delete(id);
    }
  }
  void absorbTiny;

  // Recount
  lotCellCount.clear();
  roadCells = 0;
  let unlabeled = 0;
  for (let i = 0; i < n; i++) {
    if (!inside[i]) continue;
    if (labels[i] === ROAD_ID) roadCells++;
    else if (labels[i] > 0) lotCellCount.set(labels[i], (lotCellCount.get(labels[i]) || 0) + 1);
    else unlabeled++;
  }
  // Force any still-unlabeled to road (should be rare)
  if (unlabeled > 0) {
    for (let i = 0; i < n; i++) {
      if (inside[i] && labels[i] === 0) {
        labels[i] = ROAD_ID;
        roadCells++;
        unlabeled--;
      }
    }
  }

  const lotIds = [...lotCellCount.keys()].sort((a, b) => a - b);
  // Renumber lots 1..N for display
  const renumber = new Map<number, number>();
  lotIds.forEach((id, idx) => renumber.set(id, idx + 1));
  for (let i = 0; i < n; i++) {
    if (labels[i] > 0) labels[i] = renumber.get(labels[i]) || labels[i];
  }
  const finalLotCount = lotIds.length;
  const cellAcres = (cell * cell) / 43560;
  const roadAcres = roadCells * cellAcres;
  const lotAcresTotal = [...lotCellCount.values()].reduce((s, c) => s + c, 0) * cellAcres;
  // After renumber lotCellCount keys are stale — recompute areas from labels
  const lotAreas = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    if (labels[i] > 0) lotAreas.set(labels[i], (lotAreas.get(labels[i]) || 0) + cellAcres);
  }
  const avgLot =
    finalLotCount > 0
      ? [...lotAreas.values()].reduce((s, a) => s + a, 0) / finalLotCount
      : 0;

  let roadLF = 0;
  for (const r of sk.roads) {
    roadLF += coverLen(pts, r.axis === 'ew', r.pos);
  }
  roadLF = Math.round(roadLF);

  // Double-loaded estimate: lots that share an edge with a road cell (single pass)
  const touchesRoad = new Set<number>();
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c;
      const lid = labels[i];
      if (lid <= 0) continue;
      for (const [dx, dy] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nx = c + dx;
        const ny = r + dy;
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
        if (labels[ny * cols + nx] === ROAD_ID) {
          touchesRoad.add(lid);
          break;
        }
      }
    }
  }
  const doubleLoadedPct =
    finalLotCount > 0 ? Math.round((touchesRoad.size / finalLotCount) * 100) : 0;

  const coveragePct =
    interiorCount > 0
      ? Math.round(((interiorCount - unlabeled) / interiorCount) * 1000) / 10
      : 100;

  // --- SVG: Hunter Chase–style preliminary plat look ---
  const pad = 36;
  const scale = Math.min(800 / (W || 1), 600 / (H || 1));
  const sx = (x: number) => pad + (x - minx) * scale;
  const sy = (y: number) => pad + (maxy - y) * scale;
  const bpath =
    'M' +
    closed.map((p) => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' L') +
    ' Z';

  const clipId = 'parcelClip';
  const PAV = D.pavementFt || Math.round(D.rowFt * 0.5);
  const rowW = Math.max(1.2, D.rowFt * scale);
  const pavW = Math.max(0.9, PAV * scale);
  const hcStyle = (sk.style || D.layoutStyle || 'hunter_chase') === 'hunter_chase';

  // Lot fills — alternate block shading like a survey plat
  const lotColors = hcStyle
    ? ['#fbf8f1', '#f3f0e6', '#faf6ee', '#f0ede4', '#f7f3ea', '#ebe8df']
    : ['#f7f4ec', '#eef6f0', '#f5f0e6', '#eef2f7', '#f8efe8', '#f0f4ea'];
  let lotSvg = '';
  for (let lid = 1; lid <= finalLotCount; lid++) {
    const rects = rectsFromLabels(labels, inside, cols, rows, originX, originY, cell, lid);
    const fill = lotColors[(lid - 1) % lotColors.length];
    for (const rect of rects) {
      const x = sx(rect.x0);
      const y = sy(rect.y1);
      const w = (rect.x1 - rect.x0) * scale;
      const h = (rect.y1 - rect.y0) * scale;
      lotSvg += `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" fill="${fill}" stroke="#4a4a4a" stroke-width="0.55"/>`;
    }
    if (rects.length) {
      const r0 = rects[Math.floor(rects.length / 2)];
      const lx = sx((r0.x0 + r0.x1) / 2);
      const ly = sy((r0.y0 + r0.y1) / 2);
      const showNum = finalLotCount <= 120;
      if (showNum) {
        const fs = Math.max(6, Math.min(10, 12 * scale));
        lotSvg += `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${fs.toFixed(0)}" font-family="Georgia, serif" fill="#333">${lid}</text>`;
      }
    }
  }

  // Road cells as fill
  const roadRects = rectsFromLabels(labels, inside, cols, rows, originX, originY, cell, ROAD_ID);
  let roadFill = '';
  for (const rect of roadRects) {
    roadFill += `<rect x="${sx(rect.x0).toFixed(1)}" y="${sy(rect.y1).toFixed(1)}" width="${((rect.x1 - rect.x0) * scale).toFixed(1)}" height="${((rect.y1 - rect.y0) * scale).toFixed(1)}" fill="#cfc6a8"/>`;
  }

  // Centerlines + cul-de-sac bulbs + street names (Hunter Chase style)
  let roadLines = '';
  let streetLabels = '';
  let bulbSvg = '';
  for (const r of sk.roads) {
    if (r.kind === 'culdesac' && r.cx != null && r.cy != null && r.radius != null) {
      const cr = r.radius * scale;
      bulbSvg += `<circle cx="${sx(r.cx).toFixed(1)}" cy="${sy(r.cy).toFixed(1)}" r="${cr.toFixed(1)}" fill="#cfc6a8" stroke="#8a7d55" stroke-width="1.2"/>`;
      bulbSvg += `<circle cx="${sx(r.cx).toFixed(1)}" cy="${sy(r.cy).toFixed(1)}" r="${(cr * 0.55).toFixed(1)}" fill="none" stroke="#9a8b5c" stroke-width="${Math.max(1, pavW * 0.35).toFixed(1)}"/>`;
      if (r.label) {
        streetLabels += `<text x="${sx(r.cx).toFixed(1)}" y="${(sy(r.cy) - cr - 4).toFixed(1)}" text-anchor="middle" font-size="8" font-family="Georgia, serif" fill="#5c5340">${r.label}</text>`;
      }
      continue;
    }
    if (r.kind === 'access') {
      // Lighter access mark toward perimeter
      if (r.axis === 'ew') {
        roadLines += `<line x1="${sx(minx).toFixed(1)}" y1="${sy(r.pos).toFixed(1)}" x2="${sx(maxx).toFixed(1)}" y2="${sy(r.pos).toFixed(1)}" stroke="#b0a57a" stroke-width="${(pavW * 0.7).toFixed(1)}" stroke-dasharray="6 4" opacity="0.7"/>`;
      } else {
        roadLines += `<line x1="${sx(r.pos).toFixed(1)}" y1="${sy(miny).toFixed(1)}" x2="${sx(r.pos).toFixed(1)}" y2="${sy(maxy).toFixed(1)}" stroke="#b0a57a" stroke-width="${(pavW * 0.7).toFixed(1)}" stroke-dasharray="6 4" opacity="0.7"/>`;
      }
      continue;
    }
    if (r.axis === 'ew') {
      roadLines +=
        `<line x1="${sx(minx).toFixed(1)}" y1="${sy(r.pos).toFixed(1)}" x2="${sx(maxx).toFixed(1)}" y2="${sy(r.pos).toFixed(1)}" stroke="#ddd4b5" stroke-width="${rowW.toFixed(1)}" opacity="0.45"/>` +
        `<line x1="${sx(minx).toFixed(1)}" y1="${sy(r.pos).toFixed(1)}" x2="${sx(maxx).toFixed(1)}" y2="${sy(r.pos).toFixed(1)}" stroke="#8a7d55" stroke-width="${pavW.toFixed(1)}"/>`;
      if (r.label && hcStyle) {
        const midX = sx((minx + maxx) / 2);
        streetLabels += `<text x="${midX.toFixed(1)}" y="${(sy(r.pos) - 5).toFixed(1)}" text-anchor="middle" font-size="8" font-family="Georgia, serif" fill="#5c5340" letter-spacing="0.5">${r.label}</text>`;
      }
    } else {
      roadLines +=
        `<line x1="${sx(r.pos).toFixed(1)}" y1="${sy(miny).toFixed(1)}" x2="${sx(r.pos).toFixed(1)}" y2="${sy(maxy).toFixed(1)}" stroke="#ddd4b5" stroke-width="${rowW.toFixed(1)}" opacity="0.45"/>` +
        `<line x1="${sx(r.pos).toFixed(1)}" y1="${sy(miny).toFixed(1)}" x2="${sx(r.pos).toFixed(1)}" y2="${sy(maxy).toFixed(1)}" stroke="#8a7d55" stroke-width="${pavW.toFixed(1)}"/>`;
      if (r.label && hcStyle && r.kind === 'loop') {
        streetLabels += `<text x="${(sx(r.pos) + 6).toFixed(1)}" y="${sy((miny + maxy) / 2).toFixed(1)}" font-size="8" font-family="Georgia, serif" fill="#5c5340" transform="rotate(-90 ${(sx(r.pos) + 6).toFixed(1)} ${sy((miny + maxy) / 2).toFixed(1)})">${r.label}</text>`;
      }
    }
  }

  const svgW = W * scale + pad * 2;
  const svgH = H * scale + pad * 2 + 22;
  // North arrow + scale bar
  const naX = svgW - 28;
  const naY = 28;
  const northArrow = `<g transform="translate(${naX},${naY})">
    <polygon points="0,-14 5,8 -5,8" fill="#222"/>
    <text x="0" y="18" text-anchor="middle" font-size="9" font-family="Georgia, serif" fill="#222">N</text>
  </g>`;
  const scaleFt = 200;
  const scalePx = scaleFt * scale;
  const scaleBar = `<g transform="translate(${pad},${svgH - 14})">
    <line x1="0" y1="0" x2="${scalePx.toFixed(0)}" y2="0" stroke="#222" stroke-width="1.5"/>
    <line x1="0" y1="-3" x2="0" y2="3" stroke="#222" stroke-width="1.5"/>
    <line x1="${scalePx.toFixed(0)}" y1="-3" x2="${scalePx.toFixed(0)}" y2="3" stroke="#222" stroke-width="1.5"/>
    <text x="${(scalePx / 2).toFixed(0)}" y="12" text-anchor="middle" font-size="8" fill="#444">${scaleFt} ft</text>
  </g>`;
  const title = hcStyle
    ? `PRELIMINARY PLAT · Hunter Chase style · ${finalLotCount} lots · ${D.lotWidthFt}′×${D.lotDepthFt}′ modules · connected loops &amp; courts`
    : `PRELIMINARY PLAT · ${finalLotCount} lots · full coverage`;

  const svg = `<svg viewBox="0 0 ${svgW.toFixed(0)} ${svgH.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#f7f5ef">
  <defs><clipPath id="${clipId}"><path d="${bpath}"/></clipPath></defs>
  <rect width="100%" height="100%" fill="#f7f5ef"/>
  <path d="${bpath}" fill="#e5dfd0" stroke="none"/>
  <g clip-path="url(#${clipId})">${roadFill}${lotSvg}${roadLines}${bulbSvg}${streetLabels}</g>
  <path d="${bpath}" fill="none" stroke="#1a1a1a" stroke-width="2.4"/>
  ${northArrow}
  ${scaleBar}
  <text x="${pad}" y="${(svgH - 22).toFixed(0)}" font-size="9" font-family="Georgia, serif" fill="#333">${title}</text>
</svg>`;

  // GeoJSON lots (cell multipolygons simplified to rect unions as multipolygon)
  const toLL = (x: number, y: number): LngLat => [lon0 + x / kx, lat0 + y / ky];
  const features: GeoJSON.Feature[] = [];
  for (let lid = 1; lid <= finalLotCount; lid++) {
    const polys = polygonsFromLabels(labels, inside, cols, rows, originX, originY, cell, lid);
    if (!polys.length) continue;
    const coords = polys.map((poly) => poly.map((pt) => toLL(pt[0], pt[1])));
    features.push({
      type: 'Feature',
      properties: {
        lot: lid,
        acres: +(lotAreas.get(lid) || 0).toFixed(3),
      },
      geometry:
        coords.length === 1
          ? { type: 'Polygon', coordinates: coords }
          : { type: 'MultiPolygon', coordinates: coords.map((c) => [c]) },
    });
  }

  // Boundary feature
  features.push({
    type: 'Feature',
    properties: { role: 'boundary', acres: +acres.toFixed(3) },
    geometry: {
      type: 'Polygon',
      coordinates: [closed.map((p) => toLL(p[0], p[1]))],
    },
  });

  const nLoop = sk.roads.filter((r) => r.kind === 'loop').length;
  const nCds = sk.roads.filter((r) => r.kind === 'culdesac').length;
  const nAccess = sk.roads.filter((r) => r.kind === 'access').length;
  const layoutNotes = [
    `Platted on the REAL GIS parcel boundary (${ring.length} vertices) — not a concept square.`,
    `Layout style: ${sk.style === 'hunter_chase' ? 'Hunter Chase (long-narrow lots, connected loops, courts, multi-access)' : 'grid'}.`,
    `Full coverage: every interior cell is a lot or road (${coveragePct}% assigned).`,
    `${sk.nBands} double-loaded street band(s) on ${sk.axis.toUpperCase()} axis · ${nLoop} loop connector(s) · ${nCds} cul-de-sac court(s) · ${nAccess} perimeter access leg(s).`,
    `Lot module ${sk.LOTW}′ × ${sk.LOTD}′ (long-narrow like Hunter Chase ~145×300 for 1 ac) · ROW ${D.rowFt}′.`,
    `Road network connects (loops) rather than isolated spines — modeled on Hunter Chase streets (Billman Loop, courts/circles).`,
    D.zoningLabel
      ? `Zoning: ${D.zoningCode || '—'} · ${D.zoningLabel}`
      : `Design source: ${D.source}`,
    D.source === 'nearby-subdivisions' && D.sampleSize
      ? `Module influenced by ${D.sampleSize} nearby subdivision parcels.`
      : 'Module from county / zoning / Hunter Chase proportions.',
  ];

  return {
    metrics: {
      acres: +acres.toFixed(2),
      lots: finalLotCount,
      roadLF,
      avgLotAcres: +avgLot.toFixed(3),
      bboxFt: [Math.round(W), Math.round(H)],
      density: acres > 0 ? +(finalLotCount / acres).toFixed(2) : 0,
      doubleLoadedPct,
      roadPerLot: finalLotCount > 0 ? Math.round(roadLF / finalLotCount) : 0,
      coveragePct,
      roadAcres: +roadAcres.toFixed(3),
      lotAcresTotal: +([...lotAreas.values()].reduce((s, a) => s + a, 0)).toFixed(3),
    },
    design: {
      ...D0,
      ...D,
      layoutStyle: sk.style,
      lotWidthFt: sk.LOTW,
      lotDepthFt: sk.LOTD,
      axis: sk.axis,
      roadCount: sk.roads.filter((r) => !r.isCross && r.kind !== 'culdesac').length,
      crossStreetCount: sk.roads.filter((r) => r.isCross || r.kind === 'loop').length,
      layoutScore: Math.round(sk.score),
      cellFt: cell,
    },
    geojson: { type: 'FeatureCollection', features },
    svg,
    layoutNotes,
    boundaryFt: closed,
  };
}
