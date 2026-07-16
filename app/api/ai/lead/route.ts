import { NextRequest, NextResponse } from 'next/server';
import { leadQualifier } from '@/lib/ai/lead-qualifier';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { leadInfo } = await request.json();
    const result = await leadQualifier.qualify(leadInfo);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Lead qualifier error' }, { status: 500 });
  }
}
