import { createClient } from '@supabase/supabase-js';
import { isDemoMode } from '@/lib/env';

let _supabase: any = null;
let _supabaseAdmin: any = null;

/**
 * True only when a real Supabase project URL is configured. Without this guard
 * every read/write attempts a network call to the demo.supabase.co placeholder
 * and burns a DNS-failure round trip on each page load.
 */
export function isSupabaseLive(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  return !!url && !url.includes('demo.supabase.co') && !url.includes('your-project');
}

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
  auth: { getUser: async () => ({ data: { user: null } }) },
};

/**
 * Verify the listings table has the required columns (especially visibility).
 * Returns a structured diagnostic so cron / import can surface clear guidance.
 */
export async function verifyListingsSchema(): Promise<{
  ok: boolean;
  hasVisibility: boolean;
  message: string;
  details?: string;
}> {
  if (!isSupabaseLive()) {
    return {
      ok: true,
      hasVisibility: true,
      message: 'Supabase not configured — schema check skipped (demo mode)',
    };
  }

  try {
    const client = getSupabaseAdmin();
    // Attempt a minimal select that includes visibility. If the column is missing
    // Postgres returns 42703 and Supabase surfaces it in error.message / error.code.
    const { error } = await client
      .from('listings')
      .select('id, visibility')
      .limit(1);

    if (error) {
      const msg = (error.message || '').toLowerCase();
      const code = (error as any).code || '';
      if (code === '42703' || msg.includes('visibility') || msg.includes('column')) {
        return {
          ok: false,
          hasVisibility: false,
          message:
            'Missing listings.visibility column. Run supabase/migrations/2026-07-17-add-visibility.sql in the Supabase SQL editor.',
          details: error.message,
        };
      }
      return {
        ok: false,
        hasVisibility: false,
        message: `Schema check failed: ${error.message}`,
        details: error.message,
      };
    }

    return {
      ok: true,
      hasVisibility: true,
      message: 'Listings schema looks healthy (visibility column present)',
    };
  } catch (e: any) {
    return {
      ok: false,
      hasVisibility: false,
      message: `Schema verification error: ${e?.message || e}`,
    };
  }
}

/**
 * Save (upsert) an array of NormalizedListing (or compatible objects) to Supabase.
 * Always prefers service role client if SUPABASE_SERVICE_ROLE_KEY is configured.
 * Uses external_id for conflict resolution.
 * Surfaces clear guidance when the visibility column is missing.
 */
export async function saveListings(listings: any[]): Promise<{ saved: number; error?: string; schemaIssue?: boolean }> {
  if (!listings || listings.length === 0) return { saved: 0 };
  if (!isSupabaseLive()) return { saved: 0, error: 'Supabase not configured (demo mode)' };

  const client = getSupabaseAdmin();
  const now = new Date().toISOString();

  const rows = listings
    .map((l: any) => {
      let externalId = l.externalId || l.external_id || l.id || l['MLS #'] || l.mls || undefined;
      if (!externalId && l.address && l.price != null) {
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
        visibility: l.visibility || 'public',
        last_synced: now,
        geometry: l.geometry || null,
        raw_data: l.rawData || l,
        updated_at: now,
      };
    })
    .filter((r) => r.address && r.price != null);

  if (rows.length === 0) return { saved: 0 };

  // Postgres ON CONFLICT rejects a batch that targets the same conflict key twice.
  // Collapse duplicate external_ids first, keeping the last occurrence.
  const deduped = Array.from(
    rows.reduce((m, r) => m.set(r.external_id, r), new Map<string, (typeof rows)[number]>()).values()
  );

  const { error } = await client
    .from('listings')
    .upsert(deduped, { onConflict: 'external_id' });

  if (error) {
    const msg = (error.message || '').toLowerCase();
    const code = (error as any).code || '';
    const isVisibilityMissing =
      code === '42703' || msg.includes('visibility') || (msg.includes('column') && msg.includes('does not exist'));

    if (isVisibilityMissing) {
      console.error(
        '[Supabase] saveListings blocked: missing listings.visibility column. Run supabase/migrations/2026-07-17-add-visibility.sql'
      );
      return {
        saved: 0,
        error:
          'Missing listings.visibility column. Run supabase/migrations/2026-07-17-add-visibility.sql in the Supabase SQL editor, then retry.',
        schemaIssue: true,
      };
    }

    console.error('[Supabase] saveListings error:', error);
    return { saved: 0, error: error.message };
  }

  return { saved: deduped.length };
}

/**
 * Retrieve listings from Supabase, newest first.
 */
export async function getListingsFromSupabase(limit = 200, filters?: any): Promise<any[]> {
  if (!isSupabaseLive()) return [];
  const client = getSupabase();
  let query = client
    .from('listings')
    .select('*')
    .order('last_synced', { ascending: false })
    .limit(Math.min(limit, 500));

  if (isDemoMode()) query = query.eq('visibility', 'public');

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
 * Advanced query with free-text search + filters.
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
  if (!isSupabaseLive()) return [];
  const client = getSupabase();
  let query = client.from('listings').select('*');
  if (isDemoMode()) query = query.eq('visibility', 'public');

  if (searchTerm && searchTerm.trim().length > 0) {
    const term = searchTerm.trim();
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
