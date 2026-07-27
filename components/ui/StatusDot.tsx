'use client';

import React from 'react';

export type StatusTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'offline';

const TONE: Record<
  StatusTone,
  { dot: string; pulse?: boolean; ring?: string }
> = {
  success: { dot: 'bg-emerald-400', pulse: true, ring: 'ring-emerald-400/30' },
  warning: { dot: 'bg-amber-400', pulse: true, ring: 'ring-amber-400/30' },
  danger: { dot: 'bg-rose-500', pulse: true, ring: 'ring-rose-500/30' },
  info: { dot: 'bg-sky-400', pulse: false, ring: 'ring-sky-400/30' },
  neutral: { dot: 'bg-zinc-400', pulse: false },
  offline: { dot: 'bg-zinc-600', pulse: false },
};

/** Live indicator dot — success pulses for "online" feel. */
export default function StatusDot({
  tone = 'neutral',
  size = 'sm',
  pulse,
  className = '',
  title,
}: {
  tone?: StatusTone;
  size?: 'xs' | 'sm' | 'md';
  pulse?: boolean;
  className?: string;
  title?: string;
}) {
  const t = TONE[tone];
  const dim = size === 'xs' ? 'w-1.5 h-1.5' : size === 'md' ? 'w-2.5 h-2.5' : 'w-2 h-2';
  const shouldPulse = pulse ?? t.pulse;

  return (
    <span
      title={title}
      className={`relative inline-flex shrink-0 ${dim} ${className}`}
      aria-hidden
    >
      {shouldPulse && (
        <span
          className={`absolute inset-0 rounded-full ${t.dot} opacity-40 animate-ping`}
        />
      )}
      <span className={`relative inline-flex rounded-full ${dim} ${t.dot}`} />
    </span>
  );
}
