'use client';

import React from 'react';
import StatusDot, { type StatusTone } from './StatusDot';

export type { StatusTone };

const BADGE: Record<
  StatusTone,
  { wrap: string; text: string }
> = {
  success: {
    wrap: 'bg-emerald-950/60 text-emerald-300 border-emerald-800/80',
    text: 'text-emerald-300',
  },
  warning: {
    wrap: 'bg-amber-950/50 text-amber-300 border-amber-800/70',
    text: 'text-amber-300',
  },
  danger: {
    wrap: 'bg-rose-950/50 text-rose-300 border-rose-800/70',
    text: 'text-rose-300',
  },
  info: {
    wrap: 'bg-sky-950/50 text-sky-300 border-sky-800/70',
    text: 'text-sky-300',
  },
  neutral: {
    wrap: 'bg-zinc-900 text-zinc-300 border-zinc-700',
    text: 'text-zinc-300',
  },
  offline: {
    wrap: 'bg-zinc-900/80 text-zinc-500 border-zinc-800',
    text: 'text-zinc-500',
  },
};

/** Pill badge with optional live dot — for health, stages, pipeline. */
export default function StatusBadge({
  label,
  tone = 'neutral',
  showDot = true,
  pulse,
  size = 'sm',
  className = '',
}: {
  label: string;
  tone?: StatusTone;
  showDot?: boolean;
  pulse?: boolean;
  size?: 'sm' | 'md';
  className?: string;
}) {
  const b = BADGE[tone];
  const pad = size === 'md' ? 'px-3 py-1.5 text-xs' : 'px-2.5 py-1 text-[11px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-medium ${pad} ${b.wrap} ${className}`}
    >
      {showDot && <StatusDot tone={tone} size="xs" pulse={pulse} />}
      {label}
    </span>
  );
}

/** Map common operational states → tone */
export function toneFromBool(
  ok: boolean | undefined | null,
  opts?: { warnWhenFalse?: boolean }
): StatusTone {
  if (ok === true) return 'success';
  if (ok === false) return opts?.warnWhenFalse ? 'warning' : 'offline';
  return 'neutral';
}

export function transactionStageTone(
  status: string
): StatusTone {
  switch (status) {
    case 'closed':
      return 'success';
    case 'closing':
    case 'title':
      return 'info';
    case 'under_contract':
    case 'inspection':
    case 'appraisal':
    case 'lending':
      return 'warning';
    case 'new':
    default:
      return 'neutral';
  }
}

export function crmStageTone(stage: string): StatusTone {
  switch (stage) {
    case 'closed':
      return 'success';
    case 'under_contract':
    case 'active':
      return 'info';
    case 'qualified':
    case 'nurture':
      return 'warning';
    case 'lost':
      return 'danger';
    case 'lead':
    default:
      return 'neutral';
  }
}
