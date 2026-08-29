'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { CRM_STAGES, type CrmContact } from '@/lib/crm/store';
import { applyIntentToContact, computeIntent, daysSince } from '@/lib/crm/intent';
import { buildContactContext } from '@/lib/crm/intent-context';
import type { ShowingRequest } from '@/lib/portal/matches';
import type { NurtureEnrollment, NurtureSequence } from '@/lib/nurture/sequences';
import { NURTURE_SEQUENCES } from '@/lib/nurture/sequences';
import type { StoredTransaction } from '@/lib/transaction/store';

export type Contact360Props = {
  contact: CrmContact;
  showings: ShowingRequest[];
  enrollments: NurtureEnrollment[];
  transactions?: StoredTransaction[];
  alertMatchCount?: number;
  onTouch?: () => void;
  onOpenDraft?: () => void;
};

type TimelineItem = {
  id: string;
  at: string;
  kind: string;
  body: string;
};

const money = (n?: number) =>
  n != null
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';

function scoreTone(score: number): string {
  if (score >= 70) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (score >= 45) return 'bg-amber-50 text-amber-800 border-amber-200';
  return 'bg-slate-100 text-slate-700 border-slate-200';
}

function buildTimeline(
  contact: CrmContact,
  enrollments: NurtureEnrollment[],
  showings: ShowingRequest[],
  transactions: StoredTransaction[]
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const n of contact.notes) {
    items.push({
      id: `note_${n.slice(0, 24)}_${items.length}`,
      at: contact.updatedAt,
      kind: 'note',
      body: n,
    });
  }

  for (const e of enrollments.filter((x) => x.contactId === contact.id)) {
    const seq = NURTURE_SEQUENCES.find((s) => s.id === e.sequenceId);
    items.push({
      id: e.id,
      at: e.enrolledAt,
      kind: 'nurture',
      body: `Enrolled in ${seq?.name || e.sequenceId} (${e.status})`,
    });
  }

  for (const s of showings) {
    const blob = `${s.address} ${contact.areas.join(' ')}`.toLowerCase();
    if (!contact.areas.some((a) => blob.includes(a.toLowerCase())) && showings.length > 5) continue;
    items.push({
      id: s.id,
      at: s.requestedAt,
      kind: 'showing',
      body: `Showing ${s.status}: ${s.address}`,
    });
  }

  for (const t of transactions.filter((x) => x.contactId === contact.id)) {
    items.push({
      id: t.id,
      at: t.effectiveDate || contact.updatedAt,
      kind: 'deal',
      body: `Transaction ${t.status}: ${t.address || 'deal file'}`,
    });
  }

  return items
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
    .slice(0, 12);
}

export default function Contact360({
  contact,
  showings,
  enrollments,
  transactions = [],
  alertMatchCount,
  onTouch,
  onOpenDraft,
}: Contact360Props) {
  const ctx = buildContactContext(contact, {
    showings,
    enrollments,
    transactions,
    alertMatchCount,
  });
  const intent = useMemo(() => computeIntent(ctx), [contact, showings, enrollments, transactions, alertMatchCount]);
  const enriched = applyIntentToContact(contact, {
    showings,
    enrollments,
    transactions,
    alertMatchCount,
  });
  const stage = CRM_STAGES.find((s) => s.id === contact.stage);
  const timeline = useMemo(
    () => buildTimeline(contact, enrollments, showings, transactions),
    [contact, enrollments, showings, transactions]
  );
  const contactEnrollments = enrollments.filter((e) => e.contactId === contact.id);
  const contactTx = transactions.filter((t) => t.contactId === contact.id);
  const pendingShowings = showings.filter((s) => s.status === 'pending');
  const touchDays = daysSince(contact.lastTouchedAt || contact.updatedAt);

  return (
    <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{contact.name}</h2>
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${scoreTone(intent.score)}`}
            >
              {intent.score >= 70 ? 'Hot' : intent.score >= 45 ? 'Warm' : 'Cool'} · {intent.score}
            </span>
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stage?.color || ''}`}
            >
              {stage?.label || contact.stage}
            </span>
          </div>
          <p className="text-sm text-slate-600 mt-1">{contact.interest}</p>
          <p className="text-sm text-slate-500 mt-2 border-l-2 border-orange-300 pl-3">
            {intent.reason}
          </p>
          <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
            {contact.phone && <span>{contact.phone}</span>}
            {contact.email && <span>{contact.email}</span>}
            <span>{money(contact.budget)}</span>
            <span>{contact.areas.join(', ') || 'Eastern Idaho'}</span>
            <span>Last touch {touchDays === 999 ? 'never' : `${touchDays}d ago`}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {contact.phone && (
            <a
              href={`tel:${contact.phone.replace(/\D/g, '')}`}
              className="px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-slate-50"
            >
              Call
            </a>
          )}
          {onOpenDraft && (
            <button
              type="button"
              onClick={onOpenDraft}
              className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-black"
            >
              Draft text
            </button>
          )}
          {onTouch && (
            <button
              type="button"
              onClick={onTouch}
              className="px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-slate-50"
            >
              Log touch
            </button>
          )}
        </div>
      </div>

      {intent.signals.length > 0 && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Why now
          </div>
          <ul className="space-y-1.5">
            {intent.signals.slice(0, 5).map((s) => (
              <li
                key={s.code}
                className="text-sm text-slate-600 flex items-start gap-2"
              >
                <span className="text-orange-500 font-bold shrink-0">+{s.weight}</span>
                <span>{s.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <SignalCard
          label="Showings"
          value={String(pendingShowings.length)}
          hint={pendingShowings.length ? pendingShowings[0].address : 'None pending'}
        />
        <SignalCard
          label="Nurture"
          value={String(contactEnrollments.filter((e) => e.status === 'active').length)}
          hint={
            contactEnrollments[0]
              ? NURTURE_SEQUENCES.find((s) => s.id === contactEnrollments[0].sequenceId)?.name ||
                'Enrolled'
              : 'Not enrolled'
          }
        />
        <SignalCard
          label="Deals"
          value={String(contactTx.filter((t) => t.status !== 'closed').length)}
          hint={
            contactTx[0] ? (
              <Link href={`/transactions?id=${contactTx[0].id}`} className="underline">
                {contactTx[0].address || 'Open file'}
              </Link>
            ) : (
              'No linked tx'
            )
          }
        />
      </div>

      {(alertMatchCount ?? 0) > 0 && (
        <div className="text-sm bg-blue-50 border border-blue-100 rounded-xl px-3 py-2 text-blue-900">
          {alertMatchCount} new listing match{alertMatchCount !== 1 ? 'es' : ''} on desk this week —{' '}
          <Link href="/alerts" className="underline font-medium">
            review alerts
          </Link>
        </div>
      )}

      <div>
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
          Timeline
        </div>
        {timeline.length === 0 ? (
          <p className="text-sm text-slate-400">No activity yet — add a note or enroll in nurture.</p>
        ) : (
          <ul className="space-y-2 max-h-48 overflow-y-auto">
            {timeline.map((t) => (
              <li key={t.id} className="text-sm border-l-2 border-slate-200 pl-3">
                <span className="text-[10px] uppercase text-slate-400 font-semibold">{t.kind}</span>
                <div className="text-slate-600">{t.body}</div>
                <div className="text-[11px] text-slate-400">
                  {new Date(t.at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="text-[11px] text-slate-400">
        Intent score {enriched.score} · persisted on save · Archibald-Bagley pipeline
      </div>
    </div>
  );
}

function SignalCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50/80 p-3">
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">{label}</div>
      <div className="text-xl font-semibold text-slate-900 mt-0.5">{value}</div>
      <div className="text-[11px] text-slate-500 mt-1 truncate">{hint}</div>
    </div>
  );
}
