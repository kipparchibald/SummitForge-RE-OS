import { NextRequest, NextResponse } from 'next/server';
import { findMatchesForAlerts } from '@/lib/alerts/matching';
import type { Alert, Listing } from '@/types/alerts';

/**
 * POST /api/alerts/rematch
 * Body: { alerts: Alert[], listings?: Listing[] }
 * If listings omitted, returns empty matches (client should send cached listings or re-import).
 * For now this is a pure scoring endpoint; client persists results via dual store.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const alerts: Alert[] = body.alerts || [];
    const listings: Listing[] = body.listings || [];

    if (!alerts.length) {
      return NextResponse.json({ error: 'No alerts provided' }, { status: 400 });
    }

    if (!listings.length) {
      return NextResponse.json({
        success: true,
        matches: [],
        message:
          'No listings provided. Import a Navica CSV first, or pass listings in the request body.',
      });
    }

    const matches = findMatchesForAlerts(listings, alerts);

    return NextResponse.json({
      success: true,
      matches,
      count: matches.length,
      message: `Generated ${matches.length} matches from ${listings.length} listings.`,
    });
  } catch (error) {
    console.error('Rematch error:', error);
    return NextResponse.json({ error: 'Rematch failed' }, { status: 500 });
  }
}
