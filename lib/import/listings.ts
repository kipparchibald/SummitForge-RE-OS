import { parse as parseCSV } from 'papaparse';
import { fetchArchibaldNavicaListings } from './navica';
import { fetchSiteListings } from './idxSite';
import { setRecentListings } from './recentListings';
import { saveListings } from '../supabase/client';
import { safeFetch } from '../net/safeFetch';
import { findMatchesForListing } from '@/lib/alerts/matching';
import { processMatchesForNotification } from '@/lib/alerts/notifications';
import { mapCityToLocation } from '@/lib/geo/counties';
import type { FeedVisibility } from './feedTypes';
import type { Alert, Listing as AlertListing } from '@/types/alerts';

export interface NormalizedListing {
  source: string;
  externalId?: string;
  /** Public-display permission per the data license. Absent = public (legacy sources). */
  visibility?: FeedVisibility;
  address: string;
  city?: string;
  price: number;
  acres?: number;
  propertyType: string;
  isNewConstruction?: boolean;
  description?: string;
  url?: string;
  geometry?: any;
  rawData: any;
}

export interface ImportOptions {
  alerts?: Alert[];
  runMatching?: boolean;
  /** Base URL for the 'idx-site' source; defaults to archibaldbagley.com. */
  siteUrl?: string;
}

export interface ImportResult {
  imported: number;
  landCount: number;
  listings: NormalizedListing[];
  source: string;
  lastSync?: string;
  matches?: any[];
  notifications?: any[];
  /** MLS attribution that must be displayed with the data (e.g. "Snake River Regional MLS"). */
  attribution?: string;
}

export async function importListings(
  input: File | string | any[] | 'live-navica' | 'live-site',
  source: 'mls' | 'zillow' | 'landwatch' | 'landsofamerica' | 'navica' | 'idx-site' | 'other' = 'mls',
  options?: ImportOptions
): Promise<ImportResult> {
  let rawData: any[] = [];
  let effectiveSource = source;

  // Live pull from the brokerage's own IDX website (real MLS data without
  // waiting on RESO credentials). See lib/import/idxSite.ts.
  if (input === 'live-site' || source === 'idx-site') {
    // NAVICA API Terms §8(e) prohibit scraper-gathered copies of information
    // "similar to or the same as" the feed Data. The site importer was the
    // stopgap for the credential wait — once the real feed is configured it
    // retires itself so it cannot be used alongside the licensed feed.
    if (process.env.NAVICA_IDX_URL && process.env.NAVICA_API_KEY) {
      throw new Error(
        'Site import is disabled: the licensed Navica feed is configured. Use the Navica source instead (NAVICA API Terms §8e).'
      );
    }
    const site = await fetchSiteListings(options?.siteUrl);
    const land = site.listings.filter(
      l => l.propertyType.toLowerCase().includes('land') ||
           l.propertyType.toLowerCase().includes('vacant') ||
           (l.acres && l.acres > 0.5)
    );
    if (site.listings.length > 0) {
      setRecentListings(site.listings);
      await saveListings(site.listings);
    }
    const result: ImportResult = {
      imported: site.listings.length,
      landCount: land.length,
      listings: site.listings,
      source: site.source,
      lastSync: new Date().toISOString(),
      attribution: site.attribution,
    };
    if (options?.runMatching && options.alerts?.length) {
      const r = await runAlertMatching(site.listings, options.alerts);
      result.matches = r.matches;
      result.notifications = r.notifications;
    }
    return result;
  }

  // Special live Navica mode
  if (input === 'live-navica' || source === 'navica') {
    const navicaResult = await fetchArchibaldNavicaListings(100, undefined); // filters passed from UI in future
    // Ensure shared last sync is noted (server side + client will pick via localStorage on update)
    const result: ImportResult = {
      imported: navicaResult.landCount,
      landCount: navicaResult.landCount,
      listings: navicaResult.listings,
      source: navicaResult.source,
      lastSync: navicaResult.lastSync,
    };
    if (options?.runMatching && options.alerts?.length) {
      const { matches, notifications } = await runAlertMatching(navicaResult.listings, options.alerts);
      result.matches = matches;
      result.notifications = notifications;
    }
    return result;
  }

  if (Array.isArray(input)) {
    rawData = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('http')) {
      console.log(`[Import] Fetching from URL: ${input}`);
      try {
        const res = await safeFetch(input);
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

  let matches: any[] = [];
  let notifications: any[] = [];
  if (options?.runMatching && options.alerts?.length) {
    const r = await runAlertMatching(normalized, options.alerts);
    matches = r.matches;
    notifications = r.notifications;
  }

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

  return {
    imported: normalized.length,
    landCount: landListings.length,
    listings: normalized,
    source: effectiveSource,
    matches,
    notifications,
  };
}

// Property-alert matching pipeline (SMS-first) over freshly imported listings
async function runAlertMatching(
  normalized: NormalizedListing[],
  alerts: Alert[]
): Promise<{ matches: any[]; notifications: any[] }> {
  const alertListings: AlertListing[] = normalized.map((n, idx) => ({
    id: n.externalId || `imported_${idx}`,
    mlsNumber: n.externalId || `imported_${idx}`,
    address: n.address,
    city: n.city || 'Unknown',
    location: mapCityToLocation(n.city || n.address),
    price: n.price,
    acres: n.acres,
    propertyType: mapPropertyType(n.propertyType),
    isNewConstruction: n.isNewConstruction ?? false,
    description: n.description,
    url: n.url,
    importedAt: new Date().toISOString(),
  }));

  const matches: any[] = [];
  for (const listing of alertListings) {
    const listingMatches = findMatchesForListing(listing, alerts);
    // Prefer SMS channel on match when alert wants SMS
    for (const m of listingMatches) {
      const alert = alerts.find(a => a.id === m.alertId);
      if (alert?.notifyBy.includes('sms')) {
        m.notificationMethod = 'sms';
      } else if (alert?.notifyBy.includes('in-app')) {
        m.notificationMethod = 'in-app';
      }
    }
    matches.push(...listingMatches);
  }

  let notifications: any[] = [];
  if (matches.length > 0) {
    notifications = await processMatchesForNotification(matches, alerts, alertListings, {
      sendSms: true,
      phoneLookup: (alert) => alert.phone,
    });
    console.log(
      `[Import] Generated ${matches.length} matches and ${notifications.length} notification payloads`
    );
  }

  return { matches, notifications };
}

function parseCSVText(csvText: string): any[] {
  const results = parseCSV(csvText, { header: true, skipEmptyLines: true });
  return results.data || [];
}

function normalizeRow(row: any, source: string): NormalizedListing | null {
  try {
    const address = row.address || row['Street Address'] || row['Property Address'] || row.location || '';
    const price = parseFloat(row.price || row['List Price'] || row['Asking Price'] || 0);
    const acres = parseFloat(row.acres || row['Acres'] || row['Lot Size'] || row['Total Acres'] || 0);
    const propertyType = row['Property Type'] || row.type || row['Home Type'] || 'Land';
    const description = row.description || row.remarks || row['Public Remarks'] || '';
    const city = row.city || row.City || '';

    if (!address) return null;

    return {
      source,
      externalId: row.id || row.zpid || row.pid || row['MLS #'] || row['MLS Number'],
      address,
      city,
      price: isNaN(price) ? 0 : price,
      acres: isNaN(acres) ? undefined : acres,
      propertyType,
      isNewConstruction: /new construction|new build|spec/i.test(propertyType + ' ' + description),
      description,
      url: row.url || row.link,
      geometry: row.geometry,
      rawData: row,
    };
  } catch {
    return null;
  }
}

function mapPropertyType(type: string): any {
  const t = (type || '').toLowerCase();
  if (t.includes('single')) return 'Single Family';
  if (t.includes('new') || t.includes('construction')) return 'New Construction';
  if (t.includes('land') || t.includes('vacant')) return 'Land';
  if (t.includes('farm') || t.includes('ranch')) return 'Farm/Ranch';
  if (t.includes('multi')) return 'Multi-Family';
  if (t.includes('commercial')) return 'Commercial';
  return 'Single Family';
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
