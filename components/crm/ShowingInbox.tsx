'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { loadShowingRequests, type ShowingRequest } from '@/lib/portal/matches';
import { useRealtime } from '@/lib/realtime/hooks';
import { emitLocal } from '@/lib/realtime/client';
import StatusBadge from '@/components/ui/StatusBadge';

const SHOWING_KEY = 'sf_portal_showings';

function saveShowings(list: ShowingRequest[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHOWING_KEY, JSON.stringify(list));
}

function updateStatus(id: string, status: ShowingRequest['status']): ShowingRequest[] {
  const all = loadShowingRequests().map((s) => (s.id === id ? { ...s, status } : s));
  saveShowings(all);
  emitLocal('showings', 'UPDATE', { id, status });
  return all;
}

/** Agent inbox — live updates when portal schedules a showing. */
export default function ShowingInbox() {
  const [items, setItems] = useState<ShowingRequest[]>([]);

  const refresh = useCallback(() => {
    setItems(loadShowingRequests());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtime('showings', () => {
    refresh();
  });

  const pending = items.filter((s) => s.status === 'pending');

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900">Showing requests</h3>
          <p className="text-xs text-zinc-500 mt-0.5">From client portal · live updates</p>
        </div>
        {pending.length > 0 && (
          <StatusBadge label={`${pending.length} pending`} tone="warning" pulse />
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-zinc-400 py-4 text-center border border-dashed rounded-xl">
          No portal showings yet — clients request from{' '}
          <Link href="/portal" className="text-emerald-700 underline">
            /portal
          </Link>
        </p>
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {items.slice(0, 12).map((s) => (
            <li key={s.id} className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-zinc-900 truncate">{s.address}</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    {new Date(s.requestedAt).toLocaleString()} · {s.status}
                    {s.preferredTimes ? ` · ${s.preferredTimes}` : ''}
                  </div>
                </div>
                {s.status === 'pending' && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setItems(updateStatus(s.id, 'confirmed'))}
                      className="px-2 py-1 text-[11px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => setItems(updateStatus(s.id, 'declined'))}
                      className="px-2 py-1 text-[11px] rounded-lg border border-zinc-200 text-zinc-600 hover:bg-white"
                    >
                      Decline
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
