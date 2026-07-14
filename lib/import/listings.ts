import { parse as parseCSV } from 'papaparse';
import { fetchArchibaldNavicaListings } from './navica';
import { setRecentListings } from './recentListings';
import { saveListings } from '../supabase/client';

export interface NormalizedListing {
  source: string;
  externalId?: string;
  address: string;
  price: number;
  acres?: number;
  propertyType: string;
  description?: string;
  url?: string;
  geometry?: any;
  rawData: any;
}

export async function importListings(
  input: File | string | any[] | 'live-navica',
  source: 'mls' | 'zillow' | 'landwatch' | 'landsofamerica' | 'navica' | 'other' = 'mls'
): Promise<{ imported: number; listings: NormalizedListing[]; source: string; lastSync?: string }> {
  let rawData: any[] = [];
  let effectiveSource = source;

  // Special live Navica mode
  if (input === 'live-navica' || source === 'navica') {
    const navicaResult = await fetchArchibaldNavicaListings(100, undefined); // filters passed from UI in future
    // Ensure shared last sync is noted (server side + client will pick via localStorage on update)
    return {
      imported: navicaResult.landCount,
      listings: navicaResult.listings,
      source: navicaResult.source,
      lastSync: navicaResult.lastSync,
    };
  }

  if (Array.isArray(input)) {
    rawData = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('http')) {
      console.log(`[Import] Fetching from URL: ${input}`);
      try {
        const res = await fetch(input);
        const text = await res.text();
        if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
          rawData = JSON.parse(text);
        } else {
          rawData = parseCSVText(text);
        }
      } catch (e) {
        console.error('Failed to fetch URL', e);
        rawData = [{ url: input, address: 'Failed to fetch ' + input, price: 0 }];
      }
    } else {
      try {
        rawData = JSON.parse(input);
      } catch {
        rawData = parseCSVText(input);
      }
    }
  } else if (input instanceof File) {
    const text = await input.text();
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      rawData = JSON.parse(text);
    } else {
      rawData = parseCSVText(text);
    }
  }

  const normalized: NormalizedListing[] = rawData
    .map(row => normalizeRow(row, effectiveSource))
    .filter(Boolean) as NormalizedListing[];

  const landListings = normalized.filter(l =>
    l.propertyType.toLowerCase().includes('land') ||
    l.propertyType.toLowerCase().includes('vacant') ||
    (l.acres && l.acres > 0.5)
  );

  if (landListings.length > 0) {
    setRecentListings(landListings);
  }

  // Always persist live data to Supabase (service role used if SUPABASE_SERVICE_ROLE_KEY set)
  if (landListings.length > 0) {
    await saveListings(landListings);
  }

  for (const listing of landListings) {
    await triggerRawLandProjection(listing);
  }

  return { imported: landListings.length, listings: landListings, source: effectiveSource };
}

function parseCSVText(csvText: string): any[] {
  // Robust CSV parsing with papaparse or simple split (add papaparse to package.json)
  const results = parseCSV(csvText, { header: true, skipEmptyLines: true });
  return results.data || [];
}

function normalizeRow(row: any, source: string): NormalizedListing | null {
  try {
    const address = row.address || row['Street Address'] || row['Property Address'] || row.location || '';
    const price = parseFloat(row.price || row['List Price'] || row['Asking Price'] || row.price || 0);
    const acres = parseFloat(row.acres || row['Acres'] || row['Lot Size'] || row['Total Acres'] || 0);
    const propertyType = row['Property Type'] || row.type || row['Home Type'] || 'Land';
    const description = row.description || row['Public Remarks'] || '';

    if (!address || price <= 0) return null;

    return {
      source,
      externalId: row.id || row.zpid || row.pid || row['MLS #'],
      address,
      price,
      acres: acres || undefined,
      propertyType,
      description,
      url: row.url || row['Listing URL'] || row.link,
      rawData: row
    };
  } catch (e) {
    console.error('Normalization error for row:', row, e);
    return null;
  }
}

async function triggerRawLandProjection(listing: NormalizedListing) {
  console.log(`Triggering raw land projection for: ${listing.address}`);
  // Integrate with your lib/analysis/raw-land.ts
  // Example: await runRawLandProjection({ ...listing, zoning: 'R-1' /* from GIS */ });
  // This will calculate lot yield, infra estimates, IRR etc.
}

/**
 * Simple JS Levenshtein distance for fuzzy search scoring.
 * Used for deeper client-side fuzzy matching in import page + search.
 */
export function levenshtein(a: string, b: string): number {
  const s = a.toLowerCase();
  const t = b.toLowerCase();
  if (s === t) return 0;
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,      // deletion
        dp[i][j - 1] + 1,      // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }
  return dp[m][n];
}

/**
 * Fuzzy score 0-1 (1=perfect) using Levenshtein + substring boost.
 * Simple, no deps. Supports MLS # exact/near, address, description partials.
 */
export function fuzzyScore(query: string, target: string): number {
  if (!query || !target) return 0;
  const q = query.trim().toLowerCase();
  const t = target.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 0.95; // strong substring boost
  if (q.includes(t)) return 0.85;
  const dist = levenshtein(q, t);
  const maxLen = Math.max(q.length, t.length);
  if (maxLen === 0) return 0;
  let score = 1 - dist / maxLen;
  // MLS # boost: if both look numeric/MLS-ish
  const qLooksMls = /^\d{4,}$/.test(q.replace(/[^0-9]/g, ''));
  const tLooksMls = /\d{4,}/.test(t);
  if (qLooksMls && tLooksMls && dist <= 2) score = Math.max(score, 0.92);
  return Math.max(0, Math.min(1, score));
}

/**
 * Filter + score listings with fuzzy search.
 * Combines includes (for speed) + Levenshtein fuzzy score.
 * New usage: for import page live search and queryListings post-processing.
 */
export function fuzzyFilterListings<T extends { address: string; description?: string; externalId?: string; propertyType?: string }>(
  listings: T[],
  searchTerm: string,
  minScore = 0.35
): Array<T & { _score?: number }> {
  if (!searchTerm || !searchTerm.trim()) {
    return listings.map(l => ({ ...l, _score: 1 }));
  }
  const q = searchTerm.trim();
  const scored = listings
    .map(l => {
      const fields = [
        l.address || '',
        l.description || '',
        l.externalId || '',
        l.propertyType || ''
      ].join(' ');
      const score = fuzzyScore(q, fields);
      // Extra MLS specific: direct external match
      if (l.externalId && fuzzyScore(q, String(l.externalId)) > score) {
        return { ...l, _score: fuzzyScore(q, String(l.externalId)) };
      }
      return { ...l, _score: score };
    })
    .filter(l => (l._score || 0) >= minScore)
    .sort((a, b) => (b._score || 0) - (a._score || 0));
  return scored;
}