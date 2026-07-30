import { NextRequest, NextResponse } from 'next/server';
import { council } from '@/lib/ai/council';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import {
  clampString,
  guardErrorResponse,
  readJsonBody,
  RequestGuardError,
} from '@/lib/security/request';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 40, windowMs: 60_000, key: 'ai-council' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const body = await readJsonBody<{
      request?: string;
      profile?: unknown;
      context?: unknown;
    }>(request, 64 * 1024);

    const userRequest = clampString(body.request, 8000).trim();
    if (!userRequest) {
      throw new RequestGuardError(
        'Missing "request" field — send { request: "your question" }'
      );
    }

    if (body.profile) {
      council.setUserProfile(body.profile as any);
    }

    const result = await council.handleRequest(userRequest, (body.context as any) || {});

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof RequestGuardError) return guardErrorResponse(error);
    console.error('Council error:', error);
    return NextResponse.json(
      {
        error: 'Council temporarily unavailable',
        fallback:
          "I'm here to help with your real estate goals in Jefferson County. What would you like to focus on?",
      },
      { status: 500 }
    );
  }
}
