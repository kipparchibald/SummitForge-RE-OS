'use client';

/**
 * Server-safe branded strings. SSR uses deployment/env fallback; after mount,
 * localStorage / branding-updated events can override without hydration mismatch.
 */

import { useEffect, useState, type ElementType } from 'react';
import { loadPersistedBranding, type BrandPayload } from '@/lib/branding/apply';

type BrandField = 'companyName' | 'tagline' | 'phone';

function readField(b: BrandPayload | null | undefined, field: BrandField): string | undefined {
  const v = b?.[field];
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

export function BrandText({
  field,
  fallback,
  as: Comp = 'span',
  className,
}: {
  field: BrandField;
  fallback: string;
  as?: 'span' | 'div' | 'p';
  className?: string;
}) {
  const [text, setText] = useState(fallback);

  useEffect(() => {
    const apply = (b?: BrandPayload | null) => {
      const next = readField(b, field) ?? readField(loadPersistedBranding(), field);
      if (next) setText(next);
    };
    apply(loadPersistedBranding());
    const onUpdate = (e: Event) => {
      apply((e as CustomEvent<BrandPayload>).detail);
    };
    window.addEventListener('summitforge-branding-updated', onUpdate);
    return () => window.removeEventListener('summitforge-branding-updated', onUpdate);
  }, [field]);

  const Tag = Comp as ElementType;
  return (
    <Tag className={className} suppressHydrationWarning>
      {text}
    </Tag>
  );
}

/** Phone link that stays in sync with white-label branding after mount. */
export function BrandPhone({
  fallback,
  className,
}: {
  fallback: string;
  className?: string;
}) {
  const [phone, setPhone] = useState(fallback);

  useEffect(() => {
    const apply = (b?: BrandPayload | null) => {
      const next = readField(b, 'phone') ?? readField(loadPersistedBranding(), 'phone');
      if (next) setPhone(next);
    };
    apply(loadPersistedBranding());
    const onUpdate = (e: Event) => {
      apply((e as CustomEvent<BrandPayload>).detail);
    };
    window.addEventListener('summitforge-branding-updated', onUpdate);
    return () => window.removeEventListener('summitforge-branding-updated', onUpdate);
  }, []);

  const digits = phone.replace(/[^0-9]/g, '');

  return (
    <a href={`tel:${digits}`} className={className} suppressHydrationWarning>
      {phone}
    </a>
  );
}
