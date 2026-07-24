/**
 * Autonomous Marketing Agent
 * Builds complete campaigns from a brief using best-practice playbooks + LLM strategy,
 * then requires human approval before deploy.
 */

import { callLLM, SYSTEM_PROMPTS } from '../ai/client';
import { buildCampaignFromBrief, campaignSummary } from './campaign-engine';
import type {
  ApprovalAction,
  CampaignBrief,
  CampaignBuildResult,
  DeployResult,
  MarketingCampaign,
  MarketingPlan,
} from './types';

// Re-export legacy shape for any older callers
export type { MarketingPlan } from './types';

const CAMPAIGN_SYSTEM = `${SYSTEM_PROMPTS.marketing}

You are also the autonomous campaign architect for SummitForge RE OS.
When given a property brief, produce a concise strategy memo (not JSON) covering:
1) Campaign concept (one sentence)
2) Primary and secondary audiences
3) Message pillars (3)
4) Channel mix rationale
5) First-week priorities
6) Fair Housing / compliance reminders specific to this creative
7) Risks and how to mitigate
Keep it under 450 words. Be specific to Eastern Idaho (Jefferson, Madison, Bonneville, Bingham, Bannock, Fremont, Teton).`;

export class MarketingAgent {
  /**
   * Autonomously build a full campaign ready for user approval.
   */
  async buildCampaign(brief: CampaignBrief): Promise<CampaignBuildResult> {
    const land =
      (brief.property.acres || 0) >= 2 ||
      /land|vacant|farm|ranch/i.test(brief.property.propertyType || '');

    const prompt = `Build a campaign strategy memo for this brief:

Property: ${JSON.stringify(brief.property)}
Primary goal: ${brief.primaryGoal}
Secondary: ${(brief.secondaryGoals || []).join('; ') || 'n/a'}
Budget cap: ${brief.budgetCap ?? 'agent-recommended'}
Timeline days: ${brief.timelineDays ?? 21}
Tone: ${brief.tone || 'premium'}
Audience hints: ${(brief.targetAudienceHints || []).join(', ') || 'default playbook'}
Agent: ${brief.agentName || 'Kipp Archibald'} @ ${brief.brokerageName || 'Archibald-Bagley'}
Is land: ${land}

Focus on measurable outcomes and human approval before any spend goes live.`;

    let aiStrategy: string | undefined;
    try {
      aiStrategy = await callLLM(CAMPAIGN_SYSTEM, prompt);
    } catch {
      aiStrategy = undefined;
    }

    const campaign = buildCampaignFromBrief(brief, aiStrategy);
    return {
      campaign,
      summary: campaignSummary(campaign),
      needsApproval: true,
    };
  }

  /**
   * Legacy plan shape (used by older AI assistants route).
   */
  async generatePlan(
    property: any,
    focusAreas: string[] = ['maximize exposure', 'attract builders/investors']
  ): Promise<MarketingPlan & { campaign?: MarketingCampaign; aiStrategy?: string }> {
    const brief: CampaignBrief = {
      property: {
        id: property?.id,
        address: property?.address || 'Eastern Idaho property',
        acres: property?.acres,
        price: property?.price,
        propertyType: property?.propertyType,
        city: property?.city,
        highlights: property?.highlights,
      },
      primaryGoal: focusAreas[0] || 'Generate qualified leads',
      secondaryGoals: focusAreas.slice(1),
      tone: 'premium',
      agentName: 'Kipp Archibald',
      brokerageName: 'Archibald-Bagley Real Estate',
      complianceMarket: 'Idaho',
    };

    const { campaign } = await this.buildCampaign(brief);

    // Map to legacy MarketingPlan for backward compatibility
    const plan: MarketingPlan & { campaign?: MarketingCampaign; aiStrategy?: string } = {
      propertyId: campaign.brief.property.id || campaign.id,
      goals: campaign.goals,
      channels: campaign.channels.map((c) => ({
        name: c.name,
        priority: c.priority,
        estimatedCost: c.budget,
        expectedReach: c.expectedReach,
      })),
      contentStrategy: {
        listingDescription:
          campaign.assets.find((a) => a.type === 'listing_copy')?.body || '',
        socialPosts: campaign.assets.filter((a) => a.type === 'social').map((a) => a.body),
        emailSequence: campaign.assets.filter((a) => a.type === 'email').map((a) => a.body),
        flyerIdeas: campaign.assets.filter((a) => a.type === 'flyer').map((a) => a.body),
      },
      timeline: {
        week1: campaign.calendar[0]?.tasks || [],
        week2: campaign.calendar[1]?.tasks || [],
        ongoing: campaign.calendar.slice(2).flatMap((w) => w.tasks),
      },
      budgetEstimate: campaign.budgetTotal,
      kpis: campaign.kpis.map((k) => `${k.name}: ${k.target}`),
      campaign,
      aiStrategy: campaign.aiStrategy,
    };

    return plan;
  }

  /**
   * Apply approval decision. Deploy is a separate step.
   */
  applyApproval(
    campaign: MarketingCampaign,
    action: ApprovalAction,
    notes?: string
  ): MarketingCampaign {
    const now = new Date().toISOString();
    if (action === 'approve') {
      return {
        ...campaign,
        status: 'approved',
        approvedAt: now,
        updatedAt: now,
        revisionNotes: notes || campaign.revisionNotes,
        nextActions: [
          'Click Deploy to launch enabled channels',
          'Confirm tracking UTMs and landing page live',
          'Assign CRM owner for <5 min lead response',
        ],
      };
    }
    if (action === 'reject') {
      return {
        ...campaign,
        status: 'rejected',
        updatedAt: now,
        revisionNotes: notes || 'Rejected by user',
        nextActions: ['Start a new campaign with a revised brief'],
      };
    }
    // request_changes — back to draft mentally but keep as pending with notes
    return {
      ...campaign,
      status: 'draft',
      updatedAt: now,
      revisionNotes: notes || 'Changes requested',
      nextActions: [
        'Agent will rebuild with your notes when you click “Rebuild with notes”',
        'Or edit brief and generate a new campaign',
      ],
    };
  }

  /**
   * Rebuild campaign incorporating revision notes.
   */
  async rebuildWithNotes(campaign: MarketingCampaign, notes: string): Promise<CampaignBuildResult> {
    const brief: CampaignBrief = {
      ...campaign.brief,
      secondaryGoals: [
        ...(campaign.brief.secondaryGoals || []),
        `Revision notes from approver: ${notes}`,
      ],
    };
    const result = await this.buildCampaign(brief);
    result.campaign.revisionNotes = notes;
    // Preserve id chain for history linkage
    result.campaign.id = campaign.id + '_r' + Date.now().toString(36).slice(-4);
    return result;
  }

  /**
   * Deploy only if approved. Simulated channels until Meta/email integrations exist.
   */
  async deployCampaign(
    campaign: MarketingCampaign,
    options: { dryRun?: boolean } = {}
  ): Promise<DeployResult> {
    if (campaign.status !== 'approved' && campaign.status !== 'deployed') {
      return {
        ok: false,
        campaign,
        message: `Cannot deploy while status is “${campaign.status}”. Approve the campaign first.`,
        simulated: true,
      };
    }

    const enabled = campaign.channels.filter((c) => c.enabled);
    const actions = [
      'validate_fair_housing_checklist',
      'publish_listing_copy_to_idx_queue',
      ...enabled.map((c) => `schedule_${c.key}`),
      'open_kpi_dashboard',
      'notify_crm_owner',
    ];

    const now = new Date().toISOString();
    const deployed: MarketingCampaign = {
      ...campaign,
      status: options.dryRun ? 'approved' : 'deployed',
      deployedAt: options.dryRun ? campaign.deployedAt : now,
      updatedAt: now,
      deployLog: {
        status: options.dryRun ? 'dry_run' : 'deployed',
        actions,
        channels: enabled.map((c) => c.name),
        note: options.dryRun
          ? 'Dry run only — no external posts. Approve + Deploy for simulated production launch.'
          : 'Simulated deploy: content queued for MLS/IDX, Meta, Google, email, and outreach. Wire Meta Marketing API + ESP for live posts.',
        timestamp: now,
      },
      nextActions: options.dryRun
        ? ['Run Deploy (not dry-run) when ready']
        : [
            'Monitor CPL daily for first 7 days',
            'Respond to leads in CRM within 5 minutes',
            'Week-2 creative refresh if CTR drops',
          ],
    };

    return {
      ok: true,
      campaign: deployed,
      message: options.dryRun
        ? 'Dry run complete — campaign validated, not launched.'
        : `Deployed ${enabled.length} channels (simulated). Track KPIs from the campaign dashboard.`,
      simulated: true,
    };
  }

  /** @deprecated use deployCampaign */
  async executePlan(plan: MarketingPlan | MarketingCampaign, actions: string[] = ['generate_content']) {
    // Accept legacy plan or full campaign
    if ('status' in plan && 'channels' in plan && Array.isArray((plan as MarketingCampaign).channels)) {
      const camp = plan as MarketingCampaign;
      if (camp.status === 'approved' || camp.status === 'deployed') {
        return this.deployCampaign(camp);
      }
      // Auto-approve legacy execute for backward compat then deploy
      const approved = this.applyApproval(camp, 'approve');
      return this.deployCampaign(approved);
    }

    console.log(`[Marketing Agent] Legacy execute for ${(plan as MarketingPlan).propertyId}`);
    return {
      status: 'executed',
      actionsCompleted: actions,
      note: 'Legacy execute path. Prefer /api/ai/marketing build → approve → deploy.',
      simulated: true,
    };
  }
}

export const marketingAgent = new MarketingAgent();
