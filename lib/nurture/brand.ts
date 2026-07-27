/**
 * Resolve agent/brokerage strings for nurture templates from white-label branding.
 */

import { loadPersistedBranding } from '@/lib/branding/apply';

const DEFAULTS = {
  agent: 'Kipp Archibald',
  brokerage: 'Archibald-Bagley Real Estate',
  phone: '(208) 521-2751',
};

export function nurtureBrandContext(): {
  agent: string;
  brokerage: string;
  phone: string;
} {
  const brand = typeof window !== 'undefined' ? loadPersistedBranding() : null;
  return {
    agent: DEFAULTS.agent,
    brokerage: brand?.companyName || DEFAULTS.brokerage,
    phone: brand?.phone || DEFAULTS.phone,
  };
}
