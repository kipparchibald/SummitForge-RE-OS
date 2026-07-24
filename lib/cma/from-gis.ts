/**
 * GIS parcel → CMA subject handoff.
 * Persists assessor details (year built, assessed values, ownership, size)
 * from the monitoring map selection into the CMA builder.
 */

import type { SubjectProperty } from '@/lib/cma/engine';

export const CMA_GIS_STORAGE_KEY = 'summitforge_cma_gis_subject';

/** Mapbox basemap preference carried with the parcel handoff. */
export type GisMapBasemap = 'aerial' | 'hybrid' | 'streets';

/** Full assessor / GIS snapshot applied as CMA subject context. */
export type GisCmaHandoff = {
  savedAt: string;
  pin: string | null;
  county: string | null;
  owner: string | null;
  owner2: string | null;
  /** Parcel / property (situs) address */
  situsAddress: string | null;
  parcelAddress: string | null;
  situsCity: string | null;
  /** Owner mailing / tax-bill address */
  mailingAddress: string | null;
  acres: number | null;
  areaSqFt: number | null;
  yearBuilt: number | null;
  improvements: string | null;
  /** Total assessed (land + improvements when available) */
  assessedValue: number | null;
  landValue: number | null;
  improvementValue: number | null;
  legalDescription: string | null;
  landUse: string | null;
  zoning: string | null;
  lat: number | null;
  lng: number | null;
  sizeVerified: boolean | null;
  sizePrimarySource: string | null;
  notes: string;
  source: string;
  /** Outer ring [lng, lat][] for parcel map */
  ring: [number, number][] | null;
  /** Full GeoJSON feature (boundary + props) for Mapbox Source */
  geojson: GeoJSON.Feature | null;
  /** Default basemap when opening CMA map — aerial photo */
  mapBasemap: GisMapBasemap;
};

export const MAPBOX_STYLES: Record<GisMapBasemap, string> = {
  aerial: 'mapbox://styles/mapbox/satellite-v9',
  hybrid: 'mapbox://styles/mapbox/satellite-streets-v12',
  streets: 'mapbox://styles/mapbox/streets-v12',
};

/** Shape accepted from /api/gis/parcel DTO or monitoring GisParcel. */
export type GisParcelLike = {
  pin?: string | null;
  county?: string | null;
  owner?: string | null;
  owner2?: string | null;
  acres?: number | null;
  areaSqFt?: number | null;
  yearBuilt?: number | null;
  improvements?: string | null;
  assessedValue?: number | null;
  landValue?: number | null;
  improvementValue?: number | null;
  parcelAddress?: string | null;
  situsAddress?: string | null;
  mailingAddress?: string | null;
  legalDescription?: string | null;
  landUse?: string | null;
  zoning?: string | null;
  notes?: string;
  source?: string;
  centroid?: { lat: number; lng: number } | null;
  ring?: [number, number][] | null;
  rings?: [number, number][][] | null;
  geojson?: GeoJSON.Feature | null;
  size?: {
    verified?: boolean;
    primarySource?: string;
  } | null;
  ownership?: {
    owner?: string | null;
    owner2?: string | null;
    mailingAddress?: string | null;
    situsAddress?: string | null;
    situsCity?: string | null;
    landValue?: number | null;
    improvementValue?: number | null;
    totalValue?: number | null;
    yearBuilt?: number | null;
    improvements?: string | null;
    legalDescription?: string | null;
    assessmentCategory?: string | null;
    source?: string | null;
  } | null;
};

/** Build a minimal Feature from a ring when API geojson is missing. */
export function ringToFeature(
  ring: [number, number][] | null | undefined,
  props: Record<string, unknown> = {}
): GeoJSON.Feature | null {
  if (!ring || ring.length < 3) return null;
  let closed = ring;
  const [a0, a1] = ring[0];
  const [b0, b1] = ring[ring.length - 1];
  if (a0 !== b0 || a1 !== b1) {
    closed = [...ring, ring[0]];
  }
  return {
    type: 'Feature',
    properties: props,
    geometry: { type: 'Polygon', coordinates: [closed] },
  };
}

export function boundsFromRing(
  ring: [number, number][]
): [[number, number], [number, number]] | null {
  if (!ring.length) return null;
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  for (const [lng, lat] of ring) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    minLng = Math.min(minLng, lng);
    minLat = Math.min(minLat, lat);
    maxLng = Math.max(maxLng, lng);
    maxLat = Math.max(maxLat, lat);
  }
  if (!Number.isFinite(minLng)) return null;
  const padLng = Math.max((maxLng - minLng) * 0.2, 0.0004);
  const padLat = Math.max((maxLat - minLat) * 0.2, 0.0003);
  return [
    [minLng - padLng, minLat - padLat],
    [maxLng + padLng, maxLat + padLat],
  ];
}

export function parcelToGisHandoff(p: GisParcelLike): GisCmaHandoff {
  const o = p.ownership;
  const landValue = p.landValue ?? o?.landValue ?? null;
  const improvementValue = p.improvementValue ?? o?.improvementValue ?? null;
  const assessedValue =
    p.assessedValue ??
    o?.totalValue ??
    (landValue != null || improvementValue != null
      ? (landValue || 0) + (improvementValue || 0)
      : null);

  const ring =
    p.ring && p.ring.length >= 3
      ? (p.ring.map(([lng, lat]) => [lng, lat] as [number, number]) as [number, number][])
      : null;
  const geojson =
    p.geojson ||
    ringToFeature(ring, {
      pin: p.pin,
      county: p.county,
      owner: p.owner ?? o?.owner,
      acres: p.acres,
      yearBuilt: p.yearBuilt ?? o?.yearBuilt,
      assessedValue,
    });

  return {
    savedAt: new Date().toISOString(),
    pin: p.pin ?? null,
    county: p.county ?? null,
    owner: p.owner ?? o?.owner ?? null,
    owner2: p.owner2 ?? o?.owner2 ?? null,
    situsAddress:
      p.parcelAddress ?? p.situsAddress ?? o?.situsAddress ?? null,
    parcelAddress:
      p.parcelAddress ?? p.situsAddress ?? o?.situsAddress ?? null,
    situsCity: o?.situsCity ?? null,
    mailingAddress: p.mailingAddress ?? o?.mailingAddress ?? null,
    acres: p.acres ?? null,
    areaSqFt: p.areaSqFt ?? null,
    yearBuilt: p.yearBuilt ?? o?.yearBuilt ?? null,
    improvements: p.improvements ?? o?.improvements ?? o?.assessmentCategory ?? null,
    assessedValue,
    landValue,
    improvementValue,
    legalDescription: p.legalDescription ?? o?.legalDescription ?? null,
    landUse: p.landUse ?? o?.assessmentCategory ?? null,
    zoning: p.zoning ?? null,
    lat: p.centroid?.lat ?? null,
    lng: p.centroid?.lng ?? null,
    sizeVerified: p.size?.verified ?? null,
    sizePrimarySource: p.size?.primarySource ?? null,
    notes: p.notes || '',
    source: p.source || o?.source || 'GIS parcel',
    ring,
    geojson,
    /** Aerial photo is the default basemap for CMA parcel import */
    mapBasemap: 'aerial',
  };
}

/**
 * Classify residential house vs vacant land from assessor signals.
 * Year built alone is not enough (commercial can have year built);
 * DWELL / improvement value / residential category drive Single Family.
 */
export function inferPropertyTypeFromGis(h: GisCmaHandoff): string {
  const impVal = h.improvementValue;
  const impKnown = impVal != null;
  const impPositive = (impVal ?? 0) >= 5_000;
  const hasYear = h.yearBuilt != null && h.yearBuilt >= 1800 && h.yearBuilt <= 2100;
  const text = `${h.improvements || ''} ${h.landUse || ''} ${h.zoning || ''}`.toLowerCase();
  const strongResidential =
    /dwell|resid(?:ential|ence)?|single\s*fam|sfr\b|home|house|townhome|townhouse|condo|mobile|manufactur/i.test(
      text
    );
  const commercialHints =
    /mall|commercial|industrial|office|retail|plaza|church|school|city of|county of|railroad/i.test(
      text
    ) ||
    /mall|llc|inc\b|corp|church|city of/i.test(h.owner || '');
  const landHints = /vacant|ag\b|agric|farm|range|timber|waste|bare|unimproved/i.test(text);

  const asResidential =
    strongResidential ||
    (impPositive && !commercialHints && !landHints) ||
    (hasYear && impPositive) ||
    // Year built + situs, improvement value unknown (some counties omit split)
    (hasYear && !impKnown && !!h.situsAddress && !commercialHints && !landHints);

  if (asResidential) {
    if (h.yearBuilt != null && h.yearBuilt >= new Date().getFullYear() - 3) {
      return 'New Construction';
    }
    return 'Single Family';
  }
  if (landHints) return 'Vacant Land';
  if ((h.acres || 0) >= 10 && !impPositive && !hasYear) return 'Land';
  if ((h.acres || 0) >= 2 && (impVal ?? 0) < 1_000 && !hasYear) return 'Vacant Land';
  if ((h.acres || 0) > 0 && !hasYear && (impVal ?? 0) < 1_000) return 'Land';
  return 'Land';
}

export function handoffToSubject(h: GisCmaHandoff): SubjectProperty {
  const propertyType = inferPropertyTypeFromGis(h);
  const city =
    h.situsCity ||
    (h.county ? h.county.replace(/\s*county\s*/i, '').trim() : undefined) ||
    undefined;

  let address = h.situsAddress?.trim() || '';
  if (!address) {
    const pinPart = h.pin ? `PIN ${h.pin}` : 'GIS parcel';
    const countyPart = h.county ? `${h.county} County, ID` : 'Idaho';
    address = `${pinPart}, ${countyPart}`;
  } else if (city && !address.toLowerCase().includes(city.toLowerCase())) {
    address = `${address}, ${city}, ID`;
  } else if (!/,\s*id\b/i.test(address) && h.county) {
    address = `${address}, ID`;
  }

  // Assessed total seeds list/ask for CMA vs-list and AI assist; agent can override.
  const listPrice =
    h.assessedValue != null && h.assessedValue > 0 ? h.assessedValue : undefined;

  return {
    address,
    city,
    listPrice,
    acres: h.acres != null && h.acres > 0 ? h.acres : undefined,
    propertyType,
    yearBuilt: h.yearBuilt ?? undefined,
    assessedValue: h.assessedValue ?? undefined,
    landValue: h.landValue ?? undefined,
    improvementValue: h.improvementValue ?? undefined,
    pin: h.pin ?? undefined,
    owner: h.owner ?? undefined,
    county: h.county ?? undefined,
    lat: h.lat ?? undefined,
    lng: h.lng ?? undefined,
    legalDescription: h.legalDescription ?? undefined,
    improvements: h.improvements ?? undefined,
    situsAddress: h.situsAddress ?? undefined,
  };
}

export function saveGisCmaHandoff(h: GisCmaHandoff): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(CMA_GIS_STORAGE_KEY, JSON.stringify(h));
  } catch {
    /* quota / private mode */
  }
}

export function loadGisCmaHandoff(): GisCmaHandoff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(CMA_GIS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<GisCmaHandoff>;
    if (!parsed || typeof parsed !== 'object') return null;
    // Backfill map fields for sessions saved before geometry handoff
    const ring = (parsed.ring as [number, number][] | null) ?? null;
    const geojson =
      (parsed.geojson as GeoJSON.Feature | null) ??
      ringToFeature(ring, {
        pin: parsed.pin,
        acres: parsed.acres,
        yearBuilt: parsed.yearBuilt,
        assessedValue: parsed.assessedValue,
      });
    return {
      ...parsed,
      ring,
      geojson,
      mapBasemap: parsed.mapBasemap || 'aerial',
    } as GisCmaHandoff;
  } catch {
    return null;
  }
}

export function clearGisCmaHandoff(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(CMA_GIS_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Build subject + handoff from a live GIS parcel response. */
export function applyParcelToCma(p: GisParcelLike): {
  handoff: GisCmaHandoff;
  subject: SubjectProperty;
} {
  const handoff = parcelToGisHandoff(p);
  return { handoff, subject: handoffToSubject(handoff) };
}
