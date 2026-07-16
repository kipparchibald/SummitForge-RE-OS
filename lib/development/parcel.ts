// lib/development/parcel.ts
// Fetches the REAL parcel boundary from the Idaho statewide parcel service (IDWR ArcGIS).
// Server-side (no CORS issues). Match by APN or by lat/lng point.

const REST = 'https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/MapServer/0/query';

export type LngLat = [number, number];
export interface ParcelHit { pin: string | null; county: string | null; ring: LngLat[]; }

async function q(params: Record<string, string>): Promise<any> {
  const res = await fetch(`${REST}?${new URLSearchParams(params)}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`parcel query ${res.status}`);
  return res.json();
}
function firstRing(gj: any): LngLat[] {
  const f = gj?.features?.[0];
  if (!f?.geometry) return [];
  const g = f.geometry;
  return g.type === 'Polygon' ? g.coordinates[0] : g.coordinates[0][0];
}

export async function parcelByPoint(lat: number, lng: number): Promise<ParcelHit | null> {
  const gj = await q({
    geometry: `${lng},${lat}`, geometryType: 'esriGeometryPoint', inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects', outFields: 'PIN,COUNTY',
    returnGeometry: 'true', outSR: '4326', f: 'geojson', resultRecordCount: '1',
  });
  const ring = firstRing(gj);
  if (!ring.length) return null;
  return { pin: gj.features[0].properties.PIN, county: gj.features[0].properties.COUNTY, ring };
}

export async function parcelByApn(apn: string): Promise<ParcelHit | null> {
  const clean = apn.replace(/[^A-Za-z0-9]/g, '');
  const gj = await q({
    where: `REPLACE(PIN,'-','') LIKE '%${clean}%'`, outFields: 'PIN,COUNTY',
    returnGeometry: 'true', outSR: '4326', f: 'geojson', resultRecordCount: '1',
  });
  const ring = firstRing(gj);
  if (!ring.length) return null;
  return { pin: gj.features[0].properties.PIN, county: gj.features[0].properties.COUNTY, ring };
}

export async function matchParcel(opts: { apn?: string | null; lat?: number | null; lng?: number | null }): Promise<ParcelHit | null> {
  if (opts.apn) { try { const p = await parcelByApn(opts.apn); if (p) return p; } catch { /* fall through */ } }
  if (opts.lat != null && opts.lng != null) return parcelByPoint(opts.lat, opts.lng);
  return null;
}
