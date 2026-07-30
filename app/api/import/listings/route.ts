import { NextRequest, NextResponse } from 'next/server';
import { importListings } from '@/lib/import/listings';
import type { Alert } from '@/types/alerts';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import { assertPublicUrl } from '@/lib/net/safeFetch';

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 15, windowMs: 60_000, key: 'import' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const contentType = request.headers.get('content-type') || '';

    let input: any;
    let source: any = 'mls';
    let alerts: Alert[] = [];
    let siteUrl: string | undefined;

    if (contentType.includes('application/json')) {
      const cl = request.headers.get('content-length');
      if (cl && Number(cl) > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'Request too large' }, { status: 413 });
      }
      const body = await request.json();
      if (body.live === 'navica' || body.source === 'navica') {
        input = 'live-navica';
        source = 'navica';
      } else if (body.live === 'site' || body.source === 'idx-site') {
        input = 'live-site';
        source = 'idx-site';
      } else {
        input = body.url || body.file || body.input;
        source = body.source || 'mls';
      }
      if (Array.isArray(body.alerts)) {
        // Cap alert array size to avoid pathological matching costs
        alerts = body.alerts.slice(0, 200) as Alert[];
      }
      if (typeof body.siteUrl === 'string') siteUrl = body.siteUrl;
    } else {
      // form data (existing CSV flow)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const url = formData.get('url') as string | null;
      source = (formData.get('source') as any) || 'mls';
      input = file || url;

      if (file && typeof file.size === 'number' && file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'CSV file too large (max 5MB)' }, { status: 413 });
      }

      const alertsJson = formData.get('alerts') as string | null;
      if (alertsJson) {
        try {
          const parsed = JSON.parse(alertsJson);
          if (Array.isArray(parsed)) alerts = parsed.slice(0, 200) as Alert[];
        } catch {
          // ignore bad alerts payload
        }
      }
    }

    // SSRF guard when input is a remote URL string
    if (typeof input === 'string' && /^https?:\/\//i.test(input)) {
      try {
        assertPublicUrl(input);
      } catch {
        return NextResponse.json({ error: 'URL not allowed' }, { status: 400 });
      }
    }
    if (siteUrl) {
      try {
        assertPublicUrl(siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`);
      } catch {
        return NextResponse.json({ error: 'siteUrl not allowed' }, { status: 400 });
      }
    }

    if (!input) {
      return NextResponse.json({ error: 'No file, URL, or live source provided' }, { status: 400 });
    }

    const result = await importListings(input, source, {
      alerts,
      runMatching: alerts.length > 0,
      siteUrl,
    });

    return NextResponse.json({
      ...result,
      success: true,
      message: `Imported ${result.imported} listings. Generated ${result.matches?.length || 0} matches.`,
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import listings' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const rl = rateLimit(request, { limit: 10, windowMs: 60_000, key: 'import-get' });
  if (!rl.ok) return rateLimitResponse(rl);

  // Convenience: direct live pull via GET /api/import/listings?live=navica
  try {
    const result = await importListings('live-navica', 'navica');
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: 'Live fetch failed' }, { status: 500 });
  }
}
