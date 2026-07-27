'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import StatusBadge, { toneFromBool } from '@/components/ui/StatusBadge';

type HealthPayload = {
  ok?: boolean;
  mode?: string;
  navica?: { configured?: boolean; note?: string };
  twilio?: { configured?: boolean; note?: string };
  supabase?: { configured?: boolean; schemaOk?: boolean; hasVisibilityColumn?: boolean };
  ai?: { live?: boolean; provider?: string; note?: string };
  cron?: { secretConfigured?: boolean };
};

/** Compact live health strip — Navica, Twilio, Supabase, AI, mode. */
export default function SystemHealthStrip({
  className = '',
  showLink = true,
}: {
  className?: string;
  showLink?: boolean;
}) {
  const [health, setHealth] = useState<HealthPayload | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setHealth(d);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <StatusBadge label="Health unreachable" tone="danger" />
      </div>
    );
  }

  if (!health) {
    return (
      <div className={`flex flex-wrap items-center gap-2 ${className}`}>
        <StatusBadge label="Checking systems…" tone="neutral" pulse showDot />
      </div>
    );
  }

  const modeLabel = health.mode === 'production' ? 'Live mode' : 'Demo mode';
  const modeTone = health.mode === 'production' ? 'success' : 'info';

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      <StatusBadge
        label={health.navica?.configured ? 'Navica Live' : 'Navica Demo'}
        tone={toneFromBool(health.navica?.configured, { warnWhenFalse: true })}
        pulse={!!health.navica?.configured}
      />
      <StatusBadge
        label={health.twilio?.configured ? 'SMS Live' : 'SMS Simulated'}
        tone={toneFromBool(health.twilio?.configured, { warnWhenFalse: true })}
      />
      <StatusBadge
        label={
          health.supabase?.schemaOk
            ? 'Schema OK'
            : health.supabase?.configured
              ? 'Schema issue'
              : 'Local store'
        }
        tone={
          health.supabase?.schemaOk
            ? 'success'
            : health.supabase?.configured
              ? 'danger'
              : 'neutral'
        }
      />
      <StatusBadge
        label={health.ai?.live ? `AI · ${health.ai.provider || 'live'}` : 'AI Demo'}
        tone={toneFromBool(health.ai?.live, { warnWhenFalse: true })}
      />
      <StatusBadge label={modeLabel} tone={modeTone as 'success' | 'info'} showDot={false} />
      {showLink && (
        <Link
          href="/api/health"
          className="text-[11px] text-zinc-500 hover:text-emerald-400 transition ml-1"
        >
          details →
        </Link>
      )}
    </div>
  );
}
