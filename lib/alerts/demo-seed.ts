/**
 * Demo matches for offline demos — shows "Should I offer?" on the dashboard
 * without Navica. Only used when local + Supabase matches are empty.
 */

import type { AlertMatch } from '@/types/alerts';

export const DEMO_MATCHES: AlertMatch[] = [
  {
    id: 'demo-match-lindy',
    alertId: 'demo-alert-rigby-homes',
    listingId: 'demo-listing-lindy',
    matchScore: 94,
    matchedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    notified: false,
    notificationMethod: 'in-app',
    alertName: 'Rigby 3–4 bed under $520k',
    listingSnapshot: {
      address: '789 Lindy Lane, Rigby, ID',
      city: 'Rigby',
      price: 489000,
      propertyType: 'Single Family',
      isNewConstruction: false,
      mlsNumber: 'DEMO-1001',
    },
  },
  {
    id: 'demo-match-kiana',
    alertId: 'demo-alert-ada',
    listingId: 'demo-listing-kiana',
    matchScore: 91,
    matchedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    notified: false,
    notificationMethod: 'sms',
    alertName: 'One-level / ADA friendly',
    listingSnapshot: {
      address: '172 Kiana Dr, Rigby, ID',
      city: 'Rigby',
      price: 512000,
      propertyType: 'New Construction',
      isNewConstruction: true,
      mlsNumber: 'DEMO-1002',
    },
  },
  {
    id: 'demo-match-teton-lot',
    alertId: 'demo-alert-land',
    listingId: 'demo-listing-teton14',
    matchScore: 88,
    matchedAt: new Date(Date.now() - 26 * 60 * 60 * 1000).toISOString(),
    notified: true,
    notificationMethod: 'in-app',
    alertName: 'Teton Heights lots',
    listingSnapshot: {
      address: 'Teton Heights Lot 14, Rigby, ID',
      city: 'Rigby',
      price: 99500,
      acres: 0.28,
      propertyType: 'Land',
      isNewConstruction: false,
      mlsNumber: 'DEMO-LAND-14',
    },
  },
];

export function withDemoMatchesIfEmpty(matches: AlertMatch[]): AlertMatch[] {
  if (matches && matches.length > 0) return matches;
  return DEMO_MATCHES;
}
