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
 * Always works in DEMO mode (falls back to rich Jefferson County demo listings inside fetchArchibaldNavicaListings).
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
    if (result.listings && result.listings.length > 0) {
      await saveListings(result.listings);
      setRecentListings(result.listings);
    }

    const payload = {
      success: true,
      message: 'Navica sync completed',
      count: result.count,
      landCount: result.landCount,
      source: result.source,
      lastSync: result.lastSync,
      demo: result.source.toLowerCase().includes('demo'),
      listingsSample: result.listings.slice(0, 3).map(l => ({ address: l.address, acres: l.acres, price: l.price })),
    };

    console.log('[Cron Navica] Sync result:', { landCount: result.landCount, source: result.source });

    return NextResponse.json(payload);
  } catch (error: any) {
    console.error('[Cron Navica] Sync failed:', error);
    return NextResponse.json(
      { success: false, error: 'Navica sync failed' },
      { status: 500 }
    );
  }
}
