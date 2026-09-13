/**
 * Intent scoring for the RISE-style loop.
 * Writes to crm_contacts.score + intent_reason (via applyIntentToContact).
 *
 * Signals: recency, stage, showings, nurture, alert desk activity,
 * linked transactions. Eastern Idaho / Archibald-Bagley context in copy.
 */

import type { CrmContact, CrmStage } from './store';
import type { ShowingRequest } from '@/lib/portal/matches';
import type { NurtureEnrollment } from '@/lib/nurture/sequences';
import type { StoredTransaction } from '@/lib/transaction/store';

export type IntentSignal = {
  code: string;
  weight: number;
  reason: string;
};

export type IntentContext = {
  contact: CrmContact;
  showings?: ShowingRequest[];
  enrollments?: NurtureEnrollment[];
  /** Recent alert matches at desk level (not per-contact) */
  alertMatchCount?: number;
  transactions?: StoredTransaction[];
};

const STAGE_WEIGHT: Record<CrmStage, number> = {
  active: 28,
  under_contract: 22,
  qualified: 18,
  nurture: 12,
  lead: 8,
  closed: 0,
  lost: 0,
};

const BOISE_TZ = 'America/Boise';

/** Days since an ISO timestamp; null → large number (never touched). */
export function daysSince(iso?: string | null): number {
  if (!iso) return 999;
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function areaLabel(areas: string[]): string {
  if (!areas.length) return 'Eastern Idaho';
  if (areas.length === 1) return areas[0];
  return `${areas[0]} area`;
}

/** Score + human reason from pipeline signals. */
export function computeIntent(ctx: IntentContext): {
  score: number;
  reason: string;
  signals: IntentSignal[];
} {
  const { contact } = ctx;
  const signals: IntentSignal[] = [];
  let score = 0;

  if (['closed', 'lost'].includes(contact.stage)) {
    return {
      score: 0,
      reason: contact.stage === 'lost' ? 'Marked lost — no outreach needed' : 'Closed — archive only',
      signals: [],
    };
  }

  // Stage baseline
  const stagePts = STAGE_WEIGHT[contact.stage] ?? 5;
  if (stagePts > 0) {
    signals.push({
      code: 'stage',
      weight: stagePts,
      reason:
        contact.stage === 'active'
          ? `Active search in ${areaLabel(contact.areas)}`
          : contact.stage === 'under_contract'
            ? 'Under contract — keep warm through close'
            : `Pipeline stage: ${contact.stage}`,
    });
    score += stagePts;
  }

  // Recency of touch
  const touchIso = contact.lastTouchedAt || contact.updatedAt;
  const days = daysSince(touchIso);
  if (days >= 14) {
    const w = 25;
    signals.push({
      code: 'stale',
      weight: w,
      reason: `No touch in ${days} days — ${areaLabel(contact.areas)} buyer going cold`,
    });
    score += w;
  } else if (days >= 7) {
    const w = 15;
    signals.push({
      code: 'aging',
      weight: w,
      reason: `Last touch ${days} days ago — check in before they shop another agent`,
    });
    score += w;
  } else if (days >= 3) {
    const w = 8;
    signals.push({
      code: 'due',
      weight: w,
      reason: `Due for a quick text — ${days} days since last touch`,
    });
    score += w;
  }

  // Interest specificity (Jefferson County context)
  if (contact.interest && contact.interest.length > 10) {
    const w = 6;
    signals.push({
      code: 'interest',
      weight: w,
      reason: `Interested in: ${contact.interest.slice(0, 80)}`,
    });
    score += w;
  }

  // Budget captured
  if (contact.budget && contact.budget > 0) {
    const w = 5;
    signals.push({
      code: 'budget',
      weight: w,
      reason: `Budget around $${contact.budget.toLocaleString()} — qualified buyer signal`,
    });
    score += w;
  }

  // Pending showings (match by area keyword in address or interest)
  const pendingShowings = (ctx.showings || []).filter((s) => s.status === 'pending');
  const relevantShowings = pendingShowings.filter((s) => {
    const blob = `${s.address} ${contact.interest} ${contact.areas.join(' ')}`.toLowerCase();
    return contact.areas.some((a) => blob.includes(a.toLowerCase())) || pendingShowings.length <= 3;
  });
  if (relevantShowings.length > 0) {
    const w = 30;
    const addr = relevantShowings[0].address;
    signals.push({
      code: 'showing',
      weight: w,
      reason: `Showing requested${addr ? `: ${addr}` : ''}`,
    });
    score += w;
  }

  // Active nurture
  const activeNurture = (ctx.enrollments || []).filter(
    (e) => e.contactId === contact.id && e.status === 'active'
  );
  if (activeNurture.length > 0) {
    const w = 10;
    signals.push({
      code: 'nurture',
      weight: w,
      reason: 'In active nurture sequence — personal touch beats auto-drip',
    });
    score += w;
  }

  // Desk alert activity (buyers market is hot)
  if (ctx.alertMatchCount && ctx.alertMatchCount > 0) {
    const w = Math.min(12, 4 + ctx.alertMatchCount);
    signals.push({
      code: 'alerts',
      weight: w,
      reason: `${ctx.alertMatchCount} new listing match${ctx.alertMatchCount > 1 ? 'es' : ''} on desk — share relevant ones`,
    });
    score += w;
  }

  // Linked open transaction
  const openTx = (ctx.transactions || []).filter(
    (t) => t.contactId === contact.id && t.status !== 'closed'
  );
  if (openTx.length > 0) {
    const w = 20;
    signals.push({
      code: 'transaction',
      weight: w,
      reason: `Open deal: ${openTx[0].address || 'transaction in progress'}`,
    });
    score += w;
  }

  // Phone present (SMS-first)
  if (contact.phone) {
    score += 3;
  }

  score = Math.min(99, Math.max(0, Math.round(score)));

  const top = [...signals].sort((a, b) => b.weight - a.weight);
  const reason =
    top[0]?.reason ||
    (contact.areas.length
      ? `Stay in touch — ${firstName(contact.name)} in ${areaLabel(contact.areas)}`
      : `Stay in touch with ${firstName(contact.name)}`);

  return { score, reason, signals };
}

/** Merge computed intent onto contact (does not persist). */
export function applyIntentToContact(
  contact: CrmContact,
  ctx: Omit<IntentContext, 'contact'>
): CrmContact {
  const result = computeIntent({ contact, ...ctx });
  return {
    ...contact,
    score: result.score,
    intentReason: result.reason,
  };
}

/** Whether contact should appear on /today queue. */
export function isEligibleForToday(contact: CrmContact, now = new Date()): boolean {
  if (['closed', 'lost'].includes(contact.stage)) return false;
  if (contact.dismissedAt) return false;
  if (contact.snoozedUntil && new Date(contact.snoozedUntil) > now) return false;
  return (contact.score ?? 0) > 0;
}

/** Tomorrow 8:00 AM America/Boise as ISO string. */
export function tomorrowMorningBoise(from = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: BOISE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  const parts = fmt.formatToParts(from);
  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1, 15, 0, 0));
  return tomorrow.toISOString();
}

/** Rank contacts for today queue (top N). */
export function rankForToday(
  contacts: CrmContact[],
  ctxByContact: Map<string, Omit<IntentContext, 'contact'>>,
  limit = 5,
  now = new Date()
): CrmContact[] {
  const scored = contacts
    .map((c) => applyIntentToContact(c, ctxByContact.get(c.id) || {}))
    .filter((c) => isEligibleForToday(c, now))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  return scored.slice(0, limit);
}

/** Record a human touch — clears dismiss, updates lastTouchedAt. */
export function recordTouch(contact: CrmContact, note?: string): CrmContact {
  const now = new Date().toISOString();
  return {
    ...contact,
    lastTouchedAt: now,
    updatedAt: now,
    dismissedAt: undefined,
    notes: note ? [...contact.notes, note] : contact.notes,
  };
}

export { BOISE_TZ };

/** Re-score every contact in a list (in-memory; caller persists). */
export function refreshAllContactIntent(
  contacts: CrmContact[],
  bundle: {
    showings?: ShowingRequest[];
    enrollments?: NurtureEnrollment[];
    transactions?: StoredTransaction[];
    alertMatchCount?: number;
  }
): CrmContact[] {
  return contacts.map((c) =>
    applyIntentToContact(c, {
      showings: bundle.showings,
      enrollments: bundle.enrollments,
      transactions: bundle.transactions,
      alertMatchCount: bundle.alertMatchCount,
    })
  );
}
