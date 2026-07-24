// lib/development/comps-design.ts
// Learns plat design parameters from REAL nearby subdivision lots on GIS,
// and infers typical street axis / block length for the neighborhood.

import { presetFor } from './land-engine';
import { defaultDesign, longNarrowModule, type DesignParams } from './plat-geometry';

const REST = 'https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/MapServer/0/query';
const FT_PER_DEG_LAT = 364320;

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function ringOf(f: any): number[][] {
  const g = f?.geometry;
  if (!g) return [];
  return g.type === 'Polygon' ? g.coordinates[0] : g.coordinates?.[0]?.[0] || [];
}

export type SubdivisionPattern = {
  sampleSize: number;
  medianLotAcres: number;
  medianFrontageFt: number;
  medianDepthFt: number;
  /** Dominant short-side orientation of nearby lots */
  preferredAxis: 'ew' | 'ns' | 'auto';
  maxBlockFt: number;
  notes: string[];
};

/**
 * Sample parcels near (lat,lng); treat 0.08–2.5 ac as nearby subdivision lots.
 */
export async function scanNearbySubdivisions(
  lat: number,
  lng: number
): Promise<SubdivisionPattern | null> {
  const d = 0.008; // ~850 m
  const params = {
    geometry: `${lng - d},${lat - d},${lng + d},${lat + d}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'PIN,COUNTY',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: '500',
  };
  let gj: any;
  try {
    const res = await fetch(`${REST}?${new URLSearchParams(params)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    gj = await res.json();
  } catch {
    return null;
  }

  const kx = Math.cos((lat * Math.PI) / 180) * FT_PER_DEG_LAT;
  const ky = FT_PER_DEG_LAT;
  const acresArr: number[] = [];
  const frontArr: number[] = [];
  const depthArr: number[] = [];
  let ewFront = 0; // short side aligned with E-W (width < height in local ft → frontage on N/S road)
  let nsFront = 0;

  type LotBox = { cx: number; cy: number; front: number; depth: number; acres: number };
  const boxes: LotBox[] = [];

  for (const f of gj.features || []) {
    const ring = ringOf(f);
    if (ring.length < 3) continue;
    const pts = ring.map((p: number[]) => [(p[0] - lng) * kx, (p[1] - lat) * ky]);
    let a = 0;
    let minx = Infinity;
    let maxx = -Infinity;
    let miny = Infinity;
    let maxy = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i];
      const p2 = pts[(i + 1) % pts.length];
      a += p1[0] * p2[1] - p2[0] * p1[1];
      minx = Math.min(minx, p1[0]);
      maxx = Math.max(maxx, p1[0]);
      miny = Math.min(miny, p1[1]);
      maxy = Math.max(maxy, p1[1]);
    }
    const acres = Math.abs(a) / 2 / 43560;
    // Developed residential / small acreage lots (exclude raw 40s and tiny ROW slivers)
    if (acres < 0.08 || acres > 2.5) continue;
    const w = maxx - minx;
    const h = maxy - miny;
    if (w < 30 || h < 30) continue;
    // Short side ≈ street frontage for typical rectangular lots
    const front = Math.min(w, h);
    const depth = Math.max(w, h);
    // Extreme aspect (drainage strips) skip
    if (depth / front > 6) continue;

    acresArr.push(acres);
    frontArr.push(front);
    depthArr.push(depth);
    boxes.push({
      cx: (minx + maxx) / 2,
      cy: (miny + maxy) / 2,
      front,
      depth,
      acres,
    });
    if (w <= h) ewFront++;
    // short side is X → frontage faces N/S → roads run E-W
    else nsFront++;
    // short side is Y → frontage faces E/W → roads run N-S
  }

  if (acresArr.length < 6) return null;

  const medAcres = median(acresArr);
  const medFront = Math.max(40, Math.round(median(frontArr)));
  const medDepth = Math.max(80, Math.round(median(depthArr)));

  // Preferred road axis: if lots are wider than deep in N-S, roads tend E-W
  let preferredAxis: 'ew' | 'ns' | 'auto' = 'auto';
  if (ewFront > nsFront * 1.25) preferredAxis = 'ew';
  else if (nsFront > ewFront * 1.25) preferredAxis = 'ns';

  // Estimate block length from spacing of lot-cluster centers along primary axis
  const maxBlockFt = estimateBlockLength(boxes, preferredAxis === 'ns' ? 'ns' : 'ew');

  const notes = [
    `Sampled ${acresArr.length} nearby lots (0.08–2.5 ac) from Idaho parcels.`,
    `Median lot ≈ ${medAcres.toFixed(2)} ac · frontage ~${medFront}′ · depth ~${medDepth}′.`,
    preferredAxis !== 'auto'
      ? `Neighborhood lots suggest ${preferredAxis.toUpperCase()} primary streets (double-loaded pattern).`
      : 'No dominant street axis — optimizer will try both orientations.',
    `Target max block ≈ ${maxBlockFt}′ before a cross street.`,
  ];

  return {
    sampleSize: acresArr.length,
    medianLotAcres: +medAcres.toFixed(3),
    medianFrontageFt: medFront,
    medianDepthFt: medDepth,
    preferredAxis,
    maxBlockFt,
    notes,
  };
}

function estimateBlockLength(boxes: { cx: number; cy: number }[], axis: 'ew' | 'ns'): number {
  if (boxes.length < 10) return 660;
  // Project centers onto primary street direction and look at gaps between clusters
  const vals = boxes.map((b) => (axis === 'ew' ? b.cx : b.cy)).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < vals.length; i++) {
    const g = vals[i] - vals[i - 1];
    // Intra-block lot spacing is small; inter-block gaps are large (road + setbacks)
    if (g > 80 && g < 1400) gaps.push(g);
  }
  if (gaps.length < 3) return 660;
  // Typical block ~ sum of several lot frontages; use 75th percentile of larger gaps
  const sorted = [...gaps].sort((a, b) => a - b);
  const p75 = sorted[Math.floor(sorted.length * 0.75)];
  return Math.round(Math.min(900, Math.max(400, p75 * 4)));
}

/**
 * Sample parcels within ~850 m; derive design from subdivision fabric.
 */
export async function deriveDesignFromComps(
  lat: number,
  lng: number,
  county: string
): Promise<DesignParams | null> {
  const pattern = await scanNearbySubdivisions(lat, lng);
  if (!pattern) return null;

  const p = presetFor(county);
  const lotWidthFt = Math.max(40, pattern.medianFrontageFt);
  let lotDepthFt = Math.max(80, pattern.medianDepthFt);
  // Ensure product ≈ median acres
  const targetSq = pattern.medianLotAcres * 43560;
  if (lotWidthFt * lotDepthFt < targetSq * 0.85) {
    lotDepthFt = Math.round(targetSq / lotWidthFt);
  }

  // Prefer Hunter Chase long-narrow proportions when rural-scale lots
  const hc = longNarrowModule(pattern.medianLotAcres, {
    urban: p.urban,
    minFrontage: Math.min(lotWidthFt, p.urban ? 90 : 140),
  });
  return {
    lotWidthFt: p.urban ? lotWidthFt : hc.lotWidthFt,
    lotDepthFt: p.urban ? lotDepthFt : hc.lotDepthFt,
    rowFt: p.rowFt,
    pavementFt: p.pavementFt,
    nsStreets: 0, // optimizer decides cross streets from maxBlockFt
    perimFt: 28,
    source: 'nearby-subdivisions',
    sampleSize: pattern.sampleSize,
    medianLotAcres: pattern.medianLotAcres,
    maxBlockFt: pattern.maxBlockFt,
    preferredAxis: pattern.preferredAxis,
    layoutStyle: 'hunter_chase',
    culDeSacRadiusFt: 50,
  };
}

/** Learned design if comps available, else county preset. */
export async function bestDesign(
  lat: number | null | undefined,
  lng: number | null | undefined,
  county: string
): Promise<DesignParams> {
  if (lat != null && lng != null) {
    const learned = await deriveDesignFromComps(lat, lng, county);
    if (learned) return learned;
  }
  return defaultDesign(county);
}

export async function bestDesignWithPattern(
  lat: number | null | undefined,
  lng: number | null | undefined,
  county: string
): Promise<{ design: DesignParams; pattern: SubdivisionPattern | null }> {
  if (lat != null && lng != null) {
    const pattern = await scanNearbySubdivisions(lat, lng);
    if (pattern) {
      const p = presetFor(county);
      const lotWidthFt = Math.max(40, pattern.medianFrontageFt);
      let lotDepthFt = Math.max(80, pattern.medianDepthFt);
      const targetSq = pattern.medianLotAcres * 43560;
      if (lotWidthFt * lotDepthFt < targetSq * 0.85) {
        lotDepthFt = Math.round(targetSq / lotWidthFt);
      }
      const hc = longNarrowModule(pattern.medianLotAcres, {
        urban: p.urban,
        minFrontage: Math.min(lotWidthFt, p.urban ? 90 : 140),
      });
      return {
        design: {
          lotWidthFt: p.urban ? lotWidthFt : hc.lotWidthFt,
          lotDepthFt: p.urban ? lotDepthFt : hc.lotDepthFt,
          rowFt: p.rowFt,
          pavementFt: p.pavementFt,
          nsStreets: 0,
          perimFt: 28,
          source: 'nearby-subdivisions',
          sampleSize: pattern.sampleSize,
          medianLotAcres: pattern.medianLotAcres,
          maxBlockFt: pattern.maxBlockFt,
          preferredAxis: pattern.preferredAxis,
          layoutStyle: 'hunter_chase',
          culDeSacRadiusFt: 50,
        },
        pattern,
      };
    }
  }
  return { design: defaultDesign(county), pattern: null };
}
