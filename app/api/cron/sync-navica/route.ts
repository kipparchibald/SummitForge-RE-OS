import { NextRequest, NextResponse } from 'next/server';
import { fetchArchibaldNavicaListings } from '@/lib/import/navica';
import { saveListings } from '@/lib/supabase/client';
import { setRecentListings } from '@/lib/import/recentListings';
import { authorizeCron } from '@/lib/auth/cron';

export const dynamic = 'force-dynamic';

/**
 * Vercel Cron endpoint for background Navica/Archibald-Bagley IDX sync.
 * Schedule: hourly (see vercel.json).
 *
 * Security:
 * - If CRON_SECRET is set in env, requires Authorization: Bearer <CRON_SECRET> header.
 * - If CRON_SECRET is not set (DEMO, local dev), the endpoint is open (calls still succeed with demo data).
 * - Vercel automatically injects the Bearer header when CRON_SECRET is configured for the project.
 *
 * Always works in DEMO mode (falls back to rich Eastern Idaho demo listings inside fetchArchibaldNavicaListings).
 */
export async function GET(request: NextRequest) {
  // Fail-closed in production; open only in demo mode. See lib/auth/cron.ts.
  if (!authorizeCron(request).ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log('[Cron Navica] Starting background sync...');

    // Call the main fetcher (handles live or DEMO automatically)
    const result = await fetchArchibaldNavicaListings(100);

    // Explicitly call save + recent update as requested (idempotent with what fetch already does internally)
    let saved = 0;
    let persistError: string | undefined;
    if (result.listings && result.listings.length > 0) {
      const saveResult = await saveListings(result.listings);
      saved = saveResult.saved;
      persistError = saveResult.error;
      setRecentListings(result.listings);
    }

    // A sync that fetched listings but persisted none is a failure, not a
    // success — reporting 200/success here would hide a broken service-role key
    // or RLS policy behind a green check forever.
    const persisted = saved > 0 || result.landCount === 0;

    const payload = {
      success: persisted,
      message: persisted
        ? 'Navica sync completed'
        : 'Navica sync fetched listings but persisted none — check SUPABASE_SERVICE_ROLE_KEY and RLS policies',
      count: result.count,
      landCount: result.landCount,
      saved,
      ...(persistError ? { persistError } : {}),
      source: result.source,
      lastSync: result.lastSync,
      demo: result.source.toLowerCase().includes('demo'),
      listingsSample: result.listings.slice(0, 3).map(l => ({ address: l.address, acres: l.acres, price: l.price })),
    };

    console.log('[Cron Navica] Sync result:', {
      landCount: result.landCount,
      saved,
      persistError,
      source: result.source,
    });

    return NextResponse.json(payload, { status: persisted ? 200 : 500 });
  } catch (error: any) {
    console.error('[Cron Navica] Sync failed:', error);
    return NextResponse.json(
      { success: false, error: 'Navica sync failed' },
      { status: 500 }
    );
  }
}
