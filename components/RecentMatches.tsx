'use client';

import React, { useEffect, useState } from 'react';
import { getMatches, markMatchNotified } from '@/lib/alerts/supabase-store';
import type { AlertMatch } from '@/types/alerts';
import OfferCTA from '@/components/offer/OfferCTA';
import EmptyState from '@/components/ui/EmptyState';

type Variant = 'light' | 'dark';

export default function RecentMatches({
  limit = 10,
  variant = 'light',
}: {
  limit?: number;
  variant?: Variant;
}) {
  const [matches, setMatches] = useState<AlertMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const dark = variant === 'dark';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const raw = await getMatches(limit);
      if (!cancelled) {
        setMatches(raw);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [limit]);

  const handleMarkRead = async (id: string) => {
    await markMatchNotified(id);
    setMatches((prev) => prev.map((m) => (m.id === id ? { ...m, notified: true } : m)));
  };

  if (loading) {
    return (
      <div
        className={`text-center py-10 ${
          dark
            ? 'text-zinc-500 bg-zinc-900/40'
            : 'text-gray-400 bg-white border border-gray-100 rounded-3xl'
        }`}
      >
        Loading matches…
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <EmptyState
        variant={dark ? 'dark' : 'light'}
        title="No matches yet"
        description="Import a Navica CSV or create alerts. Matches appear here automatically."
        actionLabel="Open Offer Engine"
        actionHref="/offer"
      />
    );
  }

  return (
    <div className={dark ? 'divide-y divide-zinc-800' : 'space-y-3'}>
      {matches.map((m) => {
        const snap = m.listingSnapshot;
        const address = snap?.address || `Listing ${m.listingId}`;
        const price = snap?.price;
        const acres = snap?.acres;
        const alertName = m.alertName || `Alert ${m.alertId.slice(-6)}`;
        const channel = m.notificationMethod || 'in-app';
        const isLand = (acres != null && acres >= 1) || /lot|land|acre/i.test(address);

        return (
          <div
            key={m.id}
            className={
              dark
                ? `px-4 py-3.5 flex justify-between items-center gap-3 ${
                    m.notified ? 'opacity-70' : 'bg-emerald-950/20'
                  }`
                : `bg-white border rounded-2xl p-4 flex justify-between items-center shadow-sm ${
                    m.notified
                      ? 'border-gray-200 opacity-80'
                      : 'border-emerald-200 ring-1 ring-emerald-50'
                  }`
            }
          >
            <div className="min-w-0">
              <div className={`font-medium truncate ${dark ? 'text-zinc-100' : 'text-gray-900'}`}>
                {address}
              </div>
              <div className={`text-sm mt-0.5 ${dark ? 'text-zinc-500' : 'text-gray-500'}`}>
                Matched to{' '}
                <span className={`font-medium ${dark ? 'text-zinc-300' : 'text-gray-700'}`}>
                  {alertName}
                </span>
                {price != null && price > 0 && (
                  <span className={`ml-2 ${dark ? 'text-zinc-300' : 'text-gray-800'}`}>
                    ${price.toLocaleString()}
                    {acres != null ? ` · ${acres} ac` : ''}
                  </span>
                )}
              </div>
              <div
                className={`text-xs mt-1 flex flex-wrap items-center gap-2 ${
                  dark ? 'text-zinc-600' : 'text-gray-400'
                }`}
              >
                <span className={`font-medium ${dark ? 'text-emerald-400' : 'text-emerald-700'}`}>
                  {m.matchScore}% match
                </span>
                <span>·</span>
                <span>{new Date(m.matchedAt).toLocaleString()}</span>
                {snap?.isNewConstruction && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] uppercase ${
                      dark
                        ? 'bg-blue-950 text-blue-300 border border-blue-900'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    New Construction
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <OfferCTA
                address={address}
                price={price}
                acres={acres}
                isLand={isLand}
                variant="chip"
              />
              <span
                className={`text-xs px-2.5 py-1 rounded-full uppercase tracking-wide hidden sm:inline ${
                  channel === 'sms'
                    ? dark
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-900'
                      : 'bg-emerald-100 text-emerald-700'
                    : dark
                      ? 'bg-blue-950 text-blue-300 border border-blue-900'
                      : 'bg-blue-100 text-blue-700'
                }`}
              >
                {channel}
              </span>
              {!m.notified && (
                <button
                  onClick={() => handleMarkRead(m.id)}
                  className={
                    dark
                      ? 'text-sm px-3 py-1.5 border border-zinc-700 rounded-xl hover:bg-zinc-800 text-zinc-300'
                      : 'text-sm px-3 py-1.5 border rounded-xl hover:bg-gray-50'
                  }
                >
                  Mark read
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
