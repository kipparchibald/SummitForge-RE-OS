'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { CrmContact } from '@/lib/crm/store';
import {
  loadContactsAsync,
  loadEnrollmentsAsync,
  loadShowingsAsync,
  saveContactsAsync,
} from '@/lib/crm/supabase-store';
import { contextBundleForAll, contextForContact } from '@/lib/crm/intent-context';
import { applyIntentToContact, isEligibleForToday, rankForToday } from '@/lib/crm/intent';
import {
  dismissContact,
  inboxUrlForContact,
  snoozeContact,
} from '@/lib/crm/today-queue';
import EmptyState from '@/components/ui/EmptyState';
import { toastInfo } from '@/lib/toast/store';

export default function TodayPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [bundle, setBundle] = useState(contextBundleForAll([], []));

  const refresh = useCallback(async () => {
    setLoading(true);
    const [contactRes, showRes, enrollRes] = await Promise.all([
      loadContactsAsync(),
      loadShowingsAsync(),
      loadEnrollmentsAsync(),
    ]);
    const ctx = contextBundleForAll(showRes.showings, enrollRes.enrollments);
    setBundle(ctx);
    setContacts(contactRes.contacts);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const ctxByContact = useMemo(() => {
    const map = new Map<string, ReturnType<typeof contextForContact>>();
    for (const c of contacts) {
      map.set(c.id, contextForContact(c.id, bundle));
    }
    return map;
  }, [contacts, bundle]);

  const queue = useMemo(
    () => rankForToday(contacts, ctxByContact, 5),
    [contacts, ctxByContact]
  );

  const eligibleCount = useMemo(
    () =>
      contacts.filter((c) =>
        isEligibleForToday(applyIntentToContact(c, ctxByContact.get(c.id) || {}))
      ).length,
    [contacts, ctxByContact]
  );

  const persistOne = async (updated: CrmContact) => {
    const list = contacts.map((c) => (c.id === updated.id ? updated : c));
    setContacts(list);
    await saveContactsAsync(list);
  };

  const handleSnooze = async (c: CrmContact) => {
    setBusyId(c.id);
    try {
      const next = snoozeContact(c);
      await persistOne(next);
      toastInfo(`${c.name} snoozed until tomorrow 8am (Boise)`);
    } finally {
      setBusyId(null);
    }
  };

  const handleDismiss = async (c: CrmContact) => {
    setBusyId(c.id);
    try {
      const next = dismissContact(c);
      await persistOne(next);
      toastInfo(`${c.name} dismissed until you log a touch`);
    } finally {
      setBusyId(null);
    }
  };

  const handleAct = (c: CrmContact) => {
    router.push(inboxUrlForContact(c.id));
  };

  return (
    <div className="p-6 sm:p-10 max-w-3xl mx-auto">
      <div className="page-header pb-6 mb-6 border-b border-neutral-900">
        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
          Don&apos;t miss
        </div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight font-serif text-neutral-900">
          Today
        </h1>
        <p className="text-neutral-500 mt-2 text-sm max-w-xl leading-relaxed">
          Top contacts who need a touch — ranked by intent. SMS-first drafts on Act.
          Archibald-Bagley · Jefferson County.
        </p>
        <div className="flex flex-wrap gap-2 mt-4 text-[11px]">
          <Link
            href="/crm"
            className="px-3 py-1.5 uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            CRM
          </Link>
          <Link
            href="/inbox"
            className="px-3 py-1.5 uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            Inbox
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-slate-400 py-12 text-center">Loading pipeline…</div>
      ) : queue.length === 0 ? (
        <EmptyState
          variant="light"
          title="Nothing needs a touch right now"
          description={
            eligibleCount === 0
              ? 'Your pipeline is caught up — or contacts are snoozed/dismissed. Check CRM for the full list.'
              : 'No high-intent contacts in the top 5. Your desk may still have lower-priority leads in CRM.'
          }
          actionLabel="Open CRM"
          actionHref="/crm"
          className="py-16"
        />
      ) : (
        <ul className="space-y-4">
          {queue.map((c, i) => {
            const enriched = applyIntentToContact(c, ctxByContact.get(c.id) || {});
            const hot = (enriched.score ?? 0) >= 70;
            return (
              <li
                key={c.id}
                className="bg-white border rounded-2xl p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-slate-400">#{i + 1}</span>
                      <h2 className="font-semibold text-lg text-slate-900">{c.name}</h2>
                      {hot && (
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-200">
                          Hot · {enriched.score}
                        </span>
                      )}
                      {!hot && enriched.score != null && (
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          Score {enriched.score}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-600 mt-2 border-l-2 border-orange-300 pl-3">
                      {enriched.intentReason || enriched.interest}
                    </p>
                    <div className="text-xs text-slate-400 mt-2">
                      {c.areas.join(', ') || 'Eastern Idaho'}
                      {c.phone ? ` · ${c.phone}` : ''}
                    </div>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => handleAct(c)}
                    disabled={busyId === c.id}
                    className="px-4 py-2 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
                  >
                    Act
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSnooze(c)}
                    disabled={busyId === c.id}
                    className="px-4 py-2 text-xs font-semibold border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    Snooze
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDismiss(c)}
                    disabled={busyId === c.id}
                    className="px-4 py-2 text-xs font-semibold border border-slate-200 text-slate-500 rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    Dismiss
                  </button>
                  <Link
                    href={`/crm`}
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        sessionStorage.setItem('sf_crm_select', c.id);
                      }
                    }}
                    className="px-4 py-2 text-xs font-semibold text-slate-500 hover:text-slate-900"
                  >
                    Contact 360 →
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!loading && queue.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-6 text-center">
          Snooze hides until tomorrow 8:00 AM America/Boise · Dismiss until you log a touch in CRM
        </p>
      )}
    </div>
  );
}
