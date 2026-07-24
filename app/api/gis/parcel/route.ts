import { NextRequest, NextResponse } from 'next/server';
import {
  matchParcel,
  parcelByApn,
  parcelByPoint,
  parcelToDto,
  parcelsInEnvelope,
} from '@/lib/development/parcel';
import { looksLikeEntity, lookupIdahoSosEntity } from '@/lib/development/idaho-sos';

export const dynamic = 'force-dynamic';

async function withOptionalSos(parcel: ReturnType<typeof parcelToDto>, sosFlag: string | null) {
  // Auto-resolve LLC/corp owners against Idaho SOS unless sos=0
  if (sosFlag === '0' || sosFlag === 'false') return parcel;
  const owner = parcel.owner;
  if (!owner || !looksLikeEntity(owner)) {
    return { ...parcel, sos: null as null };
  }
  try {
    const sos = await lookupIdahoSosEntity(owner);
    return { ...parcel, sos };
  } catch (e) {
    console.warn('[api/gis/parcel] SOS enrich failed', e);
    return { ...parcel, sos: null as null };
  }
}

/**
 * GET /api/gis/parcel?lat=&lng=          → identify parcel under map click
 * GET /api/gis/parcel?pin=RP…           → lookup by PIN/APN
 * GET /api/gis/parcel?bbox=w,s,e,n      → parcel outlines in viewport (capped)
 *
 * POST /api/gis/parcel  { lat, lng } | { pin } | { bbox: [w,s,e,n] }
 */
export async function GET(request: NextRequest) {
  try {
    const sp = request.nextUrl.searchParams;
    const lat = sp.get('lat');
    const lng = sp.get('lng');
    const pin = sp.get('pin') || sp.get('apn');
    const bbox = sp.get('bbox');

    if (bbox) {
      const parts = bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) {
        return NextResponse.json({ error: 'bbox must be west,south,east,north' }, { status: 400 });
      }
      const [w, s, e, n] = parts;
      // Guard against huge statewide pulls
      if (Math.abs(e - w) > 0.35 || Math.abs(n - s) > 0.35) {
        return NextResponse.json(
          { error: 'Zoom in further to load parcel outlines (bbox too large).' },
          { status: 400 }
        );
      }
      const fc = await parcelsInEnvelope(w, s, e, n, 100);
      return NextResponse.json({
        ok: true,
        mode: 'bbox',
        count: fc.features.length,
        geojson: fc,
      });
    }

    const sosFlag = sp.get('sos');

    if (pin) {
      const hit = await parcelByApn(pin);
      if (!hit) {
        return NextResponse.json(
          { ok: false, error: `No parcel found for PIN/APN “${pin}”.` },
          { status: 404 }
        );
      }
      const parcel = await withOptionalSos(parcelToDto(hit), sosFlag);
      return NextResponse.json({ ok: true, mode: 'pin', parcel });
    }

    if (lat != null && lng != null) {
      const la = Number(lat);
      const lo = Number(lng);
      if (!Number.isFinite(la) || !Number.isFinite(lo)) {
        return NextResponse.json({ error: 'lat and lng must be numbers' }, { status: 400 });
      }
      const hit = await parcelByPoint(la, lo);
      if (!hit) {
        return NextResponse.json(
          {
            ok: false,
            error:
              'No parcel found at this location. Try a more precise click, search by PIN, or zoom to a tax lot.',
          },
          { status: 404 }
        );
      }
      const parcel = await withOptionalSos(parcelToDto(hit), sosFlag);
      return NextResponse.json({ ok: true, mode: 'point', parcel });
    }

    return NextResponse.json(
      {
        error: 'Provide lat+lng, pin, or bbox',
        examples: [
          '/api/gis/parcel?lat=43.672&lng=-111.915',
          '/api/gis/parcel?pin=RP04N34E360000',
          '/api/gis/parcel?bbox=-111.95,43.65,-111.88,43.70',
        ],
      },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[api/gis/parcel]', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Parcel lookup failed' },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    if (Array.isArray(body.bbox) && body.bbox.length === 4) {
      const [w, s, e, n] = body.bbox.map(Number);
      if ([w, s, e, n].some((x) => !Number.isFinite(x))) {
        return NextResponse.json({ error: 'Invalid bbox' }, { status: 400 });
      }
      const fc = await parcelsInEnvelope(w, s, e, n, body.limit || 100);
      return NextResponse.json({ ok: true, mode: 'bbox', count: fc.features.length, geojson: fc });
    }

    const hit = await matchParcel({
      apn: body.pin || body.apn,
      lat: body.lat != null ? Number(body.lat) : null,
      lng: body.lng != null ? Number(body.lng) : null,
    });

    if (!hit) {
      return NextResponse.json({ ok: false, error: 'No parcel matched' }, { status: 404 });
    }
    const sosFlag = body.sos === false || body.sos === 0 ? '0' : null;
    const parcel = await withOptionalSos(parcelToDto(hit), sosFlag);
    return NextResponse.json({ ok: true, parcel });
  } catch (error: any) {
    console.error('[api/gis/parcel POST]', error);
    return NextResponse.json(
      { ok: false, error: error?.message || 'Parcel lookup failed' },
      { status: 502 }
    );
  }
}
