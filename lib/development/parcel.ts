// lib/development/parcel.ts
// Idaho parcel identify: boundary (IDWR) + county ownership enrichment + verified acreage.
//
// Area accuracy notes (verified 2026-07 against IDWR PIN RP04N34E360000):
//   • Native service SR 102605/8826 (Idaho TM) is METERS → SHAPE.STArea() is m², NOT ft².
//   • Treating STArea as ft² understated acres by ~10.76× (51 ac vs ~552 ac).
//   • Authoritative display acres = geodesic area of the WGS84 ring, cross-checked vs
//     STArea(m²) and county ASR_ACRES / GISSQFT when available.

const IDWR_REST =
  'https://gis.idwr.idaho.gov/hosting/rest/services/Reference/Parcels/MapServer/0/query';

/** Statewide public assessor extract (subset of counties incl. Teton; not Jefferson/Madison/Bonneville). */
const PUBLIC_ID_CENTROIDS =
  'https://services1.arcgis.com/CNPdEkvnGl65jCX8/arcgis/rest/services/Public_Idaho_Parcels_/FeatureServer/0/query';

const BONNEVILLE_REST =
  'https://services2.arcgis.com/Xd5SMhLZ1h9t0F3b/arcgis/rest/services/Bonneville_Parcels_2025Apr/FeatureServer/0/query';

const MADISON_REST =
  'https://madison.rexburg.org/mrgis/rest/services/Data/Parcels/MapServer/0/query';

/** Jefferson County assessor property information (owner, values, zoning). Do NOT pass resultRecordCount — service rejects pagination. */
const JEFFERSON_PROPERTY_INFO =
  'https://gisportal.co.jefferson.id.us/archost/rest/services/Assessor/Property_Information/MapServer/0/query';

const SQ_M_PER_ACRE = 4046.8564224;
const SQ_FT_PER_ACRE = 43560;
const SQ_FT_PER_SQ_M = 10.76391041671;

export type LngLat = [number, number];

export type SizeSource =
  | 'geodesic_wgs84'
  | 'idwr_starea_m2'
  | 'assessor_legal_acres'
  | 'county_gis_sqft';

export interface SizeVerification {
  /** Recommended acres for UI / platting */
  acres: number;
  acresRounded: number;
  areaSqFt: number;
  areaSqM: number;
  /** Assessor legal acres when county layer provides ASR_ACRES */
  legalAcres: number | null;
  /** IDWR STArea interpreted as m² → acres */
  idwrStAreaAcres: number | null;
  /** Geodesic ring acres (primary GIS measure) */
  geodesicAcres: number;
  primarySource: SizeSource;
  /** |legal - gis| / gis when both exist */
  variancePct: number | null;
  /** true when sources agree within 5% or only one source */
  verified: boolean;
  notes: string[];
}

export interface OwnershipInfo {
  owner: string | null;
  owner2: string | null;
  mailingAddress: string | null;
  situsAddress: string | null;
  situsCity: string | null;
  landValue: number | null;
  improvementValue: number | null;
  totalValue: number | null;
  yearBuilt: number | null;
  improvements: string | null;
  legalDescription: string | null;
  assessmentCategory: string | null;
  /** County zoning when present (e.g. Madison ZONING) */
  zoning: string | null;
  source: string | null;
}

export interface ParcelHit {
  pin: string | null;
  county: string | null;
  owner: string | null;
  ring: LngLat[];
  rings: LngLat[][];
  acres: number | null;
  areaSqFt: number | null;
  perimeterFt: number | null;
  centroid: { lat: number; lng: number } | null;
  objectId: number | null;
  geojson: GeoJSON.Feature | null;
  raw: Record<string, unknown>;
  unavailable: string[];
  source: string;
  size: SizeVerification | null;
  ownership: OwnershipInfo | null;
}

async function arcgisQuery(url: string, params: Record<string, string>): Promise<any> {
  const res = await fetch(`${url}?${new URLSearchParams(params)}`, {
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SummitForge-RE-OS/1.0 (parcel-identify)',
    },
  });
  if (!res.ok) throw new Error(`GIS query ${res.status}`);
  return res.json();
}

function ringsFromGeoJsonFeature(f: any): LngLat[][] {
  if (!f?.geometry) return [];
  const g = f.geometry;
  if (g.type === 'Polygon') return [g.coordinates[0] as LngLat[]];
  if (g.type === 'MultiPolygon') {
    return (g.coordinates as number[][][][]).map((poly) => poly[0] as LngLat[]);
  }
  return [];
}

function ringsFromEsri(geom: any): LngLat[][] {
  if (!geom?.rings?.length) return [];
  return geom.rings.map((r: number[][]) => r.map(([x, y]) => [x, y] as LngLat));
}

function centroidOfRing(ring: LngLat[]): { lat: number; lng: number } | null {
  if (!ring.length) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const [lng, lat] of ring) {
    if (lng == null || lat == null) continue;
    sx += lng;
    sy += lat;
    n++;
  }
  if (!n) return null;
  return { lng: sx / n, lat: sy / n };
}

/** Spherical excess area (m²) for closed [lng,lat]° ring — accurate for tax lots. */
export function ringAreaSqMeters(ring: LngLat[]): number {
  if (ring.length < 3) return 0;
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    total += toRad(lng2 - lng1) * (2 + Math.sin(toRad(lat1)) + Math.sin(toRad(lat2)));
  }
  return Math.abs((total * R * R) / 2);
}

export function ringPerimeterMeters(ring: LngLat[]): number {
  if (ring.length < 2) return 0;
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 0; i < ring.length; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % ring.length];
    const φ1 = toRad(lat1);
    const φ2 = toRad(lat2);
    const Δφ = toRad(lat2 - lat1);
    const Δλ = toRad(lng2 - lng1);
    const a =
      Math.sin(Δφ / 2) ** 2 +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    total += 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  }
  return total;
}

function cleanOwner(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || /^null$/i.test(s) || s === 'Null' || s === 'None') return null;
  return s.replace(/\s+/g, ' ');
}

/** Collapse whitespace / pad-right assessor strings. */
function cleanAddrPart(raw: unknown): string | null {
  if (raw == null) return null;
  const s = String(raw).replace(/\s+/g, ' ').trim();
  if (!s || /^null$/i.test(s) || s === 'None' || s === '.' || s === '-') return null;
  return s;
}

/**
 * Build a single-line US mailing/situs address from parts.
 * Avoids "City, City" duplication when street already contains city.
 */
function formatAddress(parts: {
  street?: unknown;
  street2?: unknown;
  city?: unknown;
  state?: unknown;
  zip?: unknown;
}): string | null {
  const street = cleanAddrPart(parts.street);
  const street2 = cleanAddrPart(parts.street2);
  const city = cleanAddrPart(parts.city);
  let state = cleanAddrPart(parts.state);
  let zip = cleanAddrPart(parts.zip);
  if (zip) zip = zip.replace(/\s+/g, '').slice(0, 10);
  if (state && state.length > 2 && state.toUpperCase() === 'IDAHO') state = 'ID';
  if (state && state.length === 2) state = state.toUpperCase();

  const line1 = [street, street2].filter(Boolean).join(', ');
  if (!line1 && !city && !zip) return null;

  const upperLine = line1.toUpperCase();
  const cityAlready =
    city && upperLine.includes(city.toUpperCase().replace(/\s+/g, ' '));

  const tail: string[] = [];
  if (city && !cityAlready) tail.push(city);
  if (state && zip) tail.push(`${state} ${zip}`);
  else if (state) tail.push(state);
  else if (zip) tail.push(zip);

  if (!line1) return tail.join(', ') || null;
  if (!tail.length) return line1;
  return `${line1}, ${tail.join(', ')}`;
}

function num(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseFloat(String(raw).replace(/[^0-9.\-]/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Build verified size from ring + optional assessor / STArea.
 * Primary: geodesic WGS84. Legal acres from assessor preferred for “ownership acreage”
 * display when within 15% of GIS (otherwise show both).
 */
export function verifyParcelSize(
  rings: LngLat[][],
  opts?: {
    idwrStArea?: number | null;
    idwrStLength?: number | null;
    legalAcres?: number | null;
    countyGisSqFt?: number | null;
  }
): SizeVerification {
  const notes: string[] = [];
  const geodesicM2 = rings.reduce((s, r) => s + ringAreaSqMeters(r), 0);
  const geodesicAcres = geodesicM2 / SQ_M_PER_ACRE;
  const perimeterM = rings.reduce((s, r) => s + ringPerimeterMeters(r), 0);

  // IDWR SHAPE.STArea() is in native meter units (Idaho TM) — convert m² → acres
  let idwrStAreaAcres: number | null = null;
  if (opts?.idwrStArea != null && opts.idwrStArea > 0) {
    idwrStAreaAcres = opts.idwrStArea / SQ_M_PER_ACRE;
    const drift = Math.abs(idwrStAreaAcres - geodesicAcres) / Math.max(geodesicAcres, 1e-9);
    if (drift > 0.05) {
      notes.push(
        `IDWR STArea (${idwrStAreaAcres.toFixed(3)} ac as m²) differs from geodesic by ${(drift * 100).toFixed(1)}% — using geodesic for mapping.`
      );
    } else {
      notes.push('IDWR STArea (m²) agrees with geodesic acreage within 5%.');
    }
  }

  let countyGisAcres: number | null = null;
  if (opts?.countyGisSqFt != null && opts.countyGisSqFt > 0) {
    countyGisAcres = opts.countyGisSqFt / SQ_FT_PER_ACRE;
    notes.push(`County GIS area ${countyGisAcres.toFixed(3)} ac (from GISSQFT).`);
  }

  const legalAcres =
    opts?.legalAcres != null && opts.legalAcres > 0 ? opts.legalAcres : null;
  if (legalAcres != null) {
    notes.push(`Assessor legal acres (ASR_ACRES): ${legalAcres}.`);
  }

  // Choose primary display acres
  let acres = geodesicAcres;
  let primarySource: SizeSource = 'geodesic_wgs84';

  // Prefer legal acres when close to GIS (deeded size for marketing/offers)
  if (legalAcres != null && geodesicAcres > 0) {
    const v = Math.abs(legalAcres - geodesicAcres) / geodesicAcres;
    if (v <= 0.15) {
      acres = legalAcres;
      primarySource = 'assessor_legal_acres';
      notes.push('Using assessor legal acres (within 15% of GIS).');
    } else {
      notes.push(
        `Legal acres (${legalAcres}) differ from GIS (${geodesicAcres.toFixed(3)}) by ${(v * 100).toFixed(1)}% — GIS used for plat geometry; show both.`
      );
    }
  } else if (countyGisAcres != null && geodesicAcres > 0) {
    const v = Math.abs(countyGisAcres - geodesicAcres) / geodesicAcres;
    if (v <= 0.05) {
      acres = countyGisAcres;
      primarySource = 'county_gis_sqft';
    }
  }

  let variancePct: number | null = null;
  if (legalAcres != null && geodesicAcres > 0) {
    variancePct = Math.round(((legalAcres - geodesicAcres) / geodesicAcres) * 1000) / 10;
  }

  const verified =
    (legalAcres == null && idwrStAreaAcres == null) ||
    (legalAcres != null && Math.abs((legalAcres - geodesicAcres) / geodesicAcres) <= 0.05) ||
    (idwrStAreaAcres != null &&
      Math.abs((idwrStAreaAcres - geodesicAcres) / geodesicAcres) <= 0.05);

  if (verified) notes.push('Size cross-check: verified.');
  else notes.push('Size cross-check: review legal vs GIS if making an offer.');

  const areaSqM = acres * SQ_M_PER_ACRE;
  const areaSqFt = areaSqM * SQ_FT_PER_SQ_M;

  // silence unused — perimeter computed for callers via separate field
  void perimeterM;

  return {
    acres,
    acresRounded: Math.round(acres * 1000) / 1000,
    areaSqFt: Math.round(areaSqFt),
    areaSqM: Math.round(areaSqM),
    legalAcres,
    idwrStAreaAcres:
      idwrStAreaAcres != null ? Math.round(idwrStAreaAcres * 1000) / 1000 : null,
    geodesicAcres: Math.round(geodesicAcres * 1000) / 1000,
    primarySource,
    variancePct,
    verified,
    notes,
  };
}

function emptyOwnership(): OwnershipInfo {
  return {
    owner: null,
    owner2: null,
    mailingAddress: null,
    situsAddress: null,
    situsCity: null,
    landValue: null,
    improvementValue: null,
    totalValue: null,
    yearBuilt: null,
    improvements: null,
    legalDescription: null,
    assessmentCategory: null,
    zoning: null,
    source: null,
  };
}

/** Read Jefferson dotted attribute keys with fallbacks. */
function jeffAttr(attrs: Record<string, unknown>, field: string): unknown {
  return (
    attrs[`DBO.T_PARCEL.${field}`] ??
    attrs[`dbo.T_PARCEL.${field}`] ??
    attrs[field] ??
    attrs[`FABRICADMIN.Tax.${field}`]
  );
}

/** County assessor / public layer enrichment */
async function enrichOwnership(
  county: string | null,
  pin: string | null,
  centroid: { lat: number; lng: number } | null
): Promise<{ ownership: OwnershipInfo; legalAcres: number | null; countyGisSqFt: number | null }> {
  const c = (county || '').toLowerCase();
  try {
    if (c.includes('jefferson') && (centroid || pin)) {
      return await enrichJefferson(centroid, pin);
    }
    if (c.includes('bonneville') && centroid) {
      return await enrichBonneville(centroid, pin);
    }
    if (c.includes('madison') && centroid) {
      return await enrichMadison(centroid, pin);
    }
    // Teton + other public-layer counties
    if (centroid || pin) {
      return await enrichPublicIdaho(pin, centroid);
    }
  } catch (e) {
    console.warn('[parcel] ownership enrich failed', e);
  }
  return { ownership: emptyOwnership(), legalAcres: null, countyGisSqFt: null };
}

/**
 * Jefferson County Property Information MapServer.
 * Important: omit resultRecordCount (service returns 400 Pagination not supported).
 */
async function enrichJefferson(
  centroid: { lat: number; lng: number } | null,
  pin: string | null
): Promise<{ ownership: OwnershipInfo; legalAcres: number | null; countyGisSqFt: number | null }> {
  let attrs: Record<string, unknown> | null = null;

  if (pin) {
    const safe = pin.replace(/'/g, "''");
    const clean = pin.replace(/[^A-Za-z0-9]/g, '');
    try {
      const d = await arcgisQuery(JEFFERSON_PROPERTY_INFO, {
        where: `DBO.T_PARCEL.PIN='${safe}' OR FABRICADMIN.Tax.Name='${safe}' OR DBO.T_PARCEL.PIN LIKE '%${clean}%'`,
        outFields: '*',
        returnGeometry: 'false',
        f: 'json',
      });
      const feats = d.features || [];
      if (feats.length) {
        const exact = feats.find((f: any) => {
          const p = String(jeffAttr(f.attributes || {}, 'PIN') || f.attributes?.['FABRICADMIN.Tax.Name'] || '')
            .replace(/[^A-Za-z0-9]/g, '');
          return p === clean || p.includes(clean) || clean.includes(p);
        });
        attrs = (exact || feats[0]).attributes;
      }
    } catch (e) {
      console.warn('[parcel] Jefferson PIN query failed', e);
    }
  }

  if (!attrs && centroid) {
    // Tight envelope first, then slightly wider
    for (const pad of [0.00025, 0.0005, 0.001]) {
      try {
        const d = await arcgisQuery(JEFFERSON_PROPERTY_INFO, {
          geometry: `${centroid.lng - pad},${centroid.lat - pad},${centroid.lng + pad},${centroid.lat + pad}`,
          geometryType: 'esriGeometryEnvelope',
          inSR: '4326',
          spatialRel: 'esriSpatialRelIntersects',
          outFields: '*',
          returnGeometry: 'false',
          f: 'json',
        });
        const feats = d.features || [];
        if (feats.length) {
          // Prefer PIN match if we have one; else first feature
          if (pin) {
            const clean = pin.replace(/[^A-Za-z0-9]/g, '');
            const match = feats.find((f: any) => {
              const p = String(
                jeffAttr(f.attributes || {}, 'PIN') || f.attributes?.['FABRICADMIN.Tax.Name'] || ''
              ).replace(/[^A-Za-z0-9]/g, '');
              return p === clean || p.includes(clean) || clean.includes(p);
            });
            attrs = (match || feats[0]).attributes;
          } else {
            attrs = feats[0].attributes;
          }
          break;
        }
      } catch (e) {
        console.warn('[parcel] Jefferson envelope query failed', e);
      }
    }
  }

  if (!attrs) {
    return { ownership: emptyOwnership(), legalAcres: null, countyGisSqFt: null };
  }

  const owner = cleanOwner(jeffAttr(attrs, 'OWNER'));
  const owner2 = cleanOwner(jeffAttr(attrs, 'SECONDARY_OWNERS'));
  const mailCity = cleanAddrPart(jeffAttr(attrs, 'MAILADCITY'));
  const mailState = cleanAddrPart(jeffAttr(attrs, 'MAILADST')) || 'ID';
  const mailZip = cleanAddrPart(jeffAttr(attrs, 'MAILADZIP'));
  const propZip = cleanAddrPart(jeffAttr(attrs, 'PROPADZIP'));
  // Parcel (situs) address — PROPAD is street; city often only on mail when same as situs
  const situsStreet = cleanAddrPart(jeffAttr(attrs, 'PROPAD'));
  const situsAddress = formatAddress({
    street: situsStreet,
    city: mailCity, // Jefferson rarely has separate situs city
    state: 'ID',
    zip: propZip || mailZip,
  });
  const mailingAddress = formatAddress({
    street: jeffAttr(attrs, 'MAILAD1'),
    street2: jeffAttr(attrs, 'MAILAD2'),
    city: mailCity,
    state: mailState,
    zip: mailZip,
  });
  const legal = [jeffAttr(attrs, 'LEGAL1'), jeffAttr(attrs, 'LEGAL2'), jeffAttr(attrs, 'LEGAL3')]
    .map((x) => (x != null ? String(x).trim() : ''))
    .filter(Boolean)
    .join(' ')
    .trim();
  const cats = cleanOwner(jeffAttr(attrs, 'CATEGORIES'));
  const acresRaw = jeffAttr(attrs, 'ACRES');
  const legalAcres =
    typeof acresRaw === 'number'
      ? acresRaw
      : acresRaw != null
        ? num(String(acresRaw).replace(/[^0-9.]/g, ''))
        : null;

  const ownership: OwnershipInfo = {
    owner,
    owner2,
    mailingAddress,
    situsAddress,
    situsCity: mailCity,
    landValue: num(jeffAttr(attrs, 'VALUELND')),
    improvementValue: num(jeffAttr(attrs, 'VALUEIMP')),
    totalValue: num(jeffAttr(attrs, 'VALUETOT')),
    yearBuilt: null,
    improvements: cats,
    legalDescription: legal || null,
    assessmentCategory: cats,
    zoning: cleanOwner(jeffAttr(attrs, 'ZONING')),
    source: 'Jefferson County Property Information (assessor)',
  };

  return { ownership, legalAcres, countyGisSqFt: null };
}

async function enrichPublicIdaho(
  pin: string | null,
  centroid: { lat: number; lng: number } | null
): Promise<{ ownership: OwnershipInfo; legalAcres: number | null; countyGisSqFt: number | null }> {
  let attrs: Record<string, unknown> | null = null;

  if (pin) {
    const safe = pin.replace(/'/g, "''");
    const d = await arcgisQuery(PUBLIC_ID_CENTROIDS, {
      where: `PARCEL_ID='${safe}' OR PARCEL_ID LIKE '%${safe.replace(/[^A-Za-z0-9]/g, '')}%'`,
      outFields: '*',
      returnGeometry: 'false',
      f: 'json',
      resultRecordCount: '3',
    });
    const feats = d.features || [];
    if (feats.length) {
      const exact = feats.find(
        (f: any) =>
          String(f.attributes?.PARCEL_ID || '').replace(/[^A-Za-z0-9]/g, '') ===
          pin.replace(/[^A-Za-z0-9]/g, '')
      );
      attrs = (exact || feats[0]).attributes;
    }
  }

  if (!attrs && centroid) {
    const pad = 0.0004;
    const d = await arcgisQuery(PUBLIC_ID_CENTROIDS, {
      geometry: `${centroid.lng - pad},${centroid.lat - pad},${centroid.lng + pad},${centroid.lat + pad}`,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'json',
      resultRecordCount: '10',
    });
    const feats = d.features || [];
    if (feats.length) {
      // nearest centroid
      let best = feats[0];
      let bestD = Infinity;
      for (const f of feats) {
        const g = f.geometry;
        if (!g) continue;
        const dx = (g.x ?? g.longitude) - centroid.lng;
        const dy = (g.y ?? g.latitude) - centroid.lat;
        const dist = dx * dx + dy * dy;
        if (dist < bestD) {
          bestD = dist;
          best = f;
        }
      }
      attrs = best.attributes;
    }
  }

  if (!attrs) {
    return { ownership: emptyOwnership(), legalAcres: null, countyGisSqFt: null };
  }

  const owner = cleanOwner(attrs.OWNER1);
  const owner2 = cleanOwner(attrs.OWNER2);
  const siteCity = cleanAddrPart(attrs.SITE_CITY);
  const mailingAddress = formatAddress({
    street: attrs.MAIL_ADD1,
    street2: attrs.MAIL_ADD2,
    city: attrs.MAIL_CITY,
    state: attrs.MAIL_STATE || 'ID',
    zip: attrs.MAIL_ZIP,
  });
  const situsAddress = formatAddress({
    street: attrs.SITE_ADD,
    city: siteCity,
    state: 'ID',
    zip: attrs.SITE_ZIP,
  });
  const ownership: OwnershipInfo = {
    owner,
    owner2,
    mailingAddress,
    situsAddress,
    situsCity: siteCity,
    landValue: num(attrs.VAL_LAND),
    improvementValue: num(attrs.VAL_IMPVTS),
    totalValue: num(attrs.VAL_TOTAL),
    yearBuilt: null,
    improvements:
      num(attrs.VAL_IMPVTS) != null && (num(attrs.VAL_IMPVTS) || 0) > 0
        ? 'Improved (assessor VAL_IMPVTS)'
        : null,
    legalDescription: cleanOwner(attrs.LGL_DESCR),
    assessmentCategory: cleanOwner(attrs.ASR_CATS),
    zoning: null,
    source: 'Idaho public parcels (assessor extract)',
  };
  return {
    ownership,
    legalAcres: num(attrs.ASR_ACRES),
    countyGisSqFt: null,
  };
}

async function enrichBonneville(
  centroid: { lat: number; lng: number },
  pin: string | null
): Promise<{ ownership: OwnershipInfo; legalAcres: number | null; countyGisSqFt: number | null }> {
  const pad = 0.00035;
  const d = await arcgisQuery(BONNEVILLE_REST, {
    geometry: `${centroid.lng - pad},${centroid.lat - pad},${centroid.lng + pad},${centroid.lat + pad}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields:
      'parcelnumb,owner,additional,owneraddre,ownercity,ownerstate,ownerzipco,parceladdr,parcelcity,parcelzipc,landvalue,yearbuilto,animprovem,valueofabo,legaldescr,propertyde',
    returnGeometry: 'false',
    f: 'json',
    resultRecordCount: '15',
  });
  const feats = d.features || [];
  if (!feats.length) {
    return { ownership: emptyOwnership(), legalAcres: null, countyGisSqFt: null };
  }

  let attrs = feats[0].attributes;
  if (pin) {
    const clean = pin.replace(/[^A-Za-z0-9]/g, '');
    const match = feats.find((f: any) => {
      const p = String(f.attributes?.parcelnumb || '').replace(/[^A-Za-z0-9]/g, '');
      return p === clean || p.includes(clean) || clean.includes(p);
    });
    if (match) attrs = match.attributes;
  }

  const situsCity = cleanAddrPart(attrs.parcelcity);
  const mailingAddress = formatAddress({
    street: attrs.owneraddre,
    city: attrs.ownercity,
    state: attrs.ownerstate || 'ID',
    zip: attrs.ownerzipco,
  });
  const situsAddress = formatAddress({
    street: attrs.parceladdr,
    city: situsCity,
    state: 'ID',
    zip: attrs.parcelzipc,
  });

  const ownership: OwnershipInfo = {
    owner: cleanOwner(attrs.owner),
    owner2: cleanOwner(attrs.additional),
    mailingAddress,
    situsAddress,
    situsCity,
    landValue: num(attrs.landvalue),
    improvementValue: num(attrs.valueofabo),
    totalValue:
      num(attrs.landvalue) != null || num(attrs.valueofabo) != null
        ? (num(attrs.landvalue) || 0) + (num(attrs.valueofabo) || 0)
        : null,
    yearBuilt: (() => {
      const y = num(attrs.yearbuilto);
      return y != null && y >= 1800 && y <= 2100 ? Math.round(y) : null;
    })(),
    improvements: cleanOwner(attrs.animprovem),
    legalDescription: cleanOwner(attrs.legaldescr),
    assessmentCategory: cleanOwner(attrs.propertyde),
    zoning: null,
    source: 'Bonneville County parcels (assessor)',
  };
  // Treat zero land value as missing when clearly placeholder
  if (ownership.landValue === 0 && ownership.improvementValue === 0) {
    ownership.landValue = null;
    ownership.improvementValue = null;
    ownership.totalValue = null;
  }
  return { ownership, legalAcres: null, countyGisSqFt: null };
}

async function enrichMadison(
  centroid: { lat: number; lng: number },
  pin: string | null
): Promise<{ ownership: OwnershipInfo; legalAcres: number | null; countyGisSqFt: number | null }> {
  const pad = 0.0004;
  const d = await arcgisQuery(MADISON_REST, {
    geometry: `${centroid.lng - pad},${centroid.lat - pad},${centroid.lng + pad},${centroid.lat + pad}`,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'false',
    f: 'json',
    resultRecordCount: '15',
  });
  const feats = d.features || [];
  if (!feats.length) {
    return { ownership: emptyOwnership(), legalAcres: null, countyGisSqFt: null };
  }

  let attrs = feats[0].attributes;
  if (pin) {
    const clean = pin.replace(/[^A-Za-z0-9]/g, '');
    const match = feats.find((f: any) => {
      const p = String(f.attributes?.PARCEL_ID || '').replace(/[^A-Za-z0-9]/g, '');
      return p === clean || p.includes(clean) || clean.includes(p);
    });
    if (match) attrs = match.attributes;
  }

  const mail = formatAddress({
    street: attrs.MAIL_ADD1,
    street2: attrs.MAIL_ADD2,
    city: attrs.MAIL_CITY,
    state: attrs.MAIL_STATE || 'ID',
    zip: attrs.MAIL_ZIP,
  });
  const siteCity = cleanAddrPart(attrs.SITE_CITY);
  const situsAddress = formatAddress({
    street: attrs.SITE_ADD || attrs.LOCATION,
    city: siteCity,
    state: 'ID',
    zip: attrs.SITE_ZIP,
  });

  // Assessment category labels + net values (Idaho schedule codes)
  const catParts: string[] = [];
  let landNet = 0;
  let impNet = 0;
  let hasLandNet = false;
  let hasImpNet = false;
  for (let i = 1; i <= 13; i++) {
    const catKey = `CATEGORY${i}`;
    // Madison field naming is uneven past C9
    const acKey =
      i === 11 ? 'CAT11_AC' : i === 12 ? 'C12_AC' : i === 13 ? 'C13_AC' : `C${i}_ACRES`;
    const vlKey = `C${i}_NET_VL`;
    const label = attrs[catKey] != null ? String(attrs[catKey]).trim() : '';
    const vl = num(attrs[vlKey]);
    if (!label && (vl == null || vl === 0)) continue;
    if (label) {
      catParts.push(vl != null && vl > 0 ? `${label} ($${Math.round(vl).toLocaleString()})` : label);
      const low = label.toLowerCase();
      // Rough split: pure land / ag categories vs improvements
      if (/improv|resid|dwell|home|build|struct|comm|indust/i.test(low)) {
        if (vl != null) {
          impNet += vl;
          hasImpNet = true;
        }
      } else if (/land|ag\b|irrig|dry|waste|timber|range|vacant|bare/i.test(low) || num(attrs[acKey])) {
        if (vl != null) {
          landNet += vl;
          hasLandNet = true;
        }
      } else if (vl != null) {
        // Unknown category — count toward improvements if value with no acres
        const ac = num(attrs[acKey]);
        if (ac != null && ac > 0) {
          landNet += vl;
          hasLandNet = true;
        } else {
          impNet += vl;
          hasImpNet = true;
        }
      }
    }
  }
  const cats =
    catParts.join(' · ') ||
    [attrs.CATEGORY1, attrs.CATEGORY2, attrs.DESC1]
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter(Boolean)
      .join(' · ');

  // Year built sometimes buried in legal/desc text
  let yearBuilt: number | null = null;
  const descBlob = [attrs.DESC1, attrs.DESC2, attrs.DESC3, attrs.DESC4, attrs.DESC5]
    .map((x) => (x != null ? String(x) : ''))
    .join(' ');
  const yMatch = descBlob.match(
    /\b(?:built|yr|year|const(?:ructed)?\.?)\s*[:\s]?(?:in\s+)?(18|19|20)\d{2}\b/i
  );
  if (yMatch) {
    const y = parseInt(yMatch[0].replace(/\D/g, '').slice(-4), 10);
    if (y >= 1800 && y <= 2100) yearBuilt = y;
  } else {
    const bare = descBlob.match(/\b(19\d{2}|20[0-2]\d)\b/);
    if (bare && /built|home|house|dwelling|residence/i.test(descBlob)) {
      yearBuilt = parseInt(bare[1], 10);
    }
  }

  const totalValue = num(attrs.TOT_VALUE);
  const ownership: OwnershipInfo = {
    owner: cleanOwner(attrs.OWNER1),
    owner2: cleanOwner(attrs.OWNER2),
    mailingAddress: mail,
    situsAddress,
    situsCity: siteCity,
    landValue: hasLandNet && landNet > 0 ? Math.round(landNet) : null,
    improvementValue: hasImpNet && impNet > 0 ? Math.round(impNet) : null,
    totalValue,
    yearBuilt,
    improvements: cats || null,
    legalDescription: [attrs.DESC1, attrs.DESC2, attrs.DESC3]
      .map((x) => (x != null ? String(x).trim() : ''))
      .filter(Boolean)
      .join(' ')
      .trim() || null,
    assessmentCategory: cats || null,
    zoning: cleanOwner(attrs.ZONING),
    source: 'Madison County parcels (Rexburg MRGIS)',
  };

  return {
    ownership,
    legalAcres: num(attrs.ASR_ACRES),
    countyGisSqFt: num(attrs.GISSQFT),
  };
}

function featureToHit(f: any, source: string): ParcelHit | null {
  if (!f) return null;

  let rings: LngLat[][] = [];
  let props: Record<string, unknown> = {};
  if (f.type === 'Feature' || f.geometry?.type) {
    rings = ringsFromGeoJsonFeature(f);
    props = f.properties || {};
  } else if (f.geometry || f.attributes) {
    rings = ringsFromEsri(f.geometry);
    props = f.attributes || {};
  } else {
    return null;
  }

  if (!rings.length || rings[0].length < 3) return null;

  const ring = rings[0];
  const stArea = num(props['SHAPE.STArea()'] ?? props['Shape.STArea()'] ?? props.SHAPE_STArea);
  const stLen = num(props['SHAPE.STLength()'] ?? props['Shape.STLength()']);

  // Size without county yet — will re-verify after enrich
  const size = verifyParcelSize(rings, {
    idwrStArea: stArea,
    idwrStLength: stLen,
  });

  const pin = props.PIN != null ? String(props.PIN) : null;
  const county = props.COUNTY != null ? String(props.COUNTY) : null;
  const owner = cleanOwner(props.OWNER);
  const centroid = centroidOfRing(ring);
  const perimeterFt = Math.round(
    rings.reduce((s, r) => s + ringPerimeterMeters(r), 0) * 3.280839895
  );

  const geojson: GeoJSON.Feature = {
    type: 'Feature',
    properties: {
      pin,
      county,
      owner,
      acres: size.acresRounded,
      areaSqFt: size.areaSqFt,
      sizeVerified: size.verified,
    },
    geometry:
      rings.length === 1
        ? { type: 'Polygon', coordinates: rings }
        : { type: 'MultiPolygon', coordinates: rings.map((r) => [r]) },
  };

  return {
    pin,
    county,
    owner,
    ring,
    rings,
    acres: size.acresRounded,
    areaSqFt: size.areaSqFt,
    perimeterFt,
    centroid,
    objectId: props.OBJECTID != null ? Number(props.OBJECTID) : null,
    geojson,
    raw: props,
    unavailable: [],
    source,
    size,
    ownership: owner
      ? {
          ...emptyOwnership(),
          owner,
          source: 'IDWR statewide (OWNER field)',
        }
      : null,
  };
}

async function finalizeHit(hit: ParcelHit): Promise<ParcelHit> {
  const { ownership, legalAcres, countyGisSqFt } = await enrichOwnership(
    hit.county,
    hit.pin,
    hit.centroid
  );

  const stArea = num(hit.raw['SHAPE.STArea()'] ?? hit.raw['Shape.STArea()']);
  const size = verifyParcelSize(hit.rings, {
    idwrStArea: stArea,
    legalAcres,
    countyGisSqFt,
  });

  // Prefer county ownership over blank IDWR OWNER
  const mergedOwner = ownership.owner || hit.owner;
  const ownershipOut: OwnershipInfo = {
    ...ownership,
    owner: mergedOwner,
    source:
      ownership.source ||
      (hit.owner ? 'IDWR statewide (OWNER field)' : null),
  };

  const unavailable: string[] = [];
  if (!mergedOwner) unavailable.push('owner');
  if (ownershipOut.yearBuilt == null) unavailable.push('yearBuilt');
  if (!ownershipOut.improvements) unavailable.push('improvements');
  if (ownershipOut.totalValue == null && ownershipOut.landValue == null)
    unavailable.push('assessedValue');
  if (!ownershipOut.situsAddress) unavailable.push('parcelAddress');
  if (!ownershipOut.mailingAddress) unavailable.push('mailingAddress');

  const geojson: GeoJSON.Feature | null = hit.geojson
    ? {
        ...hit.geojson,
        properties: {
          ...hit.geojson.properties,
          owner: mergedOwner,
          acres: size.acresRounded,
          areaSqFt: size.areaSqFt,
          legalAcres: size.legalAcres,
          sizeVerified: size.verified,
          situsAddress: ownershipOut.situsAddress,
          mailingAddress: ownershipOut.mailingAddress,
          parcelAddress: ownershipOut.situsAddress,
        },
      }
    : null;

  return {
    ...hit,
    owner: mergedOwner,
    acres: size.acresRounded,
    areaSqFt: size.areaSqFt,
    size,
    ownership: ownershipOut,
    unavailable,
    geojson,
    source: ownershipOut.source
      ? `${hit.source} + ${ownershipOut.source}`
      : hit.source,
  };
}

export async function parcelByPoint(lat: number, lng: number): Promise<ParcelHit | null> {
  const pad = 0.00035;
  const envelope = `${lng - pad},${lat - pad},${lng + pad},${lat + pad}`;

  const gj = await arcgisQuery(IDWR_REST, {
    geometry: envelope,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: '25',
  });

  let features: any[] = gj?.features || [];
  if (!features.length) {
    const pad2 = 0.001;
    const env2 = `${lng - pad2},${lat - pad2},${lng + pad2},${lat + pad2}`;
    const gj2 = await arcgisQuery(IDWR_REST, {
      geometry: env2,
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: 'true',
      outSR: '4326',
      f: 'geojson',
      resultRecordCount: '40',
    });
    features = gj2?.features || [];
    if (!features.length) return null;
    const hit = pickBestParcel(features, lat, lng, 'idwr-parcels-envelope-wide');
    return hit ? finalizeHit(hit) : null;
  }

  const hit = pickBestParcel(features, lat, lng, 'idwr-parcels-envelope');
  return hit ? finalizeHit(hit) : null;
}

function pickBestParcel(
  features: any[],
  lat: number,
  lng: number,
  source: string
): ParcelHit | null {
  const hits = features.map((f) => featureToHit(f, source)).filter(Boolean) as ParcelHit[];
  if (!hits.length) return null;

  const containing = hits.filter((h) => pointInRing(lng, lat, h.ring));
  const pool = containing.length ? containing : hits;
  pool.sort((a, b) => (a.acres ?? 1e12) - (b.acres ?? 1e12));
  return pool[0];
}

function pointInRing(x: number, y: number, ring: LngLat[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export async function parcelByApn(apn: string): Promise<ParcelHit | null> {
  const clean = apn.replace(/[^A-Za-z0-9]/g, '');
  if (!clean) return null;
  const safe = clean.replace(/'/g, "''");

  const gj = await arcgisQuery(IDWR_REST, {
    where: `PIN LIKE '%${safe}%'`,
    outFields: '*',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: '8',
  });

  const features: any[] = gj?.features || [];
  if (!features.length) return null;

  const exact = features.find((f) => {
    const pin = String(f.properties?.PIN || '').replace(/[^A-Za-z0-9]/g, '');
    return pin === clean || pin.endsWith(clean) || clean.endsWith(pin);
  });
  const hit = featureToHit(exact || features[0], 'idwr-parcels-pin');
  return hit ? finalizeHit(hit) : null;
}

export async function parcelsInEnvelope(
  west: number,
  south: number,
  east: number,
  north: number,
  limit = 80
): Promise<GeoJSON.FeatureCollection> {
  const envelope = `${west},${south},${east},${north}`;
  const gj = await arcgisQuery(IDWR_REST, {
    geometry: envelope,
    geometryType: 'esriGeometryEnvelope',
    inSR: '4326',
    spatialRel: 'esriSpatialRelIntersects',
    outFields: 'PIN,COUNTY,OWNER,OBJECTID',
    returnGeometry: 'true',
    outSR: '4326',
    f: 'geojson',
    resultRecordCount: String(Math.min(limit, 200)),
  });

  return {
    type: 'FeatureCollection',
    features: (gj?.features || []).map((f: any) => ({
      type: 'Feature' as const,
      properties: {
        pin: f.properties?.PIN,
        county: f.properties?.COUNTY,
        owner: cleanOwner(f.properties?.OWNER),
      },
      geometry: f.geometry,
    })),
  };
}

export async function matchParcel(opts: {
  apn?: string | null;
  lat?: number | null;
  lng?: number | null;
}): Promise<ParcelHit | null> {
  if (opts.apn) {
    try {
      const p = await parcelByApn(opts.apn);
      if (p) return p;
    } catch {
      /* fall through */
    }
  }
  if (opts.lat != null && opts.lng != null) return parcelByPoint(opts.lat, opts.lng);
  return null;
}

export function parcelToDto(p: ParcelHit) {
  const o = p.ownership;
  const assessed =
    o?.totalValue ??
    (o?.landValue != null || o?.improvementValue != null
      ? (o?.landValue || 0) + (o?.improvementValue || 0)
      : null);
  return {
    pin: p.pin,
    county: p.county,
    owner: p.owner,
    owner2: o?.owner2 ?? null,
    acres: p.acres,
    areaSqFt: p.areaSqFt,
    perimeterFt: p.perimeterFt,
    centroid: p.centroid,
    objectId: p.objectId,
    ring: p.ring,
    rings: p.rings,
    geojson: p.geojson,
    source: p.source,
    unavailable: p.unavailable,
    size: p.size,
    ownership: o,
    yearBuilt: o?.yearBuilt ?? null,
    improvements: o?.improvements ?? null,
    assessedValue: assessed,
    landValue: o?.landValue ?? null,
    improvementValue: o?.improvementValue ?? null,
    /** Full parcel / situs (property) address */
    parcelAddress: o?.situsAddress ?? null,
    situsAddress: o?.situsAddress ?? null,
    situsCity: o?.situsCity ?? null,
    /** Owner mailing address (tax bill) */
    mailingAddress: o?.mailingAddress ?? null,
    legalDescription: o?.legalDescription ?? null,
    landUse: o?.assessmentCategory ?? null,
    zoning: o?.zoning ?? null,
    notes: [
      p.size?.notes.join(' ') || '',
      o?.source
        ? `Ownership from ${o.source}.`
        : 'Ownership not found on county layer — IDWR OWNER is often blank for Eastern Idaho.',
      'Boundary geometry from Idaho statewide parcels (IDWR).',
      'County ownership: Jefferson (Property Information), Madison (MRGIS), Bonneville assessor, Public Idaho extract (Teton+).',
      'LLC/corp owners can be resolved against Idaho SOSBiz for members/managers.',
      'Use Send to CMA to apply year built, assessed value, and ownership to the CMA subject.',
    ]
      .filter(Boolean)
      .join(' '),
  };
}
