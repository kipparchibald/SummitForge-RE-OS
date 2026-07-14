// Simple in-memory store for latest imported listings (demo / session scope)
// Now enhanced: syncs from Supabase 'listings' table on load for persistence + live search.

import { NormalizedListing, fuzzyFilterListings } from './listings';
import { getListingsFromSupabase } from '../supabase/client';

let recentListings: NormalizedListing[] = [];

/**
 * Shared "last Navica pull" timestamp mechanism (hoisted early).
 * localStorage (client) + memory. Updated on every Navica pull via setRecentListings or explicit calls.
 */
let lastSyncTimestamp: string | null = null;

export function setLastSyncTimestamp(isoTimestamp?: string) {
  const ts = isoTimestamp || new Date().toISOString();
  lastSyncTimestamp = ts;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('summitforge_last_navica_pull', ts);
    } catch (e) {}
  }
}

export function getLastSyncTimestamp(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('summitforge_last_navica_pull');
      if (stored) {
        lastSyncTimestamp = stored;
        return stored;
      }
    } catch (e) {}
  }
  return lastSyncTimestamp;
}

export function formatLastSyncTime(iso?: string | null): string {
  const ts = iso || getLastSyncTimestamp();
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function isLastSyncRecent(iso?: string | null): boolean {
  const ts = iso || getLastSyncTimestamp();
  if (!ts) return false;
  try {
    const then = new Date(ts).getTime();
    const now = Date.now();
    return (now - then) < 60 * 60 * 1000; // 60 min window for "green"
  } catch {
    return false;
  }
}

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

// Auto-sync from DB on module load (fire-and-forget).
// Works reliably on server; browsers will populate after first live import + save.
syncRecentListingsFromSupabase();

// Back-compat alias
export const syncRecentFromSupabase = syncRecentListingsFromSupabase;

// Note: setRecentListings (defined above) auto-calls setLastSyncTimestamp() on updates.
// This + explicit setLastSyncTimestamp in UI pull handlers keeps header + pages in sync.
// "Live • Last: XX:XX" shown with green styling if recent.

