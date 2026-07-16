// Simple in-memory store for latest imported listings (demo / session scope)
// Now enhanced: syncs from Supabase 'listings' table on load for persistence + live search.

import { NormalizedListing, fuzzyFilterListings } from './listings';
import { getListingsFromSupabase } from '../supabase/client';
import { setLastSyncTimestamp } from './lastSync';

// Timestamp helpers now live in the dependency-free './lastSync' module so that
// client pages needing only the badge don't pull in Supabase. Re-exported here
// for existing import sites.
export { setLastSyncTimestamp, getLastSyncTimestamp, formatLastSyncTime, isLastSyncRecent } from './lastSync';

let recentListings: NormalizedListing[] = [];

export function setRecentListings(listings: NormalizedListing[]) {
  recentListings = listings.slice(0, 200); // cap
  // Auto-record last pull time on every set (covers Navica pulls in server + any direct calls)
  setLastSyncTimestamp();
}

export function getRecentListings(): NormalizedListing[] {
  return [...recentListings];
}

export function getRecentLandListings(limit = 30) {
  return recentListings
    .filter(l => l.acres && l.acres > 0.5)
    .slice(0, limit);
}

/**
 * New fuzzy + scored search over recentListings (in-mem + DB synced).
 * Used alongside queryListings for hybrid live search in import.
 */
export function searchRecentListingsFuzzy(searchTerm: string, limit = 50) {
  const base = [...recentListings];
  if (!searchTerm) return base.slice(0, limit);
  return fuzzyFilterListings(base, searchTerm).slice(0, limit);
}

/**
 * Map a Supabase row back to NormalizedListing shape.
 */
function mapDbRowToNormalized(row: any): NormalizedListing {
  return {
    source: row.source || 'supabase',
    externalId: row.external_id,
    address: row.address,
    price: typeof row.price === 'number' ? row.price : parseFloat(row.price || 0),
    acres: row.acres != null ? parseFloat(row.acres) : undefined,
    propertyType: row.property_type || 'Land',
    description: row.description || undefined,
    url: row.url || undefined,
    geometry: row.geometry || undefined,
    rawData: row.raw_data || row,
  };
}

/**
 * Sync recentListings from Supabase DB (called on module load for persistence).
 * This makes data live across restarts / sessions when Supabase is configured.
 */
export async function syncRecentListingsFromSupabase(): Promise<NormalizedListing[]> {
  try {
    const dbRows = await getListingsFromSupabase(200);
    if (dbRows && dbRows.length > 0) {
      recentListings = dbRows.map(mapDbRowToNormalized).slice(0, 200);
      console.log(`[recentListings] Synced ${recentListings.length} listings from Supabase DB on load.`);
      return [...recentListings];
    }
  } catch (e: any) {
    // Table may not exist yet or in demo; fail silently
    if (!String(e?.message || '').includes('relation') && !String(e?.message || '').includes('does not exist')) {
      console.log('[recentListings] Supabase sync info:', e?.message || e);
    }
  }
  return [...recentListings];
}

// Auto-sync from DB on module load (fire-and-forget), server-side only.
// In the browser this made a failing Supabase request on every page that
// imported this module; the client populates after the first live import + save.
if (typeof window === 'undefined') {
  syncRecentListingsFromSupabase();
}

// Back-compat alias
export const syncRecentFromSupabase = syncRecentListingsFromSupabase;

// Note: setRecentListings (defined above) auto-calls setLastSyncTimestamp() on updates.
// This + explicit setLastSyncTimestamp in UI pull handlers keeps header + pages in sync.
// "Live • Last: XX:XX" shown with green styling if recent.

