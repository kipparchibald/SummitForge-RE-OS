import { NextRequest, NextResponse } from 'next/server';
import { marketingAgent } from '@/lib/marketing/agent';
import type { CampaignBrief } from '@/lib/marketing/types';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import {
  clampString,
  guardErrorResponse,
  readJsonBody,
  RequestGuardError,
} from '@/lib/security/request';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/marketing
 *
 * Body options:
 * A) { brief: CampaignBrief }  → autonomous campaign (pending_approval)
 * B) { property, focusAreas? } → legacy plan (+ embedded campaign)
 * C) { action: 'rebuild', campaign, notes } → revision loop
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 20, windowMs: 60_000, key: 'ai-mkt' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const body = await readJsonBody<any>(request, 256 * 1024);

    // Rebuild with revision notes
    if (body.action === 'rebuild' && body.campaign && body.notes) {
      const notes = clampString(body.notes, 4000);
      const result = await marketingAgent.rebuildWithNotes(body.campaign, notes);
      return NextResponse.json({
        ...result,
        message: 'Campaign rebuilt with your notes. Review and approve to deploy.',
      });
    }

    // Full brief
    if (body.brief) {
      const brief = body.brief as CampaignBrief;
      if (!brief.property?.address) {
        throw new RequestGuardError('brief.property.address is required');
      }
      const result = await marketingAgent.buildCampaign(brief);
      return NextResponse.json({
        ...result,
        message: 'Campaign ready for your approval. Nothing has been published.',
      });
    }

    // Legacy property payload
    if (body.property) {
      const plan = await marketingAgent.generatePlan(body.property, body.focusAreas);
      return NextResponse.json(plan);
    }

    throw new RequestGuardError(
      'Provide { brief } or { property } or { action: "rebuild", campaign, notes }'
    );
  } catch (error: any) {
    if (error instanceof RequestGuardError) return guardErrorResponse(error);
    console.error('[api/ai/marketing]', error);
    return NextResponse.json({ error: 'Marketing agent error' }, { status: 500 });
  }
}
