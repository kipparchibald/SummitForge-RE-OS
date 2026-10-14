import type { CrmContact, CrmStage } from '@/lib/crm/store';

export type ScoreBreakdown = {
  total: number;
  readiness: number;
  engagement: number;
  fit: number;
  urgency: number;
  recommendedSequenceId: string;
  band: 'hot' | 'warm' | 'nurture' | 'cold';
};

const STAGE_READY: Record<CrmStage, number> = {
  lead: 8, qualified: 16, nurture: 10, active: 22,
  under_contract: 28, closed: 6, lost: 0,
};

export function scoreContact(c: CrmContact, now = new Date()): ScoreBreakdown {
  const budget = c.budget ?? 0;
  const notes = c.notes?.length ?? 0;
  const ageDays = Math.max(0, (now.getTime() - new Date(c.updatedAt || c.createdAt).getTime()) / 86400000);
  const readiness = clamp(STAGE_READY[c.stage] + (budget >= 400000 ? 6 : budget > 0 ? 3 : 0) + (c.interest ? 4 : 0));
  const engagement = clamp((c.phone ? 10 : 0) + (c.email ? 6 : 0) + Math.min(8, notes * 2) - Math.min(12, Math.floor(ageDays / 14)));
  const fit = clamp((c.areas?.length ? 8 : 0) + (/rigby|ririe|jefferson|teton|rexburg/i.test(`${(c.areas || []).join(' ')} ${c.interest}`) ? 10 : 4) + (/lot|acre|new build|new construction|spec|land/i.test(c.interest) ? 8 : 2));
  const urgency = clamp((c.stage === 'active' || c.stage === 'qualified' ? 10 : 4) + (ageDays < 7 ? 8 : ageDays < 21 ? 4 : 0) - (c.stage === 'lost' ? 20 : 0));
  const total = clampScore(Math.round(readiness + engagement + fit + urgency));
  const band: ScoreBreakdown['band'] = total >= 80 ? 'hot' : total >= 65 ? 'warm' : total >= 45 ? 'nurture' : 'cold';
  return { total, readiness, engagement, fit, urgency, recommendedSequenceId: pickSequence(c.stage, band, c.interest), band };
}

export function pickSequence(stage: CrmStage, band: ScoreBreakdown['band'], interest: string): string {
  const i = (interest || '').toLowerCase();
  if (stage === 'under_contract') return 'under-contract-care';
  if (stage === 'closed') return 'past-client-sphere';
  if (stage === 'lost' || band === 'cold') return 'stale-lead-reengage';
  if (/lot|acre|land|teton heights/.test(i)) return 'lot-buyer-teton';
  if (/new build|new construction|spec|builder/.test(i)) return 'new-construction-buyer';
  if (stage === 'active' || band === 'hot') return 'active-search-weekly';
  if (stage === 'lead') return 'new-lead-welcome';
  return 'active-search-weekly';
}

function clamp(n: number) { return Math.max(0, Math.min(30, n)); }
export function clampScore(n: number) { return Math.max(0, Math.min(100, n)); }
