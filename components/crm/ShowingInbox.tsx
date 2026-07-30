'use client';

import React, { useCallback, useEffect, useState } from 'react';
import type { ShowingRequest } from '@/lib/portal/matches';
import {
  loadShowingsAsync,
  updateShowingStatusAsync,
} from '@/lib/crm/supabase-store';
import { useRealtime } from '@/lib/realtime/hooks';
import StatusBadge from '@/components/ui/StatusBadge';
import EmptyState from '@/components/ui/EmptyState';
import { toastSuccess, toastInfo } from '@/lib/toast/store';

/** Agent inbox — live updates when portal schedules a showing. */
export default function ShowingInbox() {
  const [items, setItems] = useState<ShowingRequest[]>([]);
  const [mode, setMode] = useState<'cloud' | 'local'>('local');

  const refresh = useCallback(async () => {
    const { showings, mode: m } = await loadShowingsAsync();
    setItems(showings);
    setMode(m);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useRealtime('showings', () => {
    void refresh();
  });

  const pending = items.filter((s) => s.status === 'pending');

  const confirm = async (id: string, address: string) => {
    setItems(await updateShowingStatusAsync(id, 'confirmed'));
    toastSuccess(`Showing confirmed · ${address}`);
  };

  const decline = async (id: string, address: string) => {
    setItems(await updateShowingStatusAsync(id, 'declined'));
    toastInfo(`Showing declined · ${address}`);
  };

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold text-zinc-900">Showing requests</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            From client portal · {mode === 'cloud' ? 'cloud synced' : 'this device'}
          </p>
        </div>
        {pending.length > 0 && (
          <StatusBadge label={`${pending.length} pending`} tone="warning" pulse />
        )}
      </div>

      {items.length === 0 ? (
        <EmptyState
          variant="light"
          title="No showing requests yet"
          description="When a buyer schedules from the client portal, it appears here instantly."
          actionLabel="Open client portal"
          actionHref="/portal"
          className="py-8"
        />
      ) : (
        <ul className="space-y-2 max-h-64 overflow-y-auto">
          {items.slice(0, 12).map((s) => (
            <li
              key={s.id}
              className="rounded-xl border border-zinc-100 bg-zinc-50/80 px-3 py-2.5 text-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
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
                      onClick={() => void confirm(s.id, s.address)}
                      className="px-2.5 py-1.5 text-[11px] rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => void decline(s.id, s.address)}
                      className="px-2.5 py-1.5 text-[11px] rounded-lg border border-zinc-200 text-zinc-600 hover:bg-white"
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
