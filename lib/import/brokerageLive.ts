// lib/import/brokerageLive.ts
// Preferred MLS source for SummitForge: the brokerage public IDX API.
// archibaldbagley.com already holds licensed Navica credentials and strips BBO.

import type { NormalizedListing } from './listings';

type LiveFilters = {
  search?: string;
  location?: string;
};

export const DEFAULT_ARCHIBALD_LISTINGS_URL =
  'https://www.archibaldbagley.com/api/listings/live';

const ARCHIBALD_LISTINGS_URL = (
  process.env.ARCHIBALD_LISTINGS_URL ||
  process.env.NAVICA_LIVE_PROXY_URL ||
  DEFAULT_ARCHIBALD_LISTINGS_URL
).replace(/\/$/, '');

type BrokerageLiveResponse = {
  ok?: boolean;
  live?: boolean;
  listings?: any[];
  dataset?: string;
  feed?: string;
  count?: number;
  error?: string;
};

function extractRows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.value && Array.isArray(data.value)) return data.value;
  if (data?.listings && Array.isArray(data.listings)) return data.listings;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return data ? [data] : [];
}

function brokerageListingsUrl(limit: number, filters?: LiveFilters): string {
  const qs = new URLSearchParams({
    top: String(Math.max(limit, 50)),
    fields: 'full',
  });
  if (filters?.location) qs.set('city', filters.location);
  if (filters?.search && /^\d{5,}$/.test(filters.search.trim())) {
    qs.set('id', filters.search.trim());
  }
  const base = ARCHIBALD_LISTINGS_URL.includes('/api/listings/live')
    ? ARCHIBALD_LISTINGS_URL
    : `${ARCHIBALD_LISTINGS_URL}/api/listings/live`;
  return `${base}?${qs.toString()}`;
}

export function normalizeBrokerageListing(row: any): NormalizedListing | null {
  if (!row || typeof row !== 'object') return null;
  if (row.source && row.rawData && row.address && row.price) {
    return row as NormalizedListing;
  }
  const mls = row.mls || row.externalId || row.id || row['MLS #'];
  const city = row.city || row.City || '';
  const state = row.state || row.State || 'ID';
  const street = row.address || row['Street Address'] || '';
  const fullAddress = street.includes(city)
    ? street
    : [street, city, state].filter(Boolean).join(', ');
  const price = Number(row.price ?? row.ListPrice ?? row['List Price'] ?? 0);
  if (!fullAddress || !Number.isFinite(price) || price <= 0) return null;
  const acres = Number(row.lotAcres ?? row.acres ?? row.LotSizeAcres ?? 0) || undefined;
  const propertyType =
    row.propertyType || row.PropertyType || (acres && acres >= 5 ? 'Land' : 'Single Family');
  const description = row.description || row.PublicRemarks || '';
  return {
    source: 'archibald-bagley-live',
    visibility: 'public',
    externalId: String(mls || ''),
    address: fullAddress,
    city: city || undefined,
    price,
    acres,
    propertyType,
    isNewConstruction: /new construction|new build|spec/i.test(
      String(propertyType) + ' ' + description
    ),
    description,
    url:
      row.url ||
      row.virtualTourUrl ||
      (mls
        ? `https://www.archibaldbagley.com/property-search/listings/detail/${String(mls)}`
        : 'https://www.archibaldbagley.com/'),
    geometry:
      Number.isFinite(row.lat) && Number.isFinite(row.lng)
        ? { type: 'Point', coordinates: [row.lng, row.lat] }
        : undefined,
    rawData: {
      ...row,
      beds: row.beds,
      baths: row.baths,
      sqft: row.sqft,
      yearBuilt: row.yearBuilt,
      photo: row.photo,
    },
  };
}

export async function fetchBrokerageLiveListings(
  limit: number,
  filters?: LiveFilters
): Promise<NormalizedListing[] | null> {
  try {
    const url = brokerageListingsUrl(limit, filters);
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'SummitForge-RE-OS/1.0 (Archibald-Bagley internal)',
      },
      signal: AbortSignal.timeout(45_000),
      next: { revalidate: 300 },
    } as RequestInit);
    if (!res.ok) {
      console.warn(`[Navica] Brokerage live feed HTTP ${res.status}`);
      return null;
    }
    const data = (await res.json()) as BrokerageLiveResponse;
    const rows = extractRows(data);
    if (!data.ok && !rows.length) return null;
    const normalized = rows
      .map((row) => normalizeBrokerageListing(row))
      .filter(Boolean) as NormalizedListing[];
    if (!normalized.length) return null;
    console.log(
      `[Navica] Brokerage live feed: ${normalized.length} listings (dataset=${data.dataset || 'nav91'} live=${data.live !== false})`
    );
    return normalized;
  } catch (err: any) {
    console.warn('[Navica] Brokerage live feed unavailable:', err?.message || err);
    return null;
  }
}
