import { NextRequest, NextResponse } from 'next/server';
import { valuationAgent } from '@/lib/ai/valuation-agent';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { property, profile } = await request.json();
    const result = await valuationAgent.analyze(property, profile);
    return NextResponse.json(result);
  } catch (error) {
    console.error('Valuation error:', error);
    return NextResponse.json({ error: 'Valuation service unavailable' }, { status: 500 });
  }
}
