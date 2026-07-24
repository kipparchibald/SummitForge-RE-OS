import { NextRequest, NextResponse } from 'next/server';
import { marketingAgent } from '@/lib/marketing/agent';
import type { ApprovalAction, MarketingCampaign } from '@/lib/marketing/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/marketing/approve
 * Body: { campaign, action: 'approve' | 'reject' | 'request_changes', notes? }
 *
 * Human-in-the-loop gate — deploy is blocked until status === 'approved'.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const campaign = body.campaign as MarketingCampaign | undefined;
    const action = body.action as ApprovalAction | undefined;
    const notes = typeof body.notes === 'string' ? body.notes : undefined;

    if (!campaign?.id || !action) {
      return NextResponse.json(
        { error: 'campaign and action (approve | reject | request_changes) required' },
        { status: 400 }
      );
    }
    if (!['approve', 'reject', 'request_changes'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const updated = marketingAgent.applyApproval(campaign, action, notes);
    return NextResponse.json({
      campaign: updated,
      message:
        action === 'approve'
          ? 'Approved. You can deploy when ready.'
          : action === 'reject'
            ? 'Campaign rejected. Start a new brief when ready.'
            : 'Changes requested. Rebuild with notes or edit the brief.',
    });
  } catch (error: any) {
    console.error('[api/ai/marketing/approve]', error);
    return NextResponse.json({ error: error?.message || 'Approval failed' }, { status: 500 });
  }
}
