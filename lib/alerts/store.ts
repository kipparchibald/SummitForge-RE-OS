// Client-side store (localStorage)
// Always available; Supabase dual-store builds on top of this.

import { AlertMatch, Alert, Listing } from '@/types/alerts';

const MATCHES_KEY = 'sf_alert_matches';
const ALERTS_KEY = 'sf_user_alerts';
const LISTINGS_KEY = 'sf_imported_listings';

export function getStoredMatches(): AlertMatch[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(MATCHES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveMatches(matches: AlertMatch[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches.slice(0, 300)));
}

export function addMatches(newMatches: AlertMatch[]) {
  const existing = getStoredMatches();
  const combined = [...newMatches, ...existing];
  const seen = new Set<string>();
  const unique = combined.filter(m => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });
  saveMatches(unique);
  return unique;
}

export function getStoredAlerts(): Alert[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveAlerts(alerts: Alert[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts));
}

export function deleteStoredAlert(id: string) {
  const next = getStoredAlerts().filter(a => a.id !== id);
  saveAlerts(next);
  return next;
}

export function markMatchNotified(matchId: string) {
  const matches = getStoredMatches();
  const updated = matches.map(m =>
    m.id === matchId ? { ...m, notified: true } : m
  );
  saveMatches(updated);
}

// Listings cache (for display joins + rematch)
export function getStoredListings(): Listing[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LISTINGS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveListings(listings: Listing[]) {
  if (typeof window === 'undefined') return;
  // keep last 500
  localStorage.setItem(LISTINGS_KEY, JSON.stringify(listings.slice(0, 500)));
}

export function addListings(newListings: Listing[]) {
  const existing = getStoredListings();
  const map = new Map<string, Listing>();
  for (const l of existing) map.set(l.id, l);
  for (const l of newListings) map.set(l.id, l);
  const combined = Array.from(map.values());
  saveListings(combined);
  return combined;
}
