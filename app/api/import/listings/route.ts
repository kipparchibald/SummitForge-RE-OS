import { NextRequest, NextResponse } from 'next/server';
import { importListings } from '@/lib/import/listings';
import type { Alert } from '@/types/alerts';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const source = (formData.get('source') as any) || 'mls';
    const alertsJson = formData.get('alerts') as string | null;

    let input: any = file || url;

    if (!input) {
      return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 });
    }

    let alerts: Alert[] = [];
    if (alertsJson) {
      try {
        alerts = JSON.parse(alertsJson);
      } catch {
        // ignore bad alerts payload
      }
    }

    const result = await importListings(input, source, {
      alerts,
      runMatching: alerts.length > 0,
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
