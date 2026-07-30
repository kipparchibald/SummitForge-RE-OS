import { NextRequest, NextResponse } from 'next/server';
import { leadQualifier } from '@/lib/ai/lead-qualifier';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import { guardErrorResponse, readJsonBody, RequestGuardError } from '@/lib/security/request';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 40, windowMs: 60_000, key: 'ai-lead' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const { leadInfo } = await readJsonBody<{ leadInfo?: unknown }>(request, 64 * 1024);
    if (!leadInfo || typeof leadInfo !== 'object') {
      throw new RequestGuardError('leadInfo object required');
    }
    const result = await leadQualifier.qualify(leadInfo as any);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RequestGuardError) return guardErrorResponse(error);
    return NextResponse.json({ error: 'Lead qualifier error' }, { status: 500 });
  }
}
