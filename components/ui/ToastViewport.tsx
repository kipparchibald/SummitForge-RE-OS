'use client';

import React, { useEffect, useState } from 'react';
import {
  dismissToast,
  subscribeToasts,
  type ToastItem,
  type ToastTone,
} from '@/lib/toast/store';

const toneStyles: Record<ToastTone, string> = {
  success: 'border-emerald-700 bg-emerald-950 text-emerald-100',
  error: 'border-rose-800 bg-rose-950 text-rose-100',
  warning: 'border-amber-700 bg-amber-950 text-amber-100',
  info: 'border-zinc-700 bg-zinc-900 text-zinc-100',
};

/** Fixed bottom-right toast stack — mount once in root layout. */
export default function ToastViewport() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => subscribeToasts(setItems), []);

  if (items.length === 0) return null;

  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-[min(100vw-2rem,22rem)] pointer-events-none"
      aria-live="polite"
    >
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg text-sm ${toneStyles[t.tone]}`}
        >
          <span className="flex-1 leading-snug">{t.message}</span>
          <button
            type="button"
            onClick={() => dismissToast(t.id)}
            className="shrink-0 text-xs opacity-60 hover:opacity-100"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
