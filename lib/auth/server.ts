// lib/auth/server.ts
// Server-side Supabase auth helpers (App Router / @supabase/ssr).
//
// Mirrors the fail-closed philosophy of lib/auth/cron.ts:
// - DEMO mode (NEXT_PUBLIC_DEMO_MODE=true): auth is bypassed so the app can be
//   previewed without a Supabase project.
// - Production with Supabase configured: a valid session is required.
// - Production WITHOUT Supabase configured: deny — forgetting to configure auth
//   must not silently leave the app world-open.

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { isSupabaseLive } from '@/lib/supabase/client';
import { isDemoMode } from '@/lib/env';

export function isAuthEnforced(): boolean {
  return !isDemoMode();
}

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — middleware handles refresh.
          }
        },
      },
    }
  );
}

/**
 * Current authenticated user, or null.
 * In demo mode (or when Supabase is not configured) returns a stub demo user
 * so pages can render; isAuthEnforced() tells callers whether that's real.
 */
export async function getCurrentUser() {
  if (!isAuthEnforced() || !isSupabaseLive()) {
    return { id: 'demo-user', email: 'demo@summitforge.local', demo: true } as const;
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
