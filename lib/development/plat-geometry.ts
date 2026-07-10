// lib/development/plat-geometry.ts
// Intelligent on-parcel plat design from real GIS boundary geometry.
// Fits a lot/road grid inside the actual parcel polygon (point-in-polygon test),
// using design parameters that can be LEARNED from nearby subdivisions (see comps-design.ts)
// or fall back to county presets.

import { presetFor, inferCounty } from './land-engine';

export type LngLat = [number, number];

export interface DesignParams {
  lotWidthFt: number; lotDepthFt: number; rowFt: number;
  nsStreets: number; perimFt: number;
  source: string;        // "nearby-subdivisions" | "county-preset"
  sampleSize?: number;   // # of comparable lots learned from
  medianLotAcres?: number;
}

export interface PlatOutput {
  metrics: { acres: number; lots: number; roadLF: number; avgLotAcres: number; bboxFt: [number, number]; density: number };
  design: DesignParams;
  geojson: any;
  svg: string;
}

const FT_PER_DEG_LAT = 364320;

function transform(ring: LngLat[]) {
  const lat0 = ring.reduce((s, p) => s + p[1], 0) / ring.length;
  const lon0 = ring.reduce((s, p) => s + p[0], 0) / ring.length;
  const kx = Math.cos((lat0 * Math.PI) / 180) * FT_PER_DEG_LAT, ky = FT_PER_DEG_LAT;
  const pts: number[][] = ring.map(([lo, la]) => [(lo - lon0) * kx, (la - lat0) * ky]);
  return { pts, lon0, lat0, kx, ky };
}
function pip(x: number, y: number, poly: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
    if (((yi > y) !== (yj > y)) && (x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}
function areaAcres(poly: number[][]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
    a += p1[0] * p2[1] - p2[0] * p1[1];
  }
  return Math.abs(a) / 2 / 43560;
}
function coverLen(poly: number[][], isH: boolean, pos: number): number {
  const hits: number[] = [];
  for (let i = 0; i < poly.length; i++) {
    const p1 = poly[i], p2 = poly[(i + 1) % poly.length];
    const a1 = isH ? p1[1] : p1[0], a2 = isH ? p2[1] : p2[0];
    if ((a1 <= pos && a2 > pos) || (a2 <= pos && a1 > pos)) {
      const t = (pos - a1) / (a2 - a1);
      hits.push(isH ? p1[0] + t * (p2[0] - p1[0]) : p1[1] + t * (p2[1] - p1[1]));
    }
  }
  hits.sort((a, b) => a - b);
  let L = 0;
  for (let i = 0; i + 1 < hits.length; i += 2) L += hits[i + 1] - hits[i];
  return L;
}

export function defaultDesign(county: string): DesignParams {
  const p = presetFor(county);
  const lotWidthFt = p.frontageFtPerLot;
  const lotDepthFt = Math.max(80, Math.round((p.lotAcres * 43560) / lotWidthFt));
  return { lotWidthFt, lotDepthFt, rowFt: p.urban ? 56 : 60, nsStreets: 1, perimFt: 40,
    source: 'county-preset', medianLotAcres: p.lotAcres };
}

/** Design a plat inside the real parcel ring. `design` can be learned from comps. */
export function designPlat(ring: LngLat[], county?: string, design?: DesignParams): PlatOutput {
  const cty = county || inferCounty();
  const D = design || defaultDesign(cty);
  const { pts, lon0, lat0, kx, ky } = transform(ring);
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const minx = Math.min(...xs), maxx = Math.max(...xs), miny = Math.min(...ys), maxy = Math.max(...ys);
  const W = maxx - minx, H = maxy - miny;
  const acres = areaAcres(pts);

  const { lotWidthFt: LOTW, lotDepthFt: LOTD, rowFt: ROW, nsStreets: NS, perimFt: PERIM } = D;
  const pitch = LOTD * 2 + ROW;
  const nsX: number[] = [];
  for (let i = 0; i < Math.max(1, NS); i++) nsX.push(minx + (W * (i + 1)) / (Math.max(1, NS) + 1));
  const ew: number[] = [];
  for (let y = miny + PERIM + LOTD + ROW / 2; y < maxy - PERIM - LOTD + 1; y += pitch) ew.push(y);

  const lots: { rect: number[][]; id: number }[] = [];
  for (const cy of ew) {
    for (const band of [[cy + ROW / 2, cy + ROW / 2 + LOTD], [cy - ROW / 2 - LOTD, cy - ROW / 2]]) {
      const y0 = band[0], y1 = band[1];
      const cuts = [minx + PERIM, ...nsX.flatMap(cx => [cx - ROW / 2, cx + ROW / 2]), maxx - PERIM].sort((a, b) => a - b);
      for (let s = 0; s + 1 < cuts.length; s += 2) {
        const xa = cuts[s], xb = cuts[s + 1];
        for (let x = xa; x + LOTW <= xb + 0.5; x += LOTW) {
          const rect = [[x, y0], [x + LOTW, y0], [x + LOTW, y1], [x, y1]];
          const cx = x + LOTW / 2, cyc = (y0 + y1) / 2;
          if (rect.every(pt => pip(pt[0], pt[1], pts)) && pip(cx, cyc, pts)) {
            lots.push({ rect, id: lots.length + 1 });
          }
        }
      }
    }
  }
  let roadLF = 0;
  for (const cy of ew) roadLF += coverLen(pts, true, cy);
  for (const cx of nsX) roadLF += coverLen(pts, false, cx);

  // --- SVG render ---
  const pad = 30, scale = Math.min(760 / (W || 1), 560 / (H || 1));
  const sx = (x: number) => pad + (x - minx) * scale;
  const sy = (y: number) => pad + (maxy - y) * scale;
  const bpath = 'M' + pts.map(p => `${sx(p[0]).toFixed(1)},${sy(p[1]).toFixed(1)}`).join(' L') + ' Z';
  const roadSvg = [
    ...ew.map(cy => `<line x1="${sx(minx).toFixed(1)}" y1="${sy(cy).toFixed(1)}" x2="${sx(maxx).toFixed(1)}" y2="${sy(cy).toFixed(1)}" stroke="#e3dcc6" stroke-width="${Math.max(1, ROW * scale).toFixed(1)}"/>`),
    ...nsX.map(cx => `<line x1="${sx(cx).toFixed(1)}" y1="${sy(miny).toFixed(1)}" x2="${sx(cx).toFixed(1)}" y2="${sy(maxy).toFixed(1)}" stroke="#e3dcc6" stroke-width="${Math.max(1, ROW * scale).toFixed(1)}"/>`),
  ].join('');
  const lotSvg = lots.map(l => {
    const x0 = l.rect[0][0], y0 = l.rect[0][1], x1 = l.rect[2][0], y1 = l.rect[2][1];
    return `<rect x="${sx(x0).toFixed(1)}" y="${sy(y1).toFixed(1)}" width="${((x1 - x0) * scale).toFixed(1)}" height="${((y1 - y0) * scale).toFixed(1)}" fill="#fbfaf6" stroke="#666" stroke-width="0.5"/>`;
  }).join('');
  const w = W * scale + pad * 2, h = H * scale + pad * 2;
  const svg = `<svg viewBox="0 0 ${w.toFixed(0)} ${h.toFixed(0)}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;background:#fff">${roadSvg}${lotSvg}<path d="${bpath}" fill="none" stroke="#1a1a1a" stroke-width="2"/></svg>`;

  // --- GeoJSON lots (lng/lat) for Mapbox overlay ---
  const toLL = (x: number, y: number): LngLat => [lon0 + x / kx, lat0 + y / ky];
  const features = lots.map(l => ({
    type: 'Feature', properties: { lot: l.id, acres: +areaAcres(l.rect).toFixed(3) },
    geometry: { type: 'Polygon', coordinates: [[...l.rect, l.rect[0]].map(pt => toLL(pt[0], pt[1]))] },
  }));
  const avg = lots.length ? lots.reduce((s, l) => s + areaAcres(l.rect), 0) / lots.length : 0;

  return {
    metrics: {
      acres: +acres.toFixed(2), lots: lots.length, roadLF: Math.round(roadLF),
      avgLotAcres: +avg.toFixed(3), bboxFt: [Math.round(W), Math.round(H)],
      density: acres > 0 ? +(lots.length / acres).toFixed(2) : 0,
    },
    design: D,
    geojson: { type: 'FeatureCollection', features },
    svg,
  };
}
