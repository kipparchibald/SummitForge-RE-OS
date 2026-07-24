'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppNavLinks } from './AppNavLinks';

export default function MobileNav({
  companyName,
  tagline,
  isDemo,
}: {
  companyName: string;
  tagline: string;
  isDemo: boolean;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
      >
        <span className="sr-only">Menu</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          {open ? (
            <path d="M6 6l12 12M18 6L6 18" />
          ) : (
            <>
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close menu overlay"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-[min(20rem,88vw)] bg-white shadow-xl p-6 overflow-y-auto">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <Link
                  href="/"
                  onClick={() => setOpen(false)}
                  className="font-semibold text-xl tracking-tight"
                  style={{ color: 'var(--primary)' }}
                >
                  {companyName}
                </Link>
                <div className="text-xs text-gray-500 mt-0.5">{tagline}</div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-gray-400 hover:text-gray-700 text-sm px-2 py-1"
              >
                Close
              </button>
            </div>
            <AppNavLinks onNavigate={() => setOpen(false)} />
            <div className="mt-8 pt-6 border-t">
              <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Plan</div>
              <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
                {isDemo ? 'PRO (Demo)' : 'PRO'}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
