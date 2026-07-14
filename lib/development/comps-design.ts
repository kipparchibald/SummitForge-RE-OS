// lib/development/comps-design.ts
// Learns plat design parameters (lot size, width, yield pattern) from REAL nearby
// subdivisions by sampling developed-size parcels around the subject from GIS,
// then hands them to the plat engine. Falls back to null (→ county preset) when thin.

import { presetFor } from './land-engine';
import { defaultDesign, type DesignParams } from './plat-geometry';

const REST = 'https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/MapServer/0/query';
const FT_PER_DEG_LAT = 364320;

function median(a: number[]): number {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function ringOf(f: any): number[][] {
  const g = f?.geometry; if (!g) return [];
  return g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
}

/**
 * Sample parcels within ~650 m of (lat,lng); treat 0.1–2.0 ac parcels as nearby
 * subdivision lots and derive median lot acreage + frontage width.
 */
export async function deriveDesignFromComps(lat: number, lng: number, county: string): Promise<DesignParams | null> {
  const d = 0.006; // ~650 m
  const params = {
    geometry: `${lng - d},${lat - d},${lng + d},${lat + d}`,
    geometryType: 'esriGeometryEnvelope', inSR: '4326', spatialRel: 'esriSpatialRelIntersects',
    outFields: 'PIN', returnGeometry: 'true', outSR: '4326', f: 'geojson', resultRecordCount: '400',
  };
  let gj: any;
  try {
    const res = await fetch(`${REST}?${new URLSearchParams(params)}`, { cache: 'no-store' });
    if (!res.ok) return null;
    gj = await res.json();
  } catch { return null; }

  const kx = Math.cos((lat * Math.PI) / 180) * FT_PER_DEG_LAT, ky = FT_PER_DEG_LAT;
  const acresArr: number[] = [], widthArr: number[] = [];
  for (const f of gj.features || []) {
    const ring = ringOf(f);
    if (ring.length < 3) continue;
    const pts = ring.map((p: number[]) => [(p[0] - lng) * kx, (p[1] - lat) * ky]);
    let a = 0, minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (let i = 0; i < pts.length; i++) {
      const p1 = pts[i], p2 = pts[(i + 1) % pts.length];
      a += p1[0] * p2[1] - p2[0] * p1[1];
      minx = Math.min(minx, p1[0]); maxx = Math.max(maxx, p1[0]);
      miny = Math.min(miny, p1[1]); maxy = Math.max(maxy, p1[1]);
    }
    const acres = Math.abs(a) / 2 / 43560;
    if (acres < 0.1 || acres > 2.0) continue; // developed-lot band
    acresArr.push(acres);
    widthArr.push(Math.min(maxx - minx, maxy - miny)); // shorter side ≈ street frontage
  }

  if (acresArr.length < 8) return null; // not enough comparable lots → use preset

  const medAcres = median(acresArr);
  const medWidth = Math.max(40, Math.round(median(widthArr)));
  const lotDepthFt = Math.max(80, Math.round((medAcres * 43560) / medWidth));
  const p = presetFor(county);
  return {
    lotWidthFt: medWidth,
    lotDepthFt,
    rowFt: p.rowFt,          // adopted county standard (Jefferson: 60' ROW); not derivable from lot polygons
    pavementFt: p.pavementFt, // Jefferson: 30' road
    nsStreets: 1,
    perimFt: 40,
    source: 'nearby-subdivisions',
    sampleSize: acresArr.length,
    medianLotAcres: +medAcres.toFixed(3),
  };
}

/** Learned design if comps are available, else the county preset default. */
export async function bestDesign(lat: number | null | undefined, lng: number | null | undefined, county: string): Promise<DesignParams> {
  if (lat != null && lng != null) {
    const learned = await deriveDesignFromComps(lat, lng, county);
    if (learned) return learned;
  }
  return defaultDesign(county);
}
