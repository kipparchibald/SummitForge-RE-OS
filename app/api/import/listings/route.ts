import { NextRequest, NextResponse } from 'next/server';
import { importListings } from '@/lib/import/listings';

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || '';

    let input: any;
    let source: any = 'mls';

    if (contentType.includes('application/json')) {
      const body = await request.json();
      if (body.live === 'navica' || body.source === 'navica') {
        input = 'live-navica';
        source = 'navica';
      } else {
        input = body.url || body.file || body.input;
        source = body.source || 'mls';
      }
    } else {
      // form data (existing CSV flow)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const url = formData.get('url') as string | null;
      source = formData.get('source') as any || 'mls';
      input = file || url;
    }

    if (!input) {
      return NextResponse.json({ error: 'No file, URL, or live source provided' }, { status: 400 });
    }

    const result = await importListings(input, source);

    return NextResponse.json(result);
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
