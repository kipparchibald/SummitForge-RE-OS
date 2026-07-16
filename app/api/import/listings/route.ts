import { NextRequest, NextResponse } from 'next/server';
import { importListings } from '@/lib/import/listings';
import type { Alert } from '@/types/alerts';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let input: any;
    let source: any = 'mls';
    let alerts: Alert[] = [];
    let siteUrl: string | undefined;

    if (contentType.includes('application/json')) {
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
        alerts = body.alerts;
      }
      if (typeof body.siteUrl === 'string') siteUrl = body.siteUrl;
    } else {
      // form data (existing CSV flow)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const url = formData.get('url') as string | null;
      source = (formData.get('source') as any) || 'mls';
      input = file || url;

      const alertsJson = formData.get('alerts') as string | null;
      if (alertsJson) {
        try {
          alerts = JSON.parse(alertsJson);
        } catch {
          // ignore bad alerts payload
        }
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

export async function GET() {
  // Convenience: direct live pull via GET /api/import/listings?live=navica
  try {
    const result = await importListings('live-navica', 'navica');
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json({ error: 'Live fetch failed' }, { status: 500 });
  }
}
