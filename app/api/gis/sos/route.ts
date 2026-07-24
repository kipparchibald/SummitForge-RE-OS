import { NextRequest, NextResponse } from 'next/server';
import {
  looksLikeEntity,
  lookupIdahoSosEntity,
  normalizeEntityQuery,
} from '@/lib/development/idaho-sos';

export const dynamic = 'force-dynamic';

/**
 * GET /api/gis/sos?owner=ACME%20LLC
 * POST /api/gis/sos { owner: "ACME LLC" }
 *
 * Idaho Secretary of State public business search → registered agent + members/managers.
 */
export async function GET(request: NextRequest) {
  const owner = request.nextUrl.searchParams.get('owner') || request.nextUrl.searchParams.get('q');
  if (!owner?.trim()) {
    return NextResponse.json(
      { error: 'Provide owner= (assessor owner of record / business name)' },
      { status: 400 }
    );
  }
  return runLookup(owner);
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const owner = body.owner || body.q || body.name;
  if (!owner?.trim()) {
    return NextResponse.json({ error: 'Provide { owner }' }, { status: 400 });
  }
  return runLookup(String(owner));
}

async function runLookup(owner: string) {
  try {
    const result = await lookupIdahoSosEntity(owner);
    return NextResponse.json({
      ok: true,
      isEntity: looksLikeEntity(owner),
      queryNormalized: normalizeEntityQuery(owner),
      sos: result,
    });
  } catch (e: any) {
    console.error('[api/gis/sos]', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'SOS lookup failed' },
      { status: 502 }
    );
  }
}
