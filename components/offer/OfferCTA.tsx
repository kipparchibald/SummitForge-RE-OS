'use client';

import Link from 'next/link';

/** Deep-link into Offer Decision Engine with optional context. */
export function buildOfferHref(opts?: {
  address?: string;
  price?: number;
  sqft?: number;
  acres?: number;
  isLand?: boolean;
}) {
  const q = new URLSearchParams();
  if (opts?.address) q.set('address', opts.address);
  if (opts?.price != null && opts.price > 0) q.set('price', String(Math.round(opts.price)));
  if (opts?.sqft != null && opts.sqft > 0) q.set('sqft', String(Math.round(opts.sqft)));
  if (opts?.acres != null && opts.acres > 0) q.set('acres', String(opts.acres));
  if (opts?.isLand) q.set('land', '1');
  const s = q.toString();
  return s ? `/offer?${s}` : '/offer';
}

export default function OfferCTA({
  address,
  price,
  sqft,
  acres,
  isLand,
  variant = 'button',
  className = '',
}: {
  address?: string;
  price?: number;
  sqft?: number;
  acres?: number;
  isLand?: boolean;
  variant?: 'button' | 'link' | 'chip';
  className?: string;
}) {
  const href = buildOfferHref({ address, price, sqft, acres, isLand });

  if (variant === 'chip') {
    return (
      <Link
        href={href}
        className={
          className ||
          'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 transition'
        }
      >
        Should I offer?
      </Link>
    );
  }

  if (variant === 'link') {
    return (
      <Link
        href={href}
        className={className || 'text-sm text-emerald-400 hover:text-emerald-300 underline-offset-2 hover:underline'}
      >
        Should I offer? →
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className={
        className ||
        'inline-flex items-center justify-center px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium transition'
      }
    >
      Should I offer?
    </Link>
  );
}
