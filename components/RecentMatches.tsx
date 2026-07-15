'use client';

import React, { useEffect, useState } from 'react';
import { getStoredMatches } from '@/lib/alerts/store';
import type { AlertMatch } from '@/types/alerts';

interface DisplayMatch {
  id: string;
  alertName: string;
  address: string;
  price: number;
  acres?: number;
  score: number;
  matchedAt: string;
  channel: 'sms' | 'in-app' | 'email';
}

export default function RecentMatches({ limit = 10 }: { limit?: number }) {
  const [matches, setMatches] = useState<DisplayMatch[]>([]);

  useEffect(() => {
    // For now we only have match records. In a full system we would join with alerts + listings.
    // We create a lightweight display version.
    const raw: AlertMatch[] = getStoredMatches();

    const display: DisplayMatch[] = raw.slice(0, limit).map(m => ({
      id: m.id,
      alertName: `Alert ${m.alertId.slice(-6)}`,
      address: `Listing ${m.listingId}`,
      price: 0,
      score: m.matchScore,
      matchedAt: m.matchedAt,
      channel: m.notificationMethod || 'in-app',
    }));

    // If no real matches yet, show a helpful empty state (no more hard-coded mock data)
    setMatches(display);
  }, [limit]);

  if (matches.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-white border border-dashed border-gray-200 rounded-3xl">
        <div className="text-3xl mb-2">🔔</div>
        <div className="font-medium">No matches yet</div>
        <div className="text-sm mt-1">
          Import a Navica CSV or create more alerts. Matches will appear here automatically.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {matches.map(m => (
        <div
          key={m.id}
          className="bg-white border border-gray-200 rounded-2xl p-4 flex justify-between items-center shadow-sm"
        >
          <div>
            <div className="font-medium">{m.address}</div>
            <div className="text-sm text-gray-500">
              Matched to <span className="font-medium text-gray-700">{m.alertName}</span>
            </div>
            <div className="text-xs text-gray-400 mt-1">
              Score {m.score}% • {new Date(m.matchedAt).toLocaleString()}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`text-xs px-2.5 py-1 rounded-full uppercase tracking-wide ${
                m.channel === 'sms'
                  ? 'bg-emerald-100 text-emerald-700'
                  : 'bg-blue-100 text-blue-700'
              }`}
            >
              {m.channel}
            </span>
            <button className="text-sm px-3 py-1.5 border rounded-xl hover:bg-gray-50">
              View
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
