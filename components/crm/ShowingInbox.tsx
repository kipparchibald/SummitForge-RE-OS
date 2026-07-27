'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadShowingRequests, type ShowingRequest } from '@/lib/portal/matches';

const SHOWING_KEY = 'sf_portal_showings';

function saveShowings(list: ShowingRequest[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(SHOWING_KEY, JSON.stringify(list));
}

function updateStatus(id: string, status: ShowingRequest['status']): ShowingRequest[] {
  const all = loadShowingRequests().map((s) => (s.id === id ? { ...s, status } : s));
  saveShowings(all);
  return all;
}

/** Agent inbox for client-portal Schedule showing requests. */
export default function ShowingInbox() {
  const [items, setItems] = useState<ShowingRequest[]>([]);

  useEffect(() => {
    setItems(loadShowingRequests());
  }, []);

  const pending = items.filter((s) => s.status === 'pending');

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-zinc-900">Showing requests</h3>
          <p className="text-xs text-zinc-500 mt-0.5">From client portal · Schedule showing</p>
        </div>
        {pending.length > 0 && (
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-100">
            {pending.length} pending
          </span>
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
