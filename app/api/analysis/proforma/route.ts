import { NextRequest, NextResponse } from 'next/server';
import { calculateRawLandProForma } from '@/lib/analysis/investment-proforma';

export async function POST(request: NextRequest) {
  try {
    const { listing, assumptions } = await request.json();
    
    if (!listing) {
      return NextResponse.json({ error: 'Listing data required' }, { status: 400 });
    }

    const result = calculateRawLandProForma(listing, assumptions);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Pro forma error:', error);
    return NextResponse.json({ error: 'Failed to calculate pro forma' }, { status: 500 });
  }
}