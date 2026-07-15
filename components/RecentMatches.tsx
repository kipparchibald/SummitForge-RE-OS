'use client';

import React, { useEffect, useState } from 'react';
import { getMatches, markMatchNotified } from '@/lib/alerts/supabase-store';
import type { AlertMatch } from '@/types/alerts';

export default function RecentMatches({ limit = 10 }: { limit?: number }) {
  const [matches, setMatches] = useState<AlertMatch[]>([]);
  const [loading, setLoading] = useState(true);

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
    setMatches(prev => prev.map(m => (m.id === id ? { ...m, notified: true } : m)));
  };

  if (loading) {
    return (
      <div className="text-center py-10 text-gray-400 bg-white border border-gray-100 rounded-3xl">
        Loading matches…
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white border border-dashed border-gray-200 rounded-3xl">
        <div className="text-3xl mb-2">🔔</div>
        <div className="font-medium">No matches yet</div>
        <div className="text-sm mt-1">
          Import a Navica CSV or create alerts. Matches appear here automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map(m => {
        const snap = m.listingSnapshot;
        const address = snap?.address || `Listing ${m.listingId}`;
        const price = snap?.price;
        const acres = snap?.acres;
        const alertName = m.alertName || `Alert ${m.alertId.slice(-6)}`;
        const channel = m.notificationMethod || 'in-app';

        return (
          <div
            key={m.id}
            className={`bg-white border rounded-2xl p-4 flex justify-between items-center shadow-sm ${
              m.notified ? 'border-gray-200 opacity-80' : 'border-emerald-200 ring-1 ring-emerald-50'
            }`}
          >
            <div className="min-w-0">
              <div className="font-medium text-gray-900 truncate">{address}</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Matched to <span className="font-medium text-gray-700">{alertName}</span>
                {price != null && price > 0 && (
                  <span className="ml-2 text-gray-800">
                    ${price.toLocaleString()}
                    {acres != null ? ` · ${acres} ac` : ''}
                  </span>
                )}
              </div>
              <div className="text-xs text-gray-400 mt-1 flex items-center gap-2">
                <span className="font-medium text-emerald-700">{m.matchScore}% match</span>
                <span>·</span>
                <span>{new Date(m.matchedAt).toLocaleString()}</span>
                {snap?.isNewConstruction && (
                  <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] uppercase">
                    New Construction
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-3">
              <span
                className={`text-xs px-2.5 py-1 rounded-full uppercase tracking-wide ${
                  channel === 'sms'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-blue-100 text-blue-700'
                }`}
              >
                {channel}
              </span>
              {!m.notified && (
                <button
                  onClick={() => handleMarkRead(m.id)}
                  className="text-sm px-3 py-1.5 border rounded-xl hover:bg-gray-50"
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
