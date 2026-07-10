import { NextRequest, NextResponse } from 'next/server';
import { calculateLandFeasibility } from '@/lib/analysis/investment-proforma';

export const dynamic = 'force-dynamic';

// POST /api/development/analyze  { listing: { acres, price, address, rawData }, assumptions? }
export async function POST(request: NextRequest) {
  try {
    const { listing, assumptions } = await request.json();
    if (!listing) return NextResponse.json({ error: 'listing required' }, { status: 400 });
    const result = calculateLandFeasibility(listing, assumptions || {});
    if (!result) return NextResponse.json({ error: 'listing needs acres and price' }, { status: 422 });
    return NextResponse.json(result);
  } catch (error: any) {
    console.error('[development/analyze] error:', error);
    return NextResponse.json({ error: error?.message || 'failed' }, { status: 500 });
  }
}
