// Dual store: localStorage (always) + Supabase (when configured)
// Seamless offline → cloud upgrade path for multi-tenant later.

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Alert, AlertMatch, Listing } from '@/types/alerts';
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

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || url.includes('your-project') || url.includes('demo.supabase.co') || key.includes('your-anon')) {
    return null;
  }
  supabase = createClient(url, key);
  return supabase;
}

export function isSupabaseConfigured(): boolean {
  return !!getSupabase();
}

export async function getAlerts(userId?: string): Promise<Alert[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      let q = sb.from('alerts').select('*').order('created_at', { ascending: false });
      if (userId) q = q.eq('user_id', userId);
      const { data, error } = await q;
      if (!error && data && data.length > 0) {
        const alerts = data.map(rowToAlert);
        // keep local in sync
        localSaveAlerts(alerts);
        return alerts;
      }
    } catch (e) {
      console.warn('[supabase-store] getAlerts failed, falling back to local', e);
    }
  }
  return localGetAlerts();
}

export async function saveAlert(alert: Alert): Promise<void> {
  const existing = localGetAlerts();
  const idx = existing.findIndex(a => a.id === alert.id);
  if (idx >= 0) existing[idx] = alert;
  else existing.unshift(alert);
  localSaveAlerts(existing);

  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('alerts').upsert(alertToRow(alert));
    } catch (e) {
      console.warn('[supabase-store] saveAlert failed', e);
    }
  }
}

export async function deleteAlert(id: string): Promise<void> {
  localDeleteAlert(id);
  const sb = getSupabase();
  if (sb) {
    try {
      await sb.from('alerts').delete().eq('id', id);
    } catch (e) {
      console.warn('[supabase-store] deleteAlert failed', e);
    }
  }
}

export async function getMatches(limit = 50): Promise<AlertMatch[]> {
  const sb = getSupabase();
  if (sb) {
    try {
      const { data, error } = await sb
        .from('alert_matches')
        .select('*')
        .order('matched_at', { ascending: false })
        .limit(limit);
      if (!error && data && data.length > 0) {
        return data.map(rowToMatch);
      }
    } catch (e) {
      console.warn('[supabase-store] getMatches failed, falling back', e);
    }
  }
  return localGetMatches().slice(0, limit);
}

export async function addMatches(matches: AlertMatch[]): Promise<void> {
  localAddMatches(matches);

  const sb = getSupabase();
  if (sb && matches.length) {
    try {
      await sb.from('alert_matches').upsert(matches.map(matchToRow));
    } catch (e) {
      console.warn('[supabase-store] addMatches failed', e);
    }
  }
}

export async function markMatchNotified(matchId: string): Promise<void> {
  localMarkNotified(matchId);
  const sb = getSupabase();
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
  // Future: upsert into listings table when Supabase ready
}

// Helpers
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
