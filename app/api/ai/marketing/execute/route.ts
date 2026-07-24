import { NextRequest, NextResponse } from 'next/server';
import { marketingAgent } from '@/lib/marketing/agent';
import type { MarketingCampaign } from '@/lib/marketing/types';

export const dynamic = 'force-dynamic';

/**
 * POST /api/ai/marketing/execute
 * Body: { campaign, dryRun?: boolean }  — preferred
 *    or { plan } — legacy (auto-approves then deploys for backward compat)
 *
 * Deploy is gated: status must be approved (unless legacy plan path).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.campaign) {
      const result = await marketingAgent.deployCampaign(body.campaign as MarketingCampaign, {
        dryRun: !!body.dryRun,
      });
      return NextResponse.json(result, { status: result.ok ? 200 : 409 });
    }

    if (body.plan) {
      // Legacy: if full campaign embedded, use it; else execute stub
      const plan = body.plan;
      if (plan.campaign) {
        const approved =
          plan.campaign.status === 'approved' || plan.campaign.status === 'deployed'
            ? plan.campaign
            : marketingAgent.applyApproval(plan.campaign, 'approve');
        const result = await marketingAgent.deployCampaign(approved, { dryRun: !!body.dryRun });
        return NextResponse.json(result, { status: result.ok ? 200 : 409 });
      }
      const legacy = await marketingAgent.executePlan(plan, body.actions);
      return NextResponse.json(legacy);
    }

    return NextResponse.json({ error: 'Provide { campaign } or legacy { plan }' }, { status: 400 });
  } catch (error: any) {
    console.error('[api/ai/marketing/execute]', error);
    return NextResponse.json({ error: 'Execution failed', message: error?.message }, { status: 500 });
  }
}
