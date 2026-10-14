/**
 * CRM dual store: localStorage cache + Supabase when authenticated.
 * Uses shared getBrowserSupabase() so login sessions are visible (SSR cookies).
 *
 * - Demo / signed-out: localStorage only
 * - Supabase + session: crm_contacts for multi-device pipeline
 */

'use client';

import {
  DEFAULT_BROKERAGE_SLUG,
  getBrowserBrokerageSlug,
  getBrowserSupabase,
  getBrowserUserId,
  isBrowserSupabaseConfigured,
} from '@/lib/auth/browser';
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
import {
  loadEnrollments as localLoadEnrollments,
  saveEnrollments as localSaveEnrollments,
  type NurtureEnrollment,
} from '@/lib/nurture/sequences';

export function isCrmCloudConfigured(): boolean {
  return isBrowserSupabaseConfigured();
}

export type CrmStorageMode = 'cloud' | 'local';

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
    lastTouchedAt: row.last_touched_at ? String(row.last_touched_at) : undefined,
    intentReason: row.intent_reason ? String(row.intent_reason) : undefined,
    snoozedUntil: row.snoozed_until ? String(row.snoozed_until) : undefined,
    dismissedAt: row.dismissed_at ? String(row.dismissed_at) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function contactToRow(c: CrmContact, userId: string, brokerageId: string) {
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
    last_touched_at: c.lastTouchedAt ?? null,
    intent_reason: c.intentReason ?? null,
    snoozed_until: c.snoozedUntil ?? null,
    dismissed_at: c.dismissedAt ?? null,
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
  const sb = getBrowserSupabase();
  if (sb) {
    const userId = await getBrowserUserId();
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
            const brokerageId = await getBrowserBrokerageSlug();
            await sb.from('crm_contacts').upsert(
              seed.map((c) => contactToRow(c, userId, brokerageId)),
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
  const sb = getBrowserSupabase();
  if (!sb) return { mode: 'local' };

  const userId = await getBrowserUserId();
  if (!userId) return { mode: 'local' };

  try {
    const brokerageId = await getBrowserBrokerageSlug();
    const { error } = await sb
      .from('crm_contacts')
      .upsert(
        list.map((c) => contactToRow(c, userId, brokerageId)),
        { onConflict: 'id' }
      );
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

  const sb = getBrowserSupabase();
  if (!sb) return 'local';
  const userId = await getBrowserUserId();
  if (!userId) return 'local';

  try {
    const brokerageId = await getBrowserBrokerageSlug();
    const { error } = await sb
      .from('crm_contacts')
      .upsert(contactToRow(contact, userId, brokerageId), { onConflict: 'id' });
    if (error) {
      console.warn('[crm] upsert failed:', error.message);
      return 'local';
    }
    return 'cloud';
  } catch {
    return 'local';
  }
}

/** Delete contact from local + cloud. */
export async function deleteContactAsync(id: string): Promise<CrmStorageMode> {
  const next = localLoad().filter((c) => c.id !== id);
  localSave(next);

  const sb = getBrowserSupabase();
  if (!sb) return 'local';
  const userId = await getBrowserUserId();
  if (!userId) return 'local';

  try {
    const { error } = await sb.from('crm_contacts').delete().eq('id', id);
    if (error) {
      console.warn('[crm] delete failed:', error.message);
      return 'local';
    }
    return 'cloud';
  } catch {
    return 'local';
  }
}

/**
 * Force-push local CRM (and optional enrollments) to cloud when signed in.
 * Used by "Sync this device → cloud" on the CRM page.
 */
export async function migrateLocalCrmToCloud(): Promise<{
  mode: CrmStorageMode;
  contacts: number;
  error?: string;
}> {
  const list = localLoad();
  const result = await saveContactsAsync(list.length ? list : DEMO_CONTACTS);
  if (result.error) return { mode: 'local', contacts: list.length, error: result.error };

  // Also push nurture enrollments if table exists
  try {
    await saveEnrollmentsAsync(localLoadEnrollments());
  } catch {
    /* optional */
  }

  return { mode: result.mode, contacts: list.length || DEMO_CONTACTS.length };
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

function showingToRow(s: ShowingRequest, userId: string | null, brokerageId: string) {
  return {
    id: s.id,
    user_id: userId,
    brokerage_id: brokerageId,
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
  const sb = getBrowserSupabase();
  if (sb) {
    const userId = await getBrowserUserId();
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

  const sb = getBrowserSupabase();
  if (!sb) return 'local';
  const userId = await getBrowserUserId();
  try {
    const brokerageId = await getBrowserBrokerageSlug();
    const { error } = await sb
      .from('showing_requests')
      .upsert(showingToRow(req, userId, brokerageId), { onConflict: 'id' });
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

  const sb = getBrowserSupabase();
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

// ---------------------------------------------------------------------------
// Nurture enrollments (cloud dual-store)
// ---------------------------------------------------------------------------

function enrollmentToRow(e: NurtureEnrollment, userId: string | null, brokerageId: string) {
  return {
    id: e.id,
    user_id: userId,
    brokerage_id: brokerageId,
    contact_id: e.contactId,
    sequence_id: e.sequenceId,
    enrolled_at: e.enrolledAt,
    next_step_index: e.nextStepIndex,
    status: e.status,
    last_sent_at: e.lastSentAt ?? null,
  };
}

function rowToEnrollment(row: Record<string, unknown>): NurtureEnrollment {
  return {
    id: String(row.id),
    contactId: String(row.contact_id),
    sequenceId: String(row.sequence_id),
    enrolledAt: String(row.enrolled_at || new Date().toISOString()),
    nextStepIndex: Number(row.next_step_index || 0),
    status: (row.status as NurtureEnrollment['status']) || 'active',
    lastSentAt: row.last_sent_at ? String(row.last_sent_at) : undefined,
  };
}

export async function loadEnrollmentsAsync(): Promise<{
  enrollments: NurtureEnrollment[];
  mode: CrmStorageMode;
}> {
  const sb = getBrowserSupabase();
  if (sb) {
    const userId = await getBrowserUserId();
    if (userId) {
      try {
        const { data, error } = await sb
          .from('nurture_enrollments')
          .select('*')
          .order('enrolled_at', { ascending: false })
          .limit(200);
        if (!error && data && data.length > 0) {
          const enrollments = data.map(rowToEnrollment);
          localSaveEnrollments(enrollments);
          return { enrollments, mode: 'cloud' };
        }
      } catch (e) {
        console.warn('[crm] enrollments load failed', e);
      }
    }
  }
  return { enrollments: localLoadEnrollments(), mode: 'local' };
}

export async function saveEnrollmentsAsync(
  list: NurtureEnrollment[]
): Promise<CrmStorageMode> {
  localSaveEnrollments(list);
  const sb = getBrowserSupabase();
  if (!sb) return 'local';
  const userId = await getBrowserUserId();
  if (!userId) return 'local';

  try {
    const brokerageId = await getBrowserBrokerageSlug();
    const { error } = await sb
      .from('nurture_enrollments')
      .upsert(
        list.map((e) => enrollmentToRow(e, userId, brokerageId)),
        { onConflict: 'id' }
      );
    if (error) {
      console.warn('[crm] enrollments save:', error.message);
      return 'local';
    }
    return 'cloud';
  } catch {
    return 'local';
  }
}

export async function upsertEnrollmentAsync(
  enrollment: NurtureEnrollment
): Promise<CrmStorageMode> {
  const all = localLoadEnrollments().filter((e) => e.id !== enrollment.id);
  all.push(enrollment);
  return saveEnrollmentsAsync(all);
}

export { DEFAULT_BROKERAGE_SLUG };
