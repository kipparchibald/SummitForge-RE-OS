import { NextRequest, NextResponse } from 'next/server';
import { safeFetch } from '@/lib/net/safeFetch';
import { extractBranding } from '@/lib/branding/extract';

// Imports branding from a brokerage's public site.
//
// GET  /api/branding/sync?url=https://example.com
// POST /api/branding/sync  { "url": "https://example.com" }
//
// Defaults to archibaldbagley.com. Fetch is SSRF-guarded via safeFetch.

export const dynamic = 'force-dynamic';

const DEFAULT_SITE = 'https://www.archibaldbagley.com/';

function normalizeSiteUrl(raw: string | null | undefined): string {
  let s = (raw || DEFAULT_SITE).trim();
  if (!s) s = DEFAULT_SITE;
  if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
  // Prefer www for common brokerage apex that redirects anyway
  try {
    const u = new URL(s);
    if (!u.hostname.startsWith('www.') && u.hostname.split('.').length === 2) {
      // leave as-is; safeFetch follows redirects
    }
    return u.toString();
  } catch {
    return DEFAULT_SITE;
  }
}

async function syncBranding(rawUrl: string | null | undefined) {
  const target = normalizeSiteUrl(rawUrl);

  const res = await safeFetch(target, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; SummitForge-RE-OS/1.0; +https://summitforge.local; branding-sync)',
      Accept: 'text/html,application/xhtml+xml',
    },
  });

  if (!res.ok) {
    return NextResponse.json(
      {
        success: false,
        error: `Site responded ${res.status}`,
        url: target,
        hint: 'Check the URL is public. Try adding www. or https://',
      },
      { status: 502 }
    );
  }

  const html = await res.text();
  if (!html || html.length < 200) {
    return NextResponse.json(
      {
        success: false,
        error: 'Page returned almost no HTML (blocked or empty).',
        url: target,
      },
      { status: 502 }
    );
  }

  // Use final URL after redirects for absolute logo paths
  const finalUrl = res.url || target;
  const branding = extractBranding(html, finalUrl);

  const foundCount = branding.found.length;
  if (foundCount === 0) {
    return NextResponse.json(
      {
        success: false,
        error: 'Could not extract any branding fields from this page.',
        url: target,
        branding,
        found: [],
        missing: branding.missing,
        hint: 'Enter branding manually, or try the homepage URL of the brokerage.',
      },
      { status: 422 }
    );
  }

  return NextResponse.json({
    success: true,
    url: target,
    finalUrl,
    branding,
    found: branding.found,
    missing: branding.missing,
    colorSource: branding.colorSource,
    lastSync: new Date().toISOString(),
  });
}

export async function GET(request: NextRequest) {
  try {
    return await syncBranding(request.nextUrl.searchParams.get('url'));
  } catch (error: any) {
    console.error('[Branding] sync failed:', error?.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Could not reach the site',
        hint: 'Check the URL is public and reachable, then enter branding manually.',
      },
      { status: 502 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    return await syncBranding(body?.url || body?.domain || null);
  } catch (error: any) {
    console.error('[Branding] sync failed:', error?.message);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || 'Could not reach the site',
        hint: 'Check the URL is public and reachable, then enter branding manually.',
      },
      { status: 502 }
    );
  }
}
