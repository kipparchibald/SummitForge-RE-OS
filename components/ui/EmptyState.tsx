'use client';

import React from 'react';
import Link from 'next/link';

export type EmptyStateProps = {
  title: string;
  description?: string;
  /** Primary CTA label */
  actionLabel?: string;
  /** Internal path or external URL */
  actionHref?: string;
  onAction?: () => void;
  /** Optional secondary link */
  secondaryLabel?: string;
  secondaryHref?: string;
  /** 'dark' for agent chrome, 'light' for client surfaces */
  variant?: 'dark' | 'light';
  className?: string;
  icon?: React.ReactNode;
};

/** One-message empty state with a single clear next step. */
export default function EmptyState({
  title,
  description,
  actionLabel,
  actionHref,
  onAction,
  secondaryLabel,
  secondaryHref,
  variant = 'dark',
  className = '',
  icon,
}: EmptyStateProps) {
  const isDark = variant === 'dark';
  const border = isDark
    ? 'border-zinc-700 bg-zinc-900/40'
    : 'border-zinc-200 bg-zinc-50';
  const titleCls = isDark ? 'text-zinc-200' : 'text-zinc-800';
  const descCls = isDark ? 'text-zinc-500' : 'text-zinc-500';
  const btnPrimary =
    'inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition';
  const btnSecondary = isDark
    ? 'text-sm text-zinc-400 hover:text-emerald-400 underline-offset-2 hover:underline'
    : 'text-sm text-zinc-600 hover:text-emerald-700 underline-offset-2 hover:underline';

  const action =
    actionLabel &&
    (onAction ? (
      <button type="button" onClick={onAction} className={btnPrimary}>
        {actionLabel}
      </button>
    ) : actionHref ? (
      <Link href={actionHref} className={btnPrimary}>
        {actionLabel}
      </Link>
    ) : null);

  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-6 py-12 sm:py-16 rounded-2xl border border-dashed ${border} ${className}`}
    >
      {icon && <div className="mb-3 text-2xl opacity-70">{icon}</div>}
      <h3 className={`text-base font-semibold ${titleCls}`}>{title}</h3>
      {description && (
        <p className={`mt-1.5 text-sm max-w-sm ${descCls}`}>{description}</p>
      )}
      {(action || secondaryLabel) && (
        <div className="mt-5 flex flex-col sm:flex-row items-center gap-3">
          {action}
          {secondaryLabel && secondaryHref && (
            <Link href={secondaryHref} className={btnSecondary}>
              {secondaryLabel}
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
