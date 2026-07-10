import { NextRequest, NextResponse } from 'next/server';
import { scanLandDeals } from '@/lib/development/land-scan';

export const dynamic = 'force-dynamic';

// GET /api/development/land-scan?minAcres=5
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const minAcres = Number(url.searchParams.get('minAcres') ?? 5);
    const result = await scanLandDeals({ minAcres });
    return NextResponse.json({
      scannedAt: result.scannedAt, source: result.source,
      listingsScanned: result.listingsScanned, analyzed: result.analyzed,
      dealsPenciling: result.penciling.length,
      top: result.penciling.slice(0, 25), all: result.deals,
    });
  } catch (error: any) {
    console.error('[land-scan] error:', error);
    return NextResponse.json({ error: error?.message || 'scan failed' }, { status: 500 });
  }
}
