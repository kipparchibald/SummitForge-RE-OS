'use client';

import React from 'react';
import StatusDot, { type StatusTone } from './StatusDot';

export type LegacyStatus = 'ready' | 'optional' | 'todo';

const LEGACY_TO_TONE: Record<LegacyStatus, StatusTone> = {
  ready: 'success',
  optional: 'warning',
  todo: 'danger',
};

const LEGACY_LABEL: Record<LegacyStatus, string> = {
  ready: 'Ready',
  optional: 'Optional',
  todo: 'Action needed',
};

/** Drop-in system status row with visual dot indicator. */
export default function StatusRow({
  label,
  status,
  detail,
  tone,
}: {
  label: string;
  status?: LegacyStatus;
  detail?: string;
  tone?: StatusTone;
}) {
  const resolvedTone: StatusTone =
    tone || (status ? LEGACY_TO_TONE[status] : 'neutral');
  const right = detail || (status ? LEGACY_LABEL[status] : '');

  return (
    <div className="flex justify-between items-center gap-3">
      <span className="text-zinc-400 flex items-center gap-2 min-w-0">
        <StatusDot tone={resolvedTone} size="xs" />
        <span className="truncate">{label}</span>
      </span>
      <span
        className={`text-xs font-medium shrink-0 ${
          resolvedTone === 'success'
            ? 'text-emerald-400'
            : resolvedTone === 'warning'
              ? 'text-amber-400'
              : resolvedTone === 'danger'
                ? 'text-rose-400'
                : resolvedTone === 'info'
                  ? 'text-sky-400'
                  : 'text-zinc-500'
        }`}
      >
        {right}
      </span>
    </div>
  );
}
