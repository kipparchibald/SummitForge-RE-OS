import { NextRequest, NextResponse } from 'next/server';
import { safeFetch } from '@/lib/net/safeFetch';
import { extractBranding } from '@/lib/branding/extract';

// Imports branding from a brokerage's public site.
//
// GET /api/branding/sync?url=https://example.com  (defaults to archibaldbagley.com)
//
// Any brokerage URL is accepted — that is the white-label on-ramp — so the fetch
// goes through safeFetch's SSRF guard. Everything returned is read off the page:
// when a field cannot be found it comes back empty and is listed in `missing`,
// rather than being filled with an invented value.

export const dynamic = 'force-dynamic';

const DEFAULT_SITE = 'https://www.archibaldbagley.com/';

export async function GET(request: NextRequest) {
  const target = request.nextUrl.searchParams.get('url') || DEFAULT_SITE;

  try {
    const res = await safeFetch(target, {
      headers: { 'User-Agent': 'SummitForge-RE-OS/1.0 (branding-sync)' },
    });

    if (!res.ok) {
      return NextResponse.json(
        { success: false, error: `Site responded ${res.status}`, url: target },
        { status: 502 }
      );
    }

    const html = await res.text();
    const branding = extractBranding(html, res.url || target);

    return NextResponse.json({
      success: true,
      url: target,
      branding,
      found: branding.found,
      missing: branding.missing,
      lastSync: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Branding] sync failed:', error?.message);
    return NextResponse.json(
      {
        success: false,
        url: target,
        error: error?.message || 'Could not reach the site',
        hint: 'Check the URL is public and reachable, then enter branding manually.',
      },
      { status: 502 }
    );
  }
}
