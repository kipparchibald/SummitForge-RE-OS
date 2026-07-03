import { NextRequest, NextResponse } from 'next/server';
import { importListings } from '@/lib/import/listings';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const source = formData.get('source') as any || 'mls';

    let input: any = file || url;

    if (!input) {
      return NextResponse.json({ error: 'No file or URL provided' }, { status: 400 });
    }

    const result = await importListings(input, source);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json({ error: 'Failed to import listings' }, { status: 500 });
  }
}