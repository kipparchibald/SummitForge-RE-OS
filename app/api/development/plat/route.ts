import { NextRequest, NextResponse } from 'next/server';
import { matchParcel } from '@/lib/development/parcel';
import { designPlat, type LngLat } from '@/lib/development/plat-geometry';
import { bestDesign } from '@/lib/development/comps-design';
import { inferCounty } from '@/lib/development/land-engine';

export const dynamic = 'force-dynamic';

/**
 * POST /api/development/plat
 * Body: { lat?, lng?, apn?, county?, ring? }
 * Returns an on-parcel intelligent plat built from the REAL GIS boundary, with design
 * parameters learned from nearby subdivisions in similar zoning (else county preset).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let boundary: LngLat[] | undefined = body.ring;
    let cty: string | undefined = body.county;
    let cLat = body.lat != null ? Number(body.lat) : null;
    let cLng = body.lng != null ? Number(body.lng) : null;

    if (!boundary) {
      const p = await matchParcel({ apn: body.apn, lat: cLat, lng: cLng });
      if (!p) return NextResponse.json({ error: 'No GIS parcel matched. Provide an APN or lat/lng.' }, { status: 404 });
      boundary = p.ring;
      cty = cty || p.county || undefined;
    }
    if (!boundary || boundary.length < 3) {
      return NextResponse.json({ error: 'Invalid parcel geometry.' }, { status: 422 });
    }
    if (cLat == null || cLng == null) {
      const n = boundary.length;
      cLng = boundary.reduce((s, q) => s + q[0], 0) / n;
      cLat = boundary.reduce((s, q) => s + q[1], 0) / n;
    }

    const countyKey = inferCounty(undefined, cty);
    const design = await bestDesign(cLat, cLng, countyKey);
    const plat = designPlat(boundary, countyKey, design);

    return NextResponse.json(plat);
  } catch (error: any) {
    console.error('[development/plat] error:', error);
    return NextResponse.json({ error: error?.message || 'plat generation failed' }, { status: 500 });
  }
}
