import { NextRequest, NextResponse } from 'next/server';
import { valuationAgent } from '@/lib/ai/valuation-agent';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import { guardErrorResponse, readJsonBody, RequestGuardError } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 30, windowMs: 60_000, key: 'ai-val' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const { property, profile } = await readJsonBody<{
      property?: unknown;
      profile?: unknown;
    }>(request, 128 * 1024);
    if (!property || typeof property !== 'object') {
      throw new RequestGuardError('property object required');
    }
    const result = await valuationAgent.analyze(property as any, profile as any);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RequestGuardError) return guardErrorResponse(error);
    console.error('Valuation error:', error);
    return NextResponse.json({ error: 'Valuation service unavailable' }, { status: 500 });
  }
}
