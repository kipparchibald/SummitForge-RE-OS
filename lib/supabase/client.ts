import { createClient } from '@supabase/supabase-js';

let _supabase: any = null;
let _supabaseAdmin: any = null;

export function getSupabase() {
  if (!_supabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://demo.supabase.co';
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';
    _supabase = createClient(url, key);
  }
  return _supabase;
}

/**
 * Returns a Supabase client with service_role privileges when SUPABASE_SERVICE_ROLE_KEY is set.
 * Falls back to anon key. IMPORTANT: Service role must only be used in server-side code (API routes, server components).
 */
export function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://demo.supabase.co';
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'demo-anon-key';
    const key = serviceKey || fallbackKey;
    _supabaseAdmin = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return _supabaseAdmin;
}

export const supabase = {
  from: (...args: any[]) => getSupabase().from(...args),
  // Add other common methods as needed for build/demo
  auth: { getUser: async () => ({ data: { user: null } }) },
};

/**
 * Save (upsert) an array of NormalizedListing (or compatible objects) to Supabase.
 * Always prefers service role client if SUPABASE_SERVICE_ROLE_KEY is configured.
 * Uses external_id for conflict resolution.
 */
export async function saveListings(listings: any[]): Promise<{ saved: number; error?: string }> {
  if (!listings || listings.length === 0) return { saved: 0 };

  const client = getSupabaseAdmin(); // service role for writes when available
  const now = new Date().toISOString();

  const rows = listings
    .map((l: any) => {
      let externalId = l.externalId || l.external_id || l.id || l['MLS #'] || l.mls || undefined;
      if (!externalId && l.address && l.price != null) {
        // Fallback stable key for listings without MLS id
        externalId = `gen-${l.source || 'imp'}-${l.address.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 30)}-${Math.round(Number(l.price))}`;
      }
      return {
        external_id: externalId ? String(externalId) : `gen-unknown-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        address: l.address,
        price: l.price != null ? Number(l.price) : 0,
        acres: l.acres != null ? Number(l.acres) : null,
        property_type: l.propertyType || l.property_type || 'Land',
        description: l.description || null,
        url: l.url || null,
        source: l.source || 'unknown',
        last_synced: now,
        geometry: l.geometry || null,
        raw_data: l.rawData || l,
        updated_at: now,
      };
    })
    .filter((r) => r.address && r.price != null);

  if (rows.length === 0) return { saved: 0 };

  // Postgres ON CONFLICT rejects a batch that targets the same conflict key twice
  // ("cannot affect row a second time"), which would fail the entire save. Collapse
  // duplicate external_ids first, keeping the last occurrence.
  const deduped = Array.from(
    rows.reduce((m, r) => m.set(r.external_id, r), new Map<string, typeof rows[number]>()).values()
  );

  const { error } = await client
    .from('listings')
    .upsert(deduped, { onConflict: 'external_id' });

  if (error) {
    console.error('[Supabase] saveListings error:', error);
    return { saved: 0, error: error.message };
  }

  return { saved: rows.length };
}

/**
 * Retrieve listings from Supabase, newest first.
 */
export async function getListingsFromSupabase(limit = 200, filters?: any): Promise<any[]> {
  const client = getSupabase();
  let query = client
    .from('listings')
    .select('*')
    .order('last_synced', { ascending: false })
    .limit(Math.min(limit, 500));

  if (filters?.source) query = query.eq('source', filters.source);
  if (filters?.minPrice != null) query = query.gte('price', filters.minPrice);
  if (filters?.maxPrice != null) query = query.lte('price', filters.maxPrice);
  if (filters?.minAcres != null) query = query.gte('acres', filters.minAcres);

  const { data, error } = await query;
  if (error) {
    console.warn('[Supabase] getListingsFromSupabase error:', error.message);
    return [];
  }
  return data || [];
}

/**
 * Advanced query with free-text search + filters. Used for live searchable listings.
 * searchTerm matches address, description (ilike), or external_id / MLS #.
 * Supports MLS # search (e.g. partial match on numeric MLS ids), description search, etc.
 */
export async function queryListings(
  searchTerm?: string,
  filters?: {
    minAcres?: number;
    maxPrice?: number;
    source?: string;
    propertyType?: string;
    limit?: number;
  }
): Promise<any[]> {
  const client = getSupabase();
  let query = client.from('listings').select('*');

  if (searchTerm && searchTerm.trim().length > 0) {
    const term = searchTerm.trim();
    // Support MLS # search (external_id), description search, address
    // Use broad or for fuzzy-like matches from DB
    query = query.or(`address.ilike.%${term}%,description.ilike.%${term}%,external_id.ilike.%${term}%`);
  }

  if (filters) {
    if (filters.minAcres != null) query = query.gte('acres', filters.minAcres);
    if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice);
    if (filters.source) query = query.eq('source', filters.source);
    if (filters.propertyType) query = query.ilike('property_type', `%${filters.propertyType}%`);
  }

  const lim = filters?.limit || 100;
  query = query.order('last_synced', { ascending: false }).limit(Math.min(lim, 500));

  const { data, error } = await query;
  if (error) {
    console.error('[Supabase] queryListings error:', error);
    return [];
  }
  return data || [];
}