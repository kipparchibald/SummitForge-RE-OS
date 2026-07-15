// Simple client-side + server-friendly match store
// Uses localStorage on the client. Later replace with Supabase.

import { AlertMatch, Alert, Listing } from '@/types/alerts';

const MATCHES_KEY = 'sf_alert_matches';
const ALERTS_KEY = 'sf_user_alerts';

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
  localStorage.setItem(MATCHES_KEY, JSON.stringify(matches.slice(0, 200))); // keep last 200
}

export function addMatches(newMatches: AlertMatch[]) {
  const existing = getStoredMatches();
  const combined = [...newMatches, ...existing];
  // dedupe by id
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

export function markMatchNotified(matchId: string) {
  const matches = getStoredMatches();
  const updated = matches.map(m =>
    m.id === matchId ? { ...m, notified: true } : m
  );
  saveMatches(updated);
}
