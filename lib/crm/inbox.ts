/**
 * Inbox drafts — SMS-first outreach, approve-only send.
 * Dual-store: localStorage + crm_outreach_drafts when signed in.
 */

import {
  DEFAULT_BROKERAGE_SLUG,
  getBrowserBrokerageSlug,
  getBrowserSupabase,
  getBrowserUserId,
} from '@/lib/auth/browser';
import type { CrmContact } from './store';

export type OutreachChannel = 'sms' | 'email';
export type OutreachStatus = 'draft' | 'approved' | 'sent_simulated' | 'cancelled';

export type OutreachDraft = {
  id: string;
  contactId: string;
  contactName: string;
  channel: OutreachChannel;
  subject?: string;
  body: string;
  status: OutreachStatus;
  source: string;
  intentReason?: string;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
};

const KEY = 'sf_crm_outreach_drafts';

function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

function areaLabel(areas: string[]): string {
  if (!areas.length) return 'Eastern Idaho';
  return areas.slice(0, 2).join(' / ');
}

/** SMS-first draft in Archibald-Bagley voice. */
export function buildSmsDraft(contact: CrmContact, intentReason?: string): string {
  const fn = firstName(contact.name);
  const area = areaLabel(contact.areas);
  const why = intentReason || contact.intentReason || contact.interest;

  if (why.toLowerCase().includes('showing')) {
    return `Hi ${fn} — Kipp with Archibald-Bagley. Saw your showing request. I can confirm a time today or send a couple of similar options in ${area}. Reply with what works.`;
  }
  if (contact.stage === 'active') {
    return `Hi ${fn} — quick check-in from Archibald-Bagley. Still hunting in ${area}? I have a few off-MLS notes that might fit. Want me to text 2 links?`;
  }
  if (why.length > 20) {
    return `Hi ${fn} — Kipp @ Archibald-Bagley. Re: ${why.slice(0, 60)}. Happy to jump on a 5-min call or keep it over text. What's your timeline in ${area}?`;
  }
  return `Hi ${fn} — Kipp with Archibald-Bagley. Following up on your ${area} search. Still looking, or should I pause updates?`;
}

export function buildEmailDraft(contact: CrmContact, intentReason?: string): {
  subject: string;
  body: string;
} {
  const fn = firstName(contact.name);
  const area = areaLabel(contact.areas);
  const why = intentReason || contact.intentReason || contact.interest;
  return {
    subject: `${fn} — ${area} update from Archibald-Bagley`,
    body: `Hi ${contact.name},\n\n${why}\n\nI'm keeping an eye on Jefferson County and ${area} for anything that fits${contact.budget ? ` around ${contact.budget.toLocaleString()}` : ''}. Reply here or text me if a quick call is easier.\n\n— Kipp Archibald\nArchibald-Bagley Real Estate\n(208) 745-5911`,
  };
}

export function loadDrafts(): OutreachDraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as OutreachDraft[]) : [];
  } catch {
    return [];
  }
}

export function saveDrafts(list: OutreachDraft[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 100)));
}

export function getDraft(id: string): OutreachDraft | undefined {
  return loadDrafts().find((d) => d.id === id);
}

export function upsertDraft(draft: OutreachDraft): OutreachDraft {
  const list = loadDrafts().filter((d) => d.id !== draft.id);
  list.unshift(draft);
  saveDrafts(list);
  void persistDraftAsync(draft);
  return draft;
}

export function createOutreachDraft(
  contact: CrmContact,
  opts: { source?: string; intentReason?: string; channel?: OutreachChannel } = {}
): OutreachDraft {
  const channel = opts.channel || 'sms';
  const now = new Date().toISOString();
  const smsBody = buildSmsDraft(contact, opts.intentReason);
  const email = buildEmailDraft(contact, opts.intentReason);

  const draft: OutreachDraft = {
    id: `draft_${Date.now()}_${contact.id.slice(-6)}`,
    contactId: contact.id,
    contactName: contact.name,
    channel,
    body: channel === 'sms' ? smsBody : email.body,
    subject: channel === 'email' ? email.subject : undefined,
    status: 'draft',
    source: opts.source || 'manual',
    intentReason: opts.intentReason || contact.intentReason,
    createdAt: now,
    updatedAt: now,
  };

  return upsertDraft(draft);
}

function rowToDraft(row: Record<string, unknown>): OutreachDraft {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    contactName: '',
    channel: (row.channel as OutreachChannel) || 'sms',
    subject: row.subject ? String(row.subject) : undefined,
    body: String(row.body || ''),
    status: (row.status as OutreachStatus) || 'draft',
    source: String(row.source || 'manual'),
    intentReason: row.intent_reason ? String(row.intent_reason) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    approvedAt: row.approved_at ? String(row.approved_at) : undefined,
  };
}

function draftToRow(draft: OutreachDraft, userId: string | null, brokerageId: string) {
  return {
    id: draft.id,
    contact_id: draft.contactId,
    user_id: userId,
    brokerage_id: brokerageId,
    channel: draft.channel,
    subject: draft.subject ?? null,
    body: draft.body,
    status: draft.status,
    source: draft.source,
    intent_reason: draft.intentReason ?? null,
    created_at: draft.createdAt,
    updated_at: draft.updatedAt,
    approved_at: draft.approvedAt ?? null,
  };
}

export async function loadDraftsAsync(): Promise<OutreachDraft[]> {
  const local = loadDrafts();
  const sb = getBrowserSupabase();
  if (!sb) return local;

  const userId = await getBrowserUserId();
  if (!userId) return local;

  try {
    const { data, error } = await sb
      .from('crm_outreach_drafts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    if (!error && data && data.length > 0) {
      const drafts = data.map(rowToDraft);
      saveDrafts(drafts);
      return drafts;
    }
  } catch {
    /* local fallback */
  }
  return local;
}

export async function persistDraftAsync(draft: OutreachDraft): Promise<void> {
  const sb = getBrowserSupabase();
  if (!sb) return;
  const userId = await getBrowserUserId();
  if (!userId) return;

  try {
    const brokerageId = (await getBrowserBrokerageSlug()) || DEFAULT_BROKERAGE_SLUG;
    await sb.from('crm_outreach_drafts').upsert(draftToRow(draft, userId, brokerageId), {
      onConflict: 'id',
    });
  } catch {
    /* local-only ok */
  }
}

export function markDraftApproved(draft: OutreachDraft): OutreachDraft {
  const now = new Date().toISOString();
  return upsertDraft({
    ...draft,
    status: 'approved',
    approvedAt: now,
    updatedAt: now,
  });
}

export function markDraftSentSimulated(draft: OutreachDraft): OutreachDraft {
  return upsertDraft({
    ...draft,
    status: 'sent_simulated',
    updatedAt: new Date().toISOString(),
  });
}

export function updateDraftBody(
  draft: OutreachDraft,
  patch: { body?: string; subject?: string; channel?: OutreachChannel }
): OutreachDraft {
  return upsertDraft({
    ...draft,
    ...patch,
    updatedAt: new Date().toISOString(),
  });
}
