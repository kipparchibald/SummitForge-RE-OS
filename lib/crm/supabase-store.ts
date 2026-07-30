/**
 * CRM dual store: localStorage cache + Supabase when authenticated.
 * Matches the alerts dual-store pattern (lib/alerts/supabase-store.ts).
 *
 * - Demo / signed-out: localStorage only (existing behavior)
 * - Supabase + session: load/save crm_contacts for multi-device pipeline
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  DEMO_CONTACTS,
  loadContacts as localLoad,
  saveContacts as localSave,
  type CrmContact,
  type CrmStage,
} from './store';
import type { ShowingRequest } from '@/lib/portal/matches';
import {
  loadShowingRequests as localLoadShowings,
  saveShowingRequestsLocal,
} from '@/lib/portal/matches';

const DEFAULT_BROKERAGE = 'archibald-bagley';

let _client: SupabaseClient | null | undefined;

function getClient(): SupabaseClient | null {
  if (_client !== undefined) return _client;
  if (typeof window === 'undefined') {
    _client = null;
    return null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (
    !url ||
    !key ||
    url.includes('your-project') ||
    url.includes('demo.supabase.co') ||
    key.includes('your-anon')
  ) {
    _client = null;
    return null;
  }
  _client = createClient(url, key);
  return _client;
}

export function isCrmCloudConfigured(): boolean {
  return !!getClient();
}

export type CrmStorageMode = 'cloud' | 'local';

async function sessionUserId(sb: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function rowToContact(row: Record<string, unknown>): CrmContact {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    email: row.email ? String(row.email) : undefined,
    phone: row.phone ? String(row.phone) : undefined,
    stage: (row.stage as CrmStage) || 'lead',
    interest: String(row.interest || ''),
    budget: row.budget != null ? Number(row.budget) : undefined,
    areas: Array.isArray(row.areas) ? (row.areas as string[]) : [],
    source: row.source ? String(row.source) : undefined,
    notes: Array.isArray(row.notes) ? (row.notes as string[]) : [],
    score: row.score != null ? Number(row.score) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function contactToRow(c: CrmContact, userId: string, brokerageId = DEFAULT_BROKERAGE) {
  return {
    id: c.id,
    user_id: userId,
    brokerage_id: brokerageId,
    name: c.name,
    email: c.email ?? null,
    phone: c.phone ?? null,
    stage: c.stage,
    interest: c.interest,
    budget: c.budget ?? null,
    areas: c.areas || [],
    source: c.source ?? null,
    notes: c.notes || [],
    score: c.score ?? null,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

/**
 * Load contacts: prefer Supabase when signed in; else local cache.
 * Seeds demo contacts into cloud on first authenticated empty session.
 */
export async function loadContactsAsync(): Promise<{
  contacts: CrmContact[];
  mode: CrmStorageMode;
}> {
  const sb = getClient();
  if (sb) {
    const userId = await sessionUserId(sb);
    if (userId) {
      try {
        const { data, error } = await sb
          .from('crm_contacts')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) {
          if (data.length > 0) {
            const contacts = data.map(rowToContact);
            localSave(contacts);
            return { contacts, mode: 'cloud' };
          }
          const local = localLoad();
          const seed = local.length ? local : DEMO_CONTACTS;
          if (seed.length) {
            await sb.from('crm_contacts').upsert(
              seed.map((c) => contactToRow(c, userId)),
              { onConflict: 'id' }
            );
            localSave(seed);
            return { contacts: seed, mode: 'cloud' };
          }
          return { contacts: [], mode: 'cloud' };
        }
        if (error) {
          console.warn('[crm] cloud load failed, using local:', error.message);
        }
      } catch (e) {
        console.warn('[crm] cloud load error', e);
      }
    }
  }

  return { contacts: localLoad(), mode: 'local' };
}

/** Persist full list to local + cloud (when signed in). */
export async function saveContactsAsync(list: CrmContact[]): Promise<{
  mode: CrmStorageMode;
  error?: string;
}> {
  localSave(list);
  const sb = getClient();
  if (!sb) return { mode: 'local' };

  const userId = await sessionUserId(sb);
  if (!userId) return { mode: 'local' };

  try {
    const { error } = await sb
      .from('crm_contacts')
      .upsert(list.map((c) => contactToRow(c, userId)), { onConflict: 'id' });
    if (error) {
      console.warn('[crm] cloud save failed:', error.message);
      return { mode: 'local', error: error.message };
    }
    return { mode: 'cloud' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { mode: 'local', error: msg };
  }
}

/** Upsert a single contact (faster path for stage changes). */
export async function upsertContactAsync(contact: CrmContact): Promise<CrmStorageMode> {
  const local = localLoad();
  const idx = local.findIndex((c) => c.id === contact.id);
  if (idx >= 0) local[idx] = contact;
  else local.unshift(contact);
  localSave(local);

  const sb = getClient();
  if (!sb) return 'local';
  const userId = await sessionUserId(sb);
  if (!userId) return 'local';

  try {
    const { error } = await sb
      .from('crm_contacts')
      .upsert(contactToRow(contact, userId), { onConflict: 'id' });
    if (error) {
      console.warn('[crm] upsert failed:', error.message);
      return 'local';
    }
    return 'cloud';
  } catch {
    return 'local';
  }
}

function rowToShowing(row: Record<string, unknown>): ShowingRequest {
  return {
    id: String(row.id),
    matchId: String(row.match_id),
    address: String(row.address),
    requestedAt: String(row.requested_at || new Date().toISOString()),
    preferredTimes: row.preferred_times ? String(row.preferred_times) : undefined,
    notes: row.notes ? String(row.notes) : undefined,
    status: (row.status as ShowingRequest['status']) || 'pending',
  };
}

function showingToRow(s: ShowingRequest, userId: string | null) {
  return {
    id: s.id,
    user_id: userId,
    brokerage_id: DEFAULT_BROKERAGE,
    match_id: s.matchId,
    address: s.address,
    preferred_times: s.preferredTimes ?? null,
    notes: s.notes ?? null,
    status: s.status,
    requested_at: s.requestedAt,
    updated_at: new Date().toISOString(),
  };
}

export async function loadShowingsAsync(): Promise<{
  showings: ShowingRequest[];
  mode: CrmStorageMode;
}> {
  const sb = getClient();
  if (sb) {
    const userId = await sessionUserId(sb);
    if (userId) {
      try {
        const { data, error } = await sb
          .from('showing_requests')
          .select('*')
          .order('requested_at', { ascending: false })
          .limit(100);
        if (!error && data && data.length > 0) {
          const showings = data.map(rowToShowing);
          saveShowingRequestsLocal(showings);
          return { showings, mode: 'cloud' };
        }
      } catch (e) {
        console.warn('[crm] showings load failed', e);
      }
    }
  }
  return { showings: localLoadShowings(), mode: 'local' };
}

export async function persistShowingAsync(req: ShowingRequest): Promise<CrmStorageMode> {
  const all = localLoadShowings();
  const idx = all.findIndex((s) => s.id === req.id);
  if (idx >= 0) all[idx] = req;
  else all.unshift(req);
  saveShowingRequestsLocal(all);

  const sb = getClient();
  if (!sb) return 'local';
  const userId = await sessionUserId(sb);
  try {
    const { error } = await sb
      .from('showing_requests')
      .upsert(showingToRow(req, userId), { onConflict: 'id' });
    if (error) {
      console.warn('[crm] showing upsert:', error.message);
      return 'local';
    }
    return userId ? 'cloud' : 'local';
  } catch {
    return 'local';
  }
}

export async function updateShowingStatusAsync(
  id: string,
  status: ShowingRequest['status']
): Promise<ShowingRequest[]> {
  const all = localLoadShowings().map((s) => (s.id === id ? { ...s, status } : s));
  saveShowingRequestsLocal(all);

  const sb = getClient();
  if (sb) {
    try {
      await sb
        .from('showing_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', id);
    } catch (e) {
      console.warn('[crm] showing status update failed', e);
    }
  }
  return all;
}
