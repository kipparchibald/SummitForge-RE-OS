// Dual store: localStorage (always) + Supabase (when signed in).
// Uses shared getBrowserSupabase() so cookie auth sessions are honored.

'use client';

import type { Alert, AlertMatch, Listing } from '@/types/alerts';
import {
  getBrowserBrokerageSlug,
  getBrowserSupabase,
  getBrowserUserId,
  isBrowserSupabaseConfigured,
} from '@/lib/auth/browser';
import {
  getStoredMatches as localGetMatches,
  saveMatches as localSaveMatches,
  addMatches as localAddMatches,
  getStoredAlerts as localGetAlerts,
  saveAlerts as localSaveAlerts,
  deleteStoredAlert as localDeleteAlert,
  getStoredListings as localGetListings,
  addListings as localAddListings,
  markMatchNotified as localMarkNotified,
} from './store';
import { withDemoMatchesIfEmpty } from './demo-seed';

export function isSupabaseConfigured(): boolean {
  return isBrowserSupabaseConfigured();
}

export type AlertStorageMode = 'cloud' | 'local';

export async function getStorageMode(): Promise<AlertStorageMode> {
  const sb = getBrowserSupabase();
  if (!sb) return 'local';
  const uid = await getBrowserUserId();
  return uid ? 'cloud' : 'local';
}

export async function getAlerts(userId?: string): Promise<Alert[]> {
  const sb = getBrowserSupabase();
  if (sb) {
    try {
      const uid = userId || (await getBrowserUserId());
      let q = sb.from('alerts').select('*').order('created_at', { ascending: false });
      // When signed in, RLS scopes by brokerage; optional agent filter kept soft.
      if (uid && userId) q = q.eq('user_id', uid);
      const { data, error } = await q;
      if (!error && data && data.length > 0) {
        const alerts = data.map(rowToAlert);
        localSaveAlerts(alerts);
        return alerts;
      }
    } catch (e) {
      console.warn('[supabase-store] getAlerts failed, falling back to local', e);
    }
  }
  return localGetAlerts();
}

export async function saveAlert(alert: Alert): Promise<AlertStorageMode> {
  const uid = (await getBrowserUserId()) || alert.userId || 'local';
  const brokerageId = (await getBrowserBrokerageSlug()) || alert.brokerageId || 'archibald-bagley';
  const enriched: Alert = {
    ...alert,
    userId: uid,
    brokerageId,
  };

  const existing = localGetAlerts();
  const idx = existing.findIndex((a) => a.id === enriched.id);
  if (idx >= 0) existing[idx] = enriched;
  else existing.unshift(enriched);
  localSaveAlerts(existing);

  const sb = getBrowserSupabase();
  if (sb && uid !== 'local') {
    try {
      const { error } = await sb.from('alerts').upsert(alertToRow(enriched));
      if (error) {
        console.warn('[supabase-store] saveAlert failed', error.message);
        return 'local';
      }
      return 'cloud';
    } catch (e) {
      console.warn('[supabase-store] saveAlert failed', e);
      return 'local';
    }
  }
  return 'local';
}

export async function deleteAlert(id: string): Promise<void> {
  localDeleteAlert(id);
  const sb = getBrowserSupabase();
  if (sb) {
    try {
      await sb.from('alerts').delete().eq('id', id);
    } catch (e) {
      console.warn('[supabase-store] deleteAlert failed', e);
    }
  }
}

export async function getMatches(limit = 50): Promise<AlertMatch[]> {
  const sb = getBrowserSupabase();
  if (sb) {
    try {
      const uid = await getBrowserUserId();
      if (uid) {
        const { data, error } = await sb
          .from('alert_matches')
          .select('*')
          .order('matched_at', { ascending: false })
          .limit(limit);
        if (!error && data && data.length > 0) {
          const matches = data.map(rowToMatch);
          localSaveMatches(matches);
          return matches;
        }
      }
    } catch (e) {
      console.warn('[supabase-store] getMatches failed, falling back', e);
    }
  }
  const local = localGetMatches().slice(0, limit);
  return withDemoMatchesIfEmpty(local).slice(0, limit);
}

export async function addMatches(matches: AlertMatch[]): Promise<AlertStorageMode> {
  localAddMatches(matches);

  const sb = getBrowserSupabase();
  const uid = await getBrowserUserId();
  if (sb && uid && matches.length) {
    try {
      const { error } = await sb.from('alert_matches').upsert(matches.map(matchToRow));
      if (error) {
        console.warn('[supabase-store] addMatches failed', error.message);
        return 'local';
      }
      return 'cloud';
    } catch (e) {
      console.warn('[supabase-store] addMatches failed', e);
      return 'local';
    }
  }
  return 'local';
}

export async function markMatchNotified(matchId: string): Promise<void> {
  localMarkNotified(matchId);
  const sb = getBrowserSupabase();
  if (sb) {
    try {
      await sb.from('alert_matches').update({ notified: true }).eq('id', matchId);
    } catch (e) {
      console.warn('[supabase-store] markMatchNotified failed', e);
    }
  }
}

export async function getListings(): Promise<Listing[]> {
  return localGetListings();
}

export async function addListings(listings: Listing[]): Promise<void> {
  localAddListings(listings);
}

/** Push local alerts + matches into Supabase when signed in. */
export async function migrateLocalAlertsToCloud(): Promise<{
  mode: AlertStorageMode;
  alerts: number;
  matches: number;
  error?: string;
}> {
  const sb = getBrowserSupabase();
  const uid = await getBrowserUserId();
  if (!sb || !uid) {
    return { mode: 'local', alerts: 0, matches: 0, error: 'Sign in required for cloud sync' };
  }

  const alerts = localGetAlerts();
  const matches = localGetMatches();
  const brokerageId = await getBrowserBrokerageSlug();

  try {
    if (alerts.length) {
      const rows = alerts.map((a) =>
        alertToRow({ ...a, userId: uid, brokerageId: a.brokerageId || brokerageId })
      );
      const { error } = await sb.from('alerts').upsert(rows);
      if (error) return { mode: 'local', alerts: 0, matches: 0, error: error.message };
    }
    if (matches.length) {
      const { error } = await sb.from('alert_matches').upsert(matches.map(matchToRow));
      if (error) return { mode: 'local', alerts: alerts.length, matches: 0, error: error.message };
    }
    return { mode: 'cloud', alerts: alerts.length, matches: matches.length };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { mode: 'local', alerts: 0, matches: 0, error: msg };
  }
}

function rowToAlert(row: any): Alert {
  return {
    id: row.id,
    userId: row.user_id,
    brokerageId: row.brokerage_id,
    name: row.name,
    locations: row.locations || [],
    minPrice: row.min_price,
    maxPrice: row.max_price,
    minAcres: row.min_acres,
    maxAcres: row.max_acres,
    propertyTypes: row.property_types || [],
    newConstructionOnly: row.new_construction_only || false,
    keywords: row.keywords || [],
    notifyBy: row.notify_by || ['sms'],
    frequency: row.frequency || 'instant',
    phone: row.phone,
    email: row.email,
    active: row.active ?? true,
    createdAt: row.created_at,
    lastMatchedAt: row.last_matched_at,
  };
}

function alertToRow(a: Alert) {
  return {
    id: a.id,
    user_id: a.userId,
    brokerage_id: a.brokerageId,
    name: a.name,
    locations: a.locations,
    min_price: a.minPrice,
    max_price: a.maxPrice,
    min_acres: a.minAcres,
    max_acres: a.maxAcres,
    property_types: a.propertyTypes,
    new_construction_only: a.newConstructionOnly,
    keywords: a.keywords,
    notify_by: a.notifyBy,
    frequency: a.frequency,
    phone: a.phone,
    email: a.email,
    active: a.active,
    created_at: a.createdAt,
    last_matched_at: a.lastMatchedAt,
  };
}

function rowToMatch(row: any): AlertMatch {
  return {
    id: row.id,
    alertId: row.alert_id,
    listingId: row.listing_id,
    matchScore: row.match_score,
    matchedAt: row.matched_at,
    notified: row.notified || false,
    notificationMethod: row.notification_method,
    alertName: row.alert_name,
    listingSnapshot: row.listing_snapshot || undefined,
  };
}

function matchToRow(m: AlertMatch) {
  return {
    id: m.id,
    alert_id: m.alertId,
    listing_id: m.listingId,
    match_score: m.matchScore,
    matched_at: m.matchedAt,
    notified: m.notified,
    notification_method: m.notificationMethod,
    alert_name: m.alertName,
    listing_snapshot: m.listingSnapshot,
  };
}
