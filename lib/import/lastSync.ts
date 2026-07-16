// lib/import/lastSync.ts
// Pure "last Navica pull" timestamp helpers. Deliberately dependency-free so
// pages that only show the "Live • Last: HH:MM" badge (dashboard, monitoring,
// analytics) can import these without pulling @supabase/supabase-js — and the
// papaparse/supabase transitive chain — into their client bundle.

let lastSyncTimestamp: string | null = null;

export function setLastSyncTimestamp(isoTimestamp?: string) {
  const ts = isoTimestamp || new Date().toISOString();
  lastSyncTimestamp = ts;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('summitforge_last_navica_pull', ts);
    } catch (e) {}
  }
}

export function getLastSyncTimestamp(): string | null {
  if (typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('summitforge_last_navica_pull');
      if (stored) {
        lastSyncTimestamp = stored;
        return stored;
      }
    } catch (e) {}
  }
  return lastSyncTimestamp;
}

export function formatLastSyncTime(iso?: string | null): string {
  const ts = iso || getLastSyncTimestamp();
  if (!ts) return '';
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

export function isLastSyncRecent(iso?: string | null): boolean {
  const ts = iso || getLastSyncTimestamp();
  if (!ts) return false;
  try {
    const then = new Date(ts).getTime();
    const now = Date.now();
    return (now - then) < 60 * 60 * 1000; // 60 min window for "green"
  } catch {
    return false;
  }
}
