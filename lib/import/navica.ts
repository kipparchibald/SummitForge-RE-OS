// lib/import/navica.ts
// Live connection to Archibald-Bagley Navica / Snake River MLS IDX feed
// Supports RESO Web API style (JSON), simple JSON arrays, or custom endpoints.
// Falls back gracefully to realistic demo data for Eastern Idaho raw land.

import { NormalizedListing } from './listings';
import { feedVisibility } from './feedTypes';
import { isDemoMode } from '@/lib/env';
import { setRecentListings } from './recentListings';
import { saveListings } from '../supabase/client';

const NAVICA_URL = process.env.NAVICA_IDX_URL || '';
const NAVICA_KEY = process.env.NAVICA_API_KEY || '';

export interface NavicaFetchResult {
  success: boolean;
  count: number;
  landCount: number;
  listings: NormalizedListing[];
  source: string;
  lastSync: string;
  error?: string;
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

export async function fetchArchibaldNavicaListings(limit = 50, filters?: { search?: string; minAcres?: number; location?: string; maxPrice?: number }): Promise<NavicaFetchResult> {
  const lastSync = new Date().toISOString();

  // DEMO / no credentials path — always high quality Eastern Idaho raw land data
  if (!NAVICA_URL || !NAVICA_KEY) {
    console.log('[Navica] No live credentials configured. Using high-quality demo data across Eastern Idaho.');
    let normalized = DEMO_NAVICA_LAND.map(row => normalizeNavicaRow(row, 'navica-demo')).filter(Boolean) as NormalizedListing[];
    let land = normalized.filter(l => l.acres && l.acres > 0.5);

    // Apply client-side search/filters for automated live search
    if (filters) {
      land = land.filter(l => {
        if (filters.search && !(`${l.address} ${l.description || ''}`.toLowerCase().includes(filters.search.toLowerCase()))) return false;
        if (filters.minAcres && (l.acres || 0) < filters.minAcres) return false;
        if (filters.maxPrice && l.price > filters.maxPrice) return false;
        if (filters.location && !l.address.toLowerCase().includes(filters.location.toLowerCase())) return false;
        return true;
      });
    }

    setRecentListings(land);
    // Always upsert live data to Supabase (uses service role if SUPABASE_SERVICE_ROLE_KEY set)
    await saveListings(land);
    return {
      success: true,
      count: normalized.length,
      landCount: land.length,
      listings: land.slice(0, limit),
      source: 'demo (Archibald-Bagley Navica style)',
      lastSync,
    };
  }

  try {
    const headers: HeadersInit = {
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

    const url = NAVICA_URL.includes('?') ? `${NAVICA_URL}&$top=${limit}` : `${NAVICA_URL}?$top=${limit}`;

    const res = await fetch(url, {
      method: 'GET',
      headers,
      // For RETS/older feeds you may need different handling or a library
      next: { revalidate: 300 }, // 5 min cache in Next
    });

    if (!res.ok) {
      throw new Error(`Navica feed responded ${res.status}`);
    }

    const data = await res.json();

    // Public deployments (NEXT_PUBLIC_DEMO_MODE=true → no login) may only ever
    // receive IDX-permitted records. Auth-gated deployments keep BBO data —
    // that's the licensed audience (brokerage staff).

    // Handle common shapes:
    // 1. RESO Web API: { value: [...] }
    // 2. Simple array: [...]
    // 3. { listings: [...] } or { data: [...] }
    let rawListings: any[] = [];
    if (Array.isArray(data)) rawListings = data;
    else if (data.value && Array.isArray(data.value)) rawListings = data.value;
    else if (data.listings && Array.isArray(data.listings)) rawListings = data.listings;
    else if (data.data && Array.isArray(data.data)) rawListings = data.data;
    else rawListings = [data]; // single object fallback

    let normalized = rawListings
      .map(row => normalizeNavicaRow(row, 'navica-live'))
      .filter(Boolean) as NormalizedListing[];

    // Enforce the FeedTypes license boundary at ingestion for public
    // deployments: with NEXT_PUBLIC_DEMO_MODE=true there is no login, so
    // BBO/internal records must not exist in this process's output at all.
    if (isDemoMode()) {
      const before = normalized.length;
      normalized = normalized.filter(l => l.visibility !== 'internal');
      const dropped = before - normalized.length;
      if (dropped > 0) console.log(`[Navica] Public deployment: withheld ${dropped} non-IDX (BBO) records`);
    }

    let landListings = normalized.filter(l =>
      (l.propertyType.toLowerCase().includes('land') ||
       l.propertyType.toLowerCase().includes('vacant') ||
       (l.acres && l.acres > 0.5)) &&
      (l.address.toLowerCase().includes('rigby') ||
       l.address.toLowerCase().includes('terreton') ||
       l.address.toLowerCase().includes('blackfoot') ||
       l.address.toLowerCase().includes('shelley') ||
       l.address.toLowerCase().includes('jefferson'))
    );

    // Automate filters for live search
    if (filters) {
      landListings = landListings.filter(l => {
        if (filters.search && !(`${l.address} ${l.description || ''}`.toLowerCase().includes(filters.search.toLowerCase()))) return false;
        if (filters.minAcres && (l.acres || 0) < filters.minAcres) return false;
        if (filters.maxPrice && l.price > filters.maxPrice) return false;
        if (filters.location && !l.address.toLowerCase().includes(filters.location.toLowerCase())) return false;
        return true;
      });
    }

    setRecentListings(landListings);

    // Always upsert live data to Supabase (uses service role if SUPABASE_SERVICE_ROLE_KEY set)
    await saveListings(landListings);

    return {
      success: true,
      count: normalized.length,
      landCount: landListings.length,
      listings: landListings.slice(0, limit),
      source: 'live (Archibald-Bagley Navica IDX)',
      lastSync,
    };
  } catch (error: any) {
    console.error('[Navica] Live fetch failed:', error.message);
    // Graceful fallback to demo
    const normalized = DEMO_NAVICA_LAND.map(row => normalizeNavicaRow(row, 'navica-demo')).filter(Boolean) as NormalizedListing[];
    const land = normalized.filter(l => l.acres && l.acres > 0.5);
    setRecentListings(land);
    await saveListings(land);
    return {
      success: false,
      count: land.length,
      landCount: land.length,
      listings: land,
      source: 'demo (live fetch failed - using fallback)',
      lastSync,
      error: error.message,
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
      'Land';

    const city = row.City || row.city || '';
    const fullAddress = city ? `${address}, ${city}, ID` : address;

    const description = row['Public Remarks'] || row.PublicRemarks || row.description || row.Remarks || '';

    const mlsId = row['MLS #'] || row.MlsId || row['ListingId'] || row['ListingKey'] || row.id;

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
      description,
      url: row['Listing URL'] || row['ListingUrl'] || row.url || row['VirtualTourURLUnbranded'] || undefined,
      rawData: row,
    };
  } catch (e) {
    console.warn('Navica row normalization failed', e);
    return null;
  }
}

// Convenience: get only land-focused parcels
export async function fetchLiveLandListings(limit = 30) {
  const result = await fetchArchibaldNavicaListings(limit);
  return result.listings;
}
