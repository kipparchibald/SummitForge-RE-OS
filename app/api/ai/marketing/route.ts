import { NextRequest, NextResponse } from 'next/server';
import { marketingAgent } from '@/lib/marketing/agent';
import type { CampaignBrief } from '@/lib/marketing/types';

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
  try {
    const body = await request.json();

    // Rebuild with revision notes
    if (body.action === 'rebuild' && body.campaign && body.notes) {
      const result = await marketingAgent.rebuildWithNotes(body.campaign, body.notes);
      return NextResponse.json({
        ...result,
        message: 'Campaign rebuilt with your notes. Review and approve to deploy.',
      });
    }

    // Full brief
    if (body.brief) {
      const brief = body.brief as CampaignBrief;
      if (!brief.property?.address) {
        return NextResponse.json({ error: 'brief.property.address is required' }, { status: 400 });
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

    return NextResponse.json(
      { error: 'Provide { brief } or { property } or { action: "rebuild", campaign, notes }' },
      { status: 400 }
    );
  } catch (error: any) {
    console.error('[api/ai/marketing]', error);
    return NextResponse.json(
      { error: 'Marketing agent error', message: error?.message || 'failed' },
      { status: 500 }
    );
  }
}
