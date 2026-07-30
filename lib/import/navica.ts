// lib/import/navica.ts
// Live connection to Archibald-Bagley Navica / Snake River MLS IDX feed
// Supports RESO Web API style (JSON), simple JSON arrays, or custom endpoints.
// Falls back gracefully to realistic demo data for Eastern Idaho MLS inventory
// (all property types — homes, new construction, land, farm, multi-family).

import { NormalizedListing } from './listings';
import { feedVisibility } from './feedTypes';
import { mapCityToLocation } from '@/lib/geo/counties';
import { isDemoMode } from '@/lib/env';
import { setRecentListings } from './recentListings';
import { saveListings } from '../supabase/client';

const NAVICA_URL = process.env.NAVICA_IDX_URL || '';
const NAVICA_KEY = process.env.NAVICA_API_KEY || '';

export interface NavicaFetchResult {
  success: boolean;
  count: number;
  landCount: number;
  /** Counts by normalized property type bucket */
  byType: Record<string, number>;
  listings: NormalizedListing[];
  source: string;
  lastSync: string;
  error?: string;
}

function countByType(listings: NormalizedListing[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of listings) {
    const key = bucketPropertyType(l.propertyType);
    out[key] = (out[key] || 0) + 1;
  }
  return out;
}

/** Canonical buckets for UI filters */
export function bucketPropertyType(type: string): string {
  const t = (type || '').toLowerCase();
  if (t.includes('land') || t.includes('vacant') || t.includes('lot')) return 'Land';
  if (t.includes('farm') || t.includes('ranch') || t.includes('ag')) return 'Farm/Ranch';
  if (t.includes('new') || t.includes('construction') || t.includes('spec')) return 'New Construction';
  if (t.includes('multi') || t.includes('duplex') || t.includes('plex') || t.includes('apartment'))
    return 'Multi-Family';
  if (t.includes('condo') || t.includes('town')) return 'Condo/Townhome';
  if (t.includes('commercial') || t.includes('industrial') || t.includes('office')) return 'Commercial';
  if (t.includes('single') || t.includes('residential') || t.includes('home') || t.includes('house'))
    return 'Single Family';
  return type?.trim() || 'Other';
}

export function isLandListing(l: NormalizedListing): boolean {
  const t = (l.propertyType || '').toLowerCase();
  if (t.includes('land') || t.includes('vacant') || t.includes('lot')) return true;
  if (t.includes('farm') || t.includes('ranch')) return true;
  // Large acreage without a residential subtype → treat as land/acreage
  if ((l.acres || 0) >= 5 && !/single|home|condo|town|multi|new|construction/i.test(t)) return true;
  return false;
}

/** Geographic coverage (7 counties) — not property-type gated */
export function isCoveredListing(l: NormalizedListing): boolean {
  return mapCityToLocation(l.address) !== 'Other';
}

// Realistic demo data modeled on Archibald-Bagley land listings (from public site
// patterns), spanning all seven Eastern Idaho counties in lib/geo/counties.ts so
// the demo reflects real coverage. Live feeds replace this entirely — coverage
// there is set by the $filter in NAVICA_IDX_URL, not by code.
const DEMO_NAVICA_LAND: any[] = [
  {
    'MLS #': '2185506',
    'Street Address': '730 N Center Street',
    City: 'Blackfoot',
    State: 'ID',
    'List Price': 16800000,
    Acres: 1177.68,
    'Property Type': 'Land',
    'Public Remarks': 'Massive development opportunity. Prime raw land with infrastructure potential.',
    'Listing URL': 'https://www.archibaldbagley.com/property-search/listings/detail/730-n-center-street-blackfoot-id-83221-2185506'
  },
  {
    'MLS #': '2184829',
    'Street Address': 'L16B8 146 N',
    City: 'Rigby',
    State: 'ID',
    'List Price': 488000,
    Acres: 2.46,
    'Property Type': 'Vacant Land',
    'Public Remarks': 'Buildable lot near Teton Heights area. Great views and access.',
    'Listing URL': 'https://www.archibaldbagley.com/'
  },
  {
    'MLS #': '2181391',
    'Street Address': '119 Ac 3900 E',
    City: 'Rigby',
    State: 'ID',
    'List Price': 4165000,
    Acres: 119,
    'Property Type': 'Land',
    'Public Remarks': 'Large parcel ready for subdivision or farm-to-residential conversion.',
  },
  {
    'MLS #': '2186118',
    'Street Address': '769 1580 N',
    City: 'Shelley',
    State: 'ID',
    'List Price': 575000,
    Acres: 5.8,
    'Property Type': 'Land',
    'Public Remarks': 'Raw land with development potential in growing area.',
  },
  {
    'MLS #': 'DEMO-001',
    'Street Address': 'Sample 40 acres near Terreton',
    City: 'Terreton',
    State: 'ID',
    'List Price': 620000,
    Acres: 40,
    'Property Type': 'Land',
    'Public Remarks': 'Excellent raw land opportunity. Good water rights potential.',
  },
  // --- Madison County ---
  {
    'MLS #': 'DEMO-2190144',
    'Street Address': '2200 W 7000 S',
    City: 'Rexburg',
    State: 'ID',
    'List Price': 1450000,
    Acres: 28.5,
    'Property Type': 'Land',
    'Public Remarks': 'Development ground near BYU-Idaho growth corridor. Student housing or single-family potential.',
  },
  {
    'MLS #': 'DEMO-2190871',
    'Street Address': 'TBD N Center',
    City: 'Sugar City',
    State: 'ID',
    'List Price': 395000,
    Acres: 6.2,
    'Property Type': 'Vacant Land',
    'Public Remarks': 'Infill acreage in fast-growing Sugar City. Utilities at the street.',
  },
  // --- Bonneville County ---
  {
    'MLS #': 'DEMO-2188420',
    'Street Address': '4500 E Sunnyside',
    City: 'Idaho Falls',
    State: 'ID',
    'List Price': 2350000,
    Acres: 47.3,
    'Property Type': 'Land',
    'Public Remarks': 'Prime Sunnyside corridor development parcel. Annexation-ready, high traffic count.',
  },
  {
    'MLS #': 'DEMO-2189003',
    'Street Address': 'L3B1 Ammon Rd',
    City: 'Ammon',
    State: 'ID',
    'List Price': 720000,
    Acres: 9.1,
    'Property Type': 'Land',
    'Public Remarks': 'Residential development lot in Ammon city limits. Sewer available.',
  },
  {
    'MLS #': 'DEMO-2187666',
    'Street Address': '155 Snake River Rd',
    City: 'Swan Valley',
    State: 'ID',
    'List Price': 1180000,
    Acres: 22,
    'Property Type': 'Land',
    'Public Remarks': 'Recreational acreage with river frontage. Cabin or short-term rental potential.',
  },
  // --- Bingham County ---
  {
    'MLS #': 'DEMO-2186540',
    'Street Address': 'TBD 800 N',
    City: 'Firth',
    State: 'ID',
    'List Price': 340000,
    Acres: 12.4,
    'Property Type': 'Land',
    'Public Remarks': 'Irrigated farm ground with building site. Water shares included.',
  },
  // --- Bannock County ---
  {
    'MLS #': 'DEMO-2191200',
    'Street Address': '900 S 5th Ave',
    City: 'Pocatello',
    State: 'ID',
    'List Price': 1650000,
    Acres: 34.8,
    'Property Type': 'Land',
    'Public Remarks': 'Bench development parcel with valley views. Zoned for mixed residential density.',
  },
  {
    'MLS #': 'DEMO-2191455',
    'Street Address': 'TBD Yellowstone Ave',
    City: 'Chubbuck',
    State: 'ID',
    'List Price': 890000,
    Acres: 8.7,
    'Property Type': 'Vacant Land',
    'Public Remarks': 'Commercial-adjacent acreage on Yellowstone corridor. Utilities to lot line.',
  },
  // --- Fremont County ---
  {
    'MLS #': 'DEMO-2188190',
    'Street Address': '3100 N 2000 E',
    City: 'St. Anthony',
    State: 'ID',
    'List Price': 545000,
    Acres: 19.6,
    'Property Type': 'Land',
    'Public Remarks': 'Sand dunes recreation access. Great agritourism or RV park potential.',
  },
  {
    'MLS #': 'DEMO-2188777',
    'Street Address': 'Lot 12 Island Park Village',
    City: 'Island Park',
    State: 'ID',
    'List Price': 425000,
    Acres: 3.1,
    'Property Type': 'Vacant Land',
    'Public Remarks': 'Treed cabin lot near Henrys Lake. Strong short-term rental market.',
  },
  // --- Teton County ---
  {
    'MLS #': 'DEMO-2192010',
    'Street Address': 'TBD Ski Hill Rd',
    City: 'Driggs',
    State: 'ID',
    'List Price': 1975000,
    Acres: 15.2,
    'Property Type': 'Land',
    'Public Remarks': 'Teton view acreage on Ski Hill corridor. Grand Targhee access, subdivision potential.',
  },
  {
    'MLS #': 'DEMO-2192388',
    'Street Address': '450 Baseline Rd',
    City: 'Victor',
    State: 'ID',
    'List Price': 860000,
    Acres: 10.4,
    'Property Type': 'Land',
    'Public Remarks': 'Valley floor parcel minutes from Teton Pass. Water rights, mountain views.',
  },
];

/** Non-land demo inventory so SummitForge can show the full MLS board in demo mode */
const DEMO_NAVICA_HOMES: any[] = [
  {
    'MLS #': '2191001',
    'Street Address': '789 Lindy Lane',
    City: 'Rigby',
    State: 'ID',
    'List Price': 489000,
    Acres: 0.28,
    Beds: 3,
    Baths: 2,
    SqFt: 1680,
    YearBuilt: 2019,
    'Property Type': 'Single Family',
    'Public Remarks': 'Single-level home near Teton Heights. Wide halls, open kitchen, ready for occupancy.',
  },
  {
    'MLS #': '2191002',
    'Street Address': '172 Kiana Dr',
    City: 'Rigby',
    State: 'ID',
    'List Price': 512000,
    Acres: 0.31,
    Beds: 4,
    Baths: 2.5,
    SqFt: 1850,
    YearBuilt: 2021,
    'Property Type': 'New Construction',
    'Public Remarks': 'Spec new construction. Builder warranty remaining. Popular Rigby subdivision.',
  },
  {
    'MLS #': '2191003',
    'Street Address': '445 N 3500 E',
    City: 'Menan',
    State: 'ID',
    'List Price': 425000,
    Acres: 1.2,
    Beds: 3,
    Baths: 2,
    SqFt: 1920,
    YearBuilt: 2008,
    'Property Type': 'Single Family',
    'Public Remarks': 'Acreage home with shop potential. Quiet Menan setting, quick to Rigby/IF.',
  },
  {
    'MLS #': '2191004',
    'Street Address': '902 Pioneer Rd #4',
    City: 'Rexburg',
    State: 'ID',
    'List Price': 289000,
    Acres: 0.05,
    Beds: 3,
    Baths: 2,
    SqFt: 1240,
    YearBuilt: 2016,
    'Property Type': 'Condo',
    'Public Remarks': 'Low-maintenance condo near BYU-Idaho. Strong rental demand corridor.',
  },
  {
    'MLS #': '2191005',
    'Street Address': '210 W 1st S',
    City: 'Rexburg',
    State: 'ID',
    'List Price': 675000,
    Acres: 0.22,
    Beds: 8,
    Baths: 4,
    SqFt: 3200,
    YearBuilt: 2005,
    'Property Type': 'Multi-Family',
    'Public Remarks': 'Quadplex near campus. Fully leased — investor package available.',
  },
  {
    'MLS #': '2191006',
    'Street Address': '55 N 4000 E',
    City: 'Ririe',
    State: 'ID',
    'List Price': 549000,
    Acres: 0.35,
    Beds: 4,
    Baths: 3,
    SqFt: 2400,
    YearBuilt: 2024,
    'Property Type': 'New Construction',
    'Public Remarks': 'Just finished new construction in Ririe. Energy-efficient, open concept.',
  },
  {
    'MLS #': '2191007',
    'Street Address': '1200 E 17th St',
    City: 'Idaho Falls',
    State: 'ID',
    'List Price': 365000,
    Acres: 0.18,
    Beds: 3,
    Baths: 2,
    SqFt: 1550,
    YearBuilt: 1998,
    'Property Type': 'Single Family',
    'Public Remarks': 'Updated midtown IF home. New roof 2022, fenced yard.',
  },
  {
    'MLS #': '2191008',
    'Street Address': '88 Snake River Ave',
    City: 'Idaho Falls',
    State: 'ID',
    'List Price': 895000,
    Acres: 0.4,
    Beds: 0,
    Baths: 0,
    SqFt: 4200,
    YearBuilt: 1985,
    'Property Type': 'Commercial',
    'Public Remarks': 'Commercial flex building with yard. High-visibility corridor.',
  },
  {
    'MLS #': '2191009',
    'Street Address': '3100 W 5000 S',
    City: 'Rexburg',
    State: 'ID',
    'List Price': 780000,
    Acres: 8.5,
    Beds: 4,
    Baths: 2,
    SqFt: 2100,
    YearBuilt: 1978,
    'Property Type': 'Farm/Ranch',
    'Public Remarks': 'Hobby farm with home, barn, and irrigated pasture. Madison County.',
  },
  {
    'MLS #': '2191010',
    'Street Address': '612 S 1st E',
    City: 'Blackfoot',
    State: 'ID',
    'List Price': 299000,
    Acres: 0.2,
    Beds: 3,
    Baths: 1.5,
    SqFt: 1400,
    YearBuilt: 1962,
    'Property Type': 'Single Family',
    'Public Remarks': 'Affordable starter in Blackfoot. Updated kitchen, mature trees.',
  },
];

const DEMO_NAVICA_ALL = [...DEMO_NAVICA_LAND, ...DEMO_NAVICA_HOMES];

export type NavicaListFilters = {
  search?: string;
  minAcres?: number;
  location?: string;
  maxPrice?: number;
  /** When true, only land/acreage (legacy). Default false = full MLS board. */
  landOnly?: boolean;
  propertyType?: string;
};

function applyListFilters(
  list: NormalizedListing[],
  filters?: NavicaListFilters
): NormalizedListing[] {
  if (!filters) return list;
  return list.filter((l) => {
    if (filters.landOnly && !isLandListing(l)) return false;
    if (filters.propertyType) {
      const want = filters.propertyType.toLowerCase();
      const bucket = bucketPropertyType(l.propertyType).toLowerCase();
      if (!bucket.includes(want) && !l.propertyType.toLowerCase().includes(want)) return false;
    }
    if (
      filters.search &&
      !`${l.address} ${l.description || ''} ${l.externalId || ''}`
        .toLowerCase()
        .includes(filters.search.toLowerCase())
    )
      return false;
    if (filters.minAcres && (l.acres || 0) < filters.minAcres) return false;
    if (filters.maxPrice && l.price > filters.maxPrice) return false;
    if (filters.location && !l.address.toLowerCase().includes(filters.location.toLowerCase()))
      return false;
    return true;
  });
}

export async function fetchArchibaldNavicaListings(
  limit = 100,
  filters?: NavicaListFilters
): Promise<NavicaFetchResult> {
  const lastSync = new Date().toISOString();
  // Default: full MLS (all property types). Opt into land-only via filters.landOnly.
  const landOnly = filters?.landOnly === true;

  // DEMO / no credentials path — full Eastern Idaho MLS-style board
  if (!NAVICA_URL || !NAVICA_KEY) {
    console.log(
      '[Navica] No live credentials — using demo MLS board (homes + land + multi + commercial).'
    );
    let normalized = DEMO_NAVICA_ALL.map((row) => normalizeNavicaRow(row, 'navica-demo')).filter(
      Boolean
    ) as NormalizedListing[];
    normalized = normalized.filter(isCoveredListing);
    let listings = applyListFilters(normalized, filters);
    if (landOnly) listings = listings.filter(isLandListing);

    setRecentListings(listings);
    await saveListings(listings);
    const landCount = listings.filter(isLandListing).length;
    return {
      success: true,
      count: listings.length,
      landCount,
      byType: countByType(listings),
      listings: listings.slice(0, limit),
      source: 'demo (full MLS board · Eastern Idaho)',
      lastSync,
    };
  }

  try {
    const url = NAVICA_URL.includes('?')
      ? `${NAVICA_URL}&$top=${Math.max(limit, 100)}`
      : `${NAVICA_URL}?$top=${Math.max(limit, 100)}`;

    const res = await fetch(url, {
      method: 'GET',
      headers: buildNavicaHeaders(),
      // Next.js fetch cache hint (not in standard RequestInit types)
      next: { revalidate: 300 },
    } as RequestInit);

    if (!res.ok) {
      throw new Error(`Navica feed responded ${res.status}`);
    }

    const data = await res.json();
    const rawListings = extractRows(data);
    let normalized = normalizeAndGate(rawListings);
    // Keep geography soft-filter; do not drop residential because acres are small
    normalized = normalized.filter(isCoveredListing);

    let listings = applyListFilters(normalized, filters);
    if (landOnly) listings = listings.filter(isLandListing);

    setRecentListings(listings);
    await saveListings(listings);

    return {
      success: true,
      count: listings.length,
      landCount: listings.filter(isLandListing).length,
      byType: countByType(listings),
      listings: listings.slice(0, limit),
      source: 'live (Archibald-Bagley Navica IDX · all types)',
      lastSync,
    };
  } catch (error: any) {
    console.error('[Navica] Live fetch failed:', error.message);
    const normalized = DEMO_NAVICA_ALL.map((row) => normalizeNavicaRow(row, 'navica-demo')).filter(
      Boolean
    ) as NormalizedListing[];
    let listings = applyListFilters(normalized.filter(isCoveredListing), filters);
    if (landOnly) listings = listings.filter(isLandListing);
    setRecentListings(listings);
    await saveListings(listings);
    return {
      success: false,
      count: listings.length,
      landCount: listings.filter(isLandListing).length,
      byType: countByType(listings),
      listings,
      source: 'demo (live fetch failed · full board fallback)',
      lastSync,
      error: error.message,
    };
  }
}

function buildNavicaHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': 'SummitForge-RE-OS/1.0 (Archibald-Bagley internal)',
  };
  if (NAVICA_KEY) {
    // Common auth patterns
    if (NAVICA_KEY.startsWith('Bearer ') || NAVICA_KEY.length > 40) {
      headers['Authorization'] = NAVICA_KEY.startsWith('Bearer ') ? NAVICA_KEY : `Bearer ${NAVICA_KEY}`;
    } else {
      headers['X-API-Key'] = NAVICA_KEY;
    }
  }
  return headers;
}

// Handle common response shapes:
// 1. RESO Web API: { value: [...] }
// 2. Simple array: [...]
// 3. { listings: [...] } or { data: [...] }
function extractRows(data: any): any[] {
  if (Array.isArray(data)) return data;
  if (data?.value && Array.isArray(data.value)) return data.value;
  if (data?.listings && Array.isArray(data.listings)) return data.listings;
  if (data?.data && Array.isArray(data.data)) return data.data;
  return [data]; // single object fallback
}

// Normalize raw rows and enforce the FeedTypes license boundary at ingestion
// for public deployments: with NEXT_PUBLIC_DEMO_MODE=true there is no login,
// so BBO/internal records must not exist in this process's output at all.
// Auth-gated deployments keep BBO data — that's the licensed audience
// (brokerage staff).
function normalizeAndGate(rawListings: any[]): NormalizedListing[] {
  let normalized = rawListings
    .map(row => normalizeNavicaRow(row, 'navica-live'))
    .filter(Boolean) as NormalizedListing[];

  if (isDemoMode()) {
    const before = normalized.length;
    normalized = normalized.filter(l => l.visibility !== 'internal');
    const dropped = before - normalized.length;
    if (dropped > 0) console.log(`[Navica] Public deployment: withheld ${dropped} non-IDX (BBO) records`);
  }
  return normalized;
}

// Legacy alias — prefer isLandListing / isCoveredListing
function isCoveredLand(l: NormalizedListing): boolean {
  return isLandListing(l) && isCoveredListing(l);
}

export interface NavicaBackfillResult {
  success: boolean;
  pages: number;
  fetched: number;
  landCount: number;
  saved: number;
  /** Set when the run stopped at maxPages — pass back as `skip` to resume. */
  nextSkip?: number;
  source: string;
  lastSync: string;
  error?: string;
}

/**
 * Paginated full backfill of the Navica feed, for the initial overnight load
 * (the SRMLS agreement restricts daytime bulk volume — run this after hours).
 *
 * Walks the feed with RESO OData paging ($top/$skip), following
 * @odata.nextLink when the server provides one. Each page is normalized,
 * FeedTypes-gated, filtered to covered land, and upserted before the next
 * page is requested, so an interrupted run keeps everything fetched so far.
 */
export async function backfillNavicaListings(opts?: {
  pageSize?: number;
  maxPages?: number;
  delayMs?: number;
  landOnly?: boolean;
  /** Resume point from a previous run's nextSkip. */
  startSkip?: number;
}): Promise<NavicaBackfillResult> {
  const pageSize = opts?.pageSize ?? 200;
  // Sized so a full run fits inside the route's maxDuration; resume with
  // nextSkip if the feed is bigger than pageSize * maxPages.
  const maxPages = opts?.maxPages ?? 40;
  const delayMs = opts?.delayMs ?? 1000;
  // Default full MLS backfill; pass landOnly:true for land-only overnight jobs
  const landOnly = opts?.landOnly ?? false;
  const startSkip = opts?.startSkip ?? 0;
  const lastSync = new Date().toISOString();

  if (!NAVICA_URL || !NAVICA_KEY) {
    return {
      success: false, pages: 0, fetched: 0, landCount: 0, saved: 0,
      source: 'none', lastSync,
      error: 'NAVICA_IDX_URL / NAVICA_API_KEY not configured — backfill only runs against the live feed',
    };
  }

  const headers = buildNavicaHeaders();
  let pages = 0;
  let fetched = 0;
  let landCount = 0;
  let saved = 0;

  try {
    const sep = NAVICA_URL.includes('?') ? '&' : '?';
    let skip = startSkip;
    let nextUrl: string | null = `${NAVICA_URL}${sep}$top=${pageSize}&$skip=${skip}`;

    while (nextUrl && pages < maxPages) {
      const res: Response = await fetch(nextUrl, { method: 'GET', headers, cache: 'no-store' });
      if (!res.ok) throw new Error(`Navica feed responded ${res.status} on page ${pages + 1}`);

      const data = await res.json();
      const rows = extractRows(data);
      pages += 1;
      fetched += rows.length;

      const normalized = normalizeAndGate(rows);
      const batch = landOnly ? normalized.filter(isCoveredLand) : normalized;
      landCount += batch.length;

      if (batch.length > 0) {
        const saveResult = await saveListings(batch);
        saved += saveResult.saved;
        if (saveResult.error) {
          throw new Error(`Persist failed on page ${pages}: ${saveResult.error}`);
        }
      }

      console.log(`[Navica backfill] page ${pages}: ${rows.length} fetched, ${batch.length} kept, ${saved} saved total`);

      // Server-driven paging wins when offered; otherwise advance $skip until
      // a short page signals the end.
      const nextLink = data?.['@odata.nextLink'] || data?.['odata.nextLink'] || null;
      skip += rows.length; // keep the resume point honest under both paging styles
      if (nextLink) {
        nextUrl = String(nextLink);
      } else if (rows.length === pageSize) {
        nextUrl = `${NAVICA_URL}${sep}$top=${pageSize}&$skip=${skip}`;
      } else {
        nextUrl = null;
      }

      if (nextUrl && delayMs > 0) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }

    const exhausted = nextUrl === null;
    return {
      success: true, pages, fetched, landCount, saved,
      ...(exhausted ? {} : { nextSkip: skip }),
      source: 'live (Navica backfill)', lastSync,
    };
  } catch (error: any) {
    console.error('[Navica backfill] failed:', error.message);
    return {
      success: false, pages, fetched, landCount, saved,
      source: 'live (Navica backfill)', lastSync, error: error.message,
    };
  }
}

function normalizeNavicaRow(row: any, source: string): NormalizedListing | null {
  try {
    // Support a wide range of field names from Navica / Snake River MLS / RESO
    const address =
      row['Street Address'] ||
      row.StreetAddress ||
      row['UnparsedAddress'] ||
      row.address ||
      `${row['StreetNumber'] || ''} ${row['StreetName'] || ''} ${row['StreetSuffix'] || ''}`.trim() ||
      row.Location ||
      '';

    // Strip currency symbols / thousands separators before parsing, otherwise a
    // value like "$450,000" yields NaN, which slips past the `price <= 0` guard.
    const rawPrice =
      row['List Price'] ??
      row.ListPrice ??
      row.price ??
      row['Asking Price'] ??
      row['OriginalListPrice'] ??
      0;
    const price = parseFloat(String(rawPrice).replace(/[^0-9.\-]/g, ''));

    const acres =
      parseFloat(
        row.Acres ||
        row['Acres'] ||
        row['Lot Size'] ||
        row['Total Acres'] ||
        row.LotSizeAcres ||
        row['LotSize'] ||
        0
      ) || undefined;

    const propertyType =
      row['Property Type'] ||
      row.PropertyType ||
      row['PropertySubType'] ||
      row.type ||
      row['Home Type'] ||
      (acres && acres >= 5 ? 'Land' : 'Single Family');

    const city = row.City || row.city || '';
    const fullAddress = city ? `${address}, ${city}, ID` : address;

    const description = row['Public Remarks'] || row.PublicRemarks || row.description || row.Remarks || '';

    const mlsId = row['MLS #'] || row.MlsId || row['ListingId'] || row['ListingKey'] || row.id;

    const beds = parseFloat(row.Beds || row.BedroomsTotal || row.bedrooms || '') || undefined;
    const baths = parseFloat(row.Baths || row.BathroomsTotalInteger || row.bathrooms || '') || undefined;
    const sqft =
      parseFloat(row.SqFt || row.LivingArea || row.BuildingAreaTotal || row.sqft || '') || undefined;
    const yearBuilt =
      parseInt(String(row.YearBuilt || row.yearBuilt || ''), 10) || undefined;

    if (!fullAddress || !Number.isFinite(price) || price <= 0) return null;

    return {
      source,
      // BBO records in the combined Navica feed must never reach public
      // surfaces; visibility is decided once here (fail-closed in feedTypes).
      visibility: feedVisibility(row),
      externalId: String(mlsId || ''),
      address: fullAddress,
      price,
      acres,
      propertyType,
      isNewConstruction: /new construction|new build|spec/i.test(
        propertyType + ' ' + description
      ),
      description,
      url: row['Listing URL'] || row['ListingUrl'] || row.url || row['VirtualTourURLUnbranded'] || undefined,
      rawData: {
        ...row,
        beds,
        baths,
        sqft,
        yearBuilt,
      },
    };
  } catch (e) {
    console.warn('Navica row normalization failed', e);
    return null;
  }
}

/** Land-only convenience (development engine, land scan) */
export async function fetchLiveLandListings(limit = 30) {
  const result = await fetchArchibaldNavicaListings(limit, { landOnly: true });
  return result.listings;
}

/** Full MLS board convenience */
export async function fetchLiveMlsListings(limit = 100) {
  const result = await fetchArchibaldNavicaListings(limit, { landOnly: false });
  return result.listings;
}
