'use client';

import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { CrmContact } from '@/lib/crm/store';
import { loadContactsAsync, saveContactsAsync } from '@/lib/crm/supabase-store';
import {
  buildEmailDraft,
  buildSmsDraft,
  createOutreachDraft,
  getDraft,
  loadDraftsAsync,
  markDraftApproved,
  type OutreachChannel,
  type OutreachDraft,
  updateDraftBody,
} from '@/lib/crm/inbox';
import { recordTouch } from '@/lib/crm/intent';
import { toastSuccess, toastInfo } from '@/lib/toast/store';

function InboxContent() {
  const router = useRouter();
  const params = useSearchParams();
  const contactId = params.get('contact');
  const draftId = params.get('draft');
  const fromToday = params.get('from') === 'today';

  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [drafts, setDrafts] = useState<OutreachDraft[]>([]);
  const [active, setActive] = useState<OutreachDraft | null>(null);
  const [channel, setChannel] = useState<OutreachChannel>('sms');
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [approving, setApproving] = useState(false);
  const [approveNote, setApproveNote] = useState<string | null>(null);

  const contact = useMemo(
    () => contacts.find((c) => c.id === (active?.contactId || contactId || '')),
    [contacts, active, contactId]
  );

  const refresh = useCallback(async () => {
    setLoading(true);
    const [{ contacts: list }, draftList] = await Promise.all([
      loadContactsAsync(),
      loadDraftsAsync(),
    ]);
    setContacts(list);
    setDrafts(draftList);

    let selected: OutreachDraft | null = null;
    if (draftId) {
      selected = getDraft(draftId) || draftList.find((d) => d.id === draftId) || null;
    }
    if (!selected && contactId) {
      const c = list.find((x) => x.id === contactId);
      if (c) {
        const existing = draftList.find(
          (d) => d.contactId === c.id && d.status === 'draft'
        );
        selected =
          existing ||
          createOutreachDraft(c, {
            source: fromToday ? 'today' : 'inbox',
            intentReason: c.intentReason,
          });
      }
    }
    if (!selected && draftList.length > 0) {
      selected = draftList.find((d) => d.status === 'draft') || draftList[0];
    }

    if (selected) {
      setActive(selected);
      setChannel(selected.channel);
      setBody(selected.body);
      setSubject(selected.subject || '');
    }
    setLoading(false);
  }, [contactId, draftId, fromToday]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const switchChannel = (ch: OutreachChannel) => {
    if (!contact) return;
    setChannel(ch);
    if (ch === 'sms') {
      setBody(buildSmsDraft(contact, active?.intentReason));
      setSubject('');
    } else {
      const email = buildEmailDraft(contact, active?.intentReason);
      setBody(email.body);
      setSubject(email.subject);
    }
  };

  const saveDraft = () => {
    if (!active) return;
    const updated = updateDraftBody(active, {
      channel,
      body,
      subject: channel === 'email' ? subject : undefined,
    });
    setActive(updated);
    setDrafts((prev) => {
      const next = prev.filter((d) => d.id !== updated.id);
      return [updated, ...next];
    });
    toastInfo('Draft saved');
  };

  const approve = async () => {
    if (!active || !contact) return;
    setApproving(true);
    setApproveNote(null);
    try {
      saveDraft();
      const res = await fetch('/api/inbox/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          draftId: active.id,
          contactId: contact.id,
          channel,
          body,
          subject: channel === 'email' ? subject : undefined,
          to: contact.phone,
          explicitApprove: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toastInfo(data.error || 'Approve failed');
        return;
      }

      const approved = markDraftApproved({
        ...active,
        channel,
        body,
        subject: channel === 'email' ? subject : undefined,
        contactName: contact.name,
      });
      setActive(approved);
      setApproveNote(data.message || 'Approval recorded');

      if (data.transmitted) {
        toastSuccess('SMS sent via Twilio');
      } else {
        toastSuccess('Approved — no message transmitted (default)');
      }

      const touched = recordTouch(contact, `Approved ${channel} draft (not auto-sent unless enabled)`);
      const list = contacts.map((c) => (c.id === touched.id ? touched : c));
      setContacts(list);
      await saveContactsAsync(list);
    } finally {
      setApproving(false);
    }
  };

  const pendingDrafts = drafts.filter((d) => d.status === 'draft');

  return (
    <div className="p-6 sm:p-10 max-w-4xl mx-auto">
      <div className="page-header pb-6 mb-6 border-b border-neutral-900">
        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
          Outreach
        </div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight font-serif text-neutral-900">
          Inbox
        </h1>
        <p className="text-neutral-500 mt-2 text-sm max-w-xl leading-relaxed">
          Drafted SMS (primary) and email (secondary). Approve records your intent — nothing
          transmits unless <code className="text-xs bg-slate-100 px-1 rounded">OUTBOUND_APPROVE_SEND=true</code> and
          Twilio is configured.
        </p>
        <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
          <Link href="/today" className="px-3 py-1.5 uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900">
            Today
          </Link>
          <Link href="/crm" className="px-3 py-1.5 uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900">
            CRM
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <aside className="space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
            Drafts ({pendingDrafts.length})
          </div>
          {loading ? (
            <p className="text-sm text-slate-400">Loading…</p>
          ) : pendingDrafts.length === 0 ? (
            <p className="text-sm text-slate-400">No pending drafts. Act from Today or CRM.</p>
          ) : (
            <ul className="space-y-1.5 max-h-80 overflow-y-auto">
              {pendingDrafts.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => {
                    setActive(d);
                    setChannel(d.channel);
                    setBody(d.body);
                    setSubject(d.subject || '');
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl border text-sm ${
                    active?.id === d.id
                      ? 'border-slate-900 bg-slate-50'
                      : 'border-slate-100 hover:border-slate-300'
                  }`}
                >
                  <div className="font-medium truncate">{d.contactName || d.contactId}</div>
                  <div className="text-[11px] text-slate-400">{d.channel} · {d.source}</div>
                </button>
              ))}
            </ul>
          )}
        </aside>

        <div className="lg:col-span-2 space-y-4">
          {!contact && !loading ? (
            <div className="bg-white border rounded-2xl p-10 text-center text-slate-400 text-sm">
              Select a draft or open from{' '}
              <Link href="/today" className="underline text-slate-600">
                Today
              </Link>
            </div>
          ) : contact ? (
            <>
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-900">
                <strong>Approve-only.</strong> Nurture auto-send and blast SMS stay OFF. You must
                click Approve; outbound remains disabled by default.
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                <div>
                  <h2 className="font-semibold text-lg">{contact.name}</h2>
                  <p className="text-sm text-slate-500">{active?.intentReason || contact.interest}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {contact.phone || 'No phone'} · {contact.email || 'No email'}
                  </p>
                </div>

                <div className="flex gap-2">
                  <ChannelTab active={channel === 'sms'} onClick={() => switchChannel('sms')} label="SMS" primary />
                  <ChannelTab active={channel === 'email'} onClick={() => switchChannel('email')} label="Email" />
                </div>

                {channel === 'email' && (
                  <input
                    className="w-full border rounded-xl px-3 py-2 text-sm"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="Subject"
                  />
                )}

                <textarea
                  className="w-full border rounded-xl px-3 py-2 text-sm min-h-[140px] font-mono"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  maxLength={channel === 'sms' ? 480 : 8000}
                />
                {channel === 'sms' && (
                  <div className="text-[11px] text-slate-400">{body.length} chars · keep it short</div>
                )}

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={saveDraft}
                    className="px-4 py-2 text-xs font-semibold border rounded-lg hover:bg-slate-50"
                  >
                    Save draft
                  </button>
                  <button
                    type="button"
                    onClick={() => void approve()}
                    disabled={approving || !body.trim()}
                    className="px-4 py-2 text-xs font-semibold bg-emerald-700 text-white rounded-lg hover:bg-emerald-800 disabled:opacity-50"
                  >
                    {approving ? 'Approving…' : 'Approve'}
                  </button>
                  <button
                    type="button"
                    onClick={() => router.push(`/crm`)}
                    className="px-4 py-2 text-xs font-semibold text-slate-500"
                  >
                    Contact 360
                  </button>
                </div>

                {approveNote && (
                  <div className="text-sm bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2 text-emerald-900">
                    {approveNote}
                  </div>
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ChannelTab({
  active,
  onClick,
  label,
  primary,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  primary?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-xs font-semibold rounded-lg border ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : primary
            ? 'border-orange-200 text-orange-800 hover:bg-orange-50'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
      {primary && !active ? ' (primary)' : ''}
    </button>
  );
}

export default function InboxPage() {
  return (
    <Suspense fallback={<div className="p-10 text-slate-400 text-sm">Loading inbox…</div>}>
      <InboxContent />
    </Suspense>
  );
}
