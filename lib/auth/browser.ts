// lib/auth/browser.ts
// Browser-side Supabase client for auth flows (login page, sign-out button)
// and dual-store CRM / alerts persistence. Always prefer this over raw
// createClient() so cookie sessions from @supabase/ssr are shared.

'use client';

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

let _client: SupabaseClient | null = null;
let _resolved = false;

function isLiveConfig(url?: string, key?: string): boolean {
  if (!url || !key) return false;
  if (url.includes('demo.supabase.co') || url.includes('your-project')) return false;
  if (key.includes('your-anon') || key.length < 20) return false;
  return true;
}

/** True when a real Supabase project is configured in the browser env. */
export function isBrowserSupabaseConfigured(): boolean {
  return isLiveConfig(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

/**
 * Shared browser Supabase client (cookie-backed via @supabase/ssr).
 * Returns null when not configured so dual-stores can fall back to localStorage.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (_resolved) return _client;
  _resolved = true;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!isLiveConfig(url, key)) {
    _client = null;
    return null;
  }

  _client = createBrowserClient(url!, key!);
  return _client;
}

/**
 * Current auth user id, or null when signed out / demo.
 */
export async function getBrowserUserId(): Promise<string | null> {
  const sb = getBrowserSupabase();
  if (!sb) return null;
  try {
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

const DEFAULT_BROKERAGE_SLUG = 'archibald-bagley';

/**
 * Resolve the signed-in agent's brokerage slug for multi-tenant writes.
 * Falls back to Archibald-Bagley when profile row is missing (bootstrap).
 */
export async function getBrowserBrokerageSlug(): Promise<string> {
  const sb = getBrowserSupabase();
  if (!sb) return DEFAULT_BROKERAGE_SLUG;
  try {
    const { data: auth } = await sb.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return DEFAULT_BROKERAGE_SLUG;

    const { data: profile } = await sb
      .from('profiles')
      .select('brokerage_id, role')
      .eq('id', uid)
      .maybeSingle();

    if (!profile?.brokerage_id) return DEFAULT_BROKERAGE_SLUG;

    // profiles.brokerage_id is UUID → resolve slug for TEXT columns on CRM/alerts
    const { data: broker } = await sb
      .from('brokerages')
      .select('slug')
      .eq('id', profile.brokerage_id)
      .maybeSingle();

    return (broker?.slug as string) || DEFAULT_BROKERAGE_SLUG;
  } catch {
    return DEFAULT_BROKERAGE_SLUG;
  }
}

export { DEFAULT_BROKERAGE_SLUG };
