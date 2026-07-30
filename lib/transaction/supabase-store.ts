/**
 * Transaction dual-store: localStorage cache + Supabase when signed in.
 * Mirrors lib/crm/supabase-store.ts
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  loadTransactions as localLoad,
  saveTransactions as localSave,
  createStoredTransaction as localCreate,
  updateStoredTransaction as localUpdate,
  toggleChecklistItem as localToggle,
  type StoredTransaction,
} from './store';
import type { ChecklistItem } from './checklist';

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

export type TxStorageMode = 'cloud' | 'local';

async function sessionUserId(sb: SupabaseClient): Promise<string | null> {
  try {
    const { data } = await sb.auth.getUser();
    return data.user?.id ?? null;
  } catch {
    return null;
  }
}

function rowToTx(row: Record<string, unknown>): StoredTransaction {
  const timeline = (row.timeline as StoredTransaction['timeline']) || {};
  const documents = Array.isArray(row.documents) ? row.documents : [];
  const notes = Array.isArray(row.notes) ? (row.notes as string[]) : [];
  const checklist = Array.isArray(row.checklist)
    ? (row.checklist as ChecklistItem[])
    : [];

  return {
    id: String(row.id),
    propertyId: String(row.property_id || row.id),
    status: (row.status as StoredTransaction['status']) || 'new',
    buyer: row.buyer ? String(row.buyer) : undefined,
    seller: row.seller ? String(row.seller) : undefined,
    price: row.price != null ? Number(row.price) : 0,
    timeline,
    documents,
    notes,
    address: row.address
      ? String(row.address)
      : row.property_address
        ? String(row.property_address)
        : undefined,
    effectiveDate: row.effective_date ? String(row.effective_date).slice(0, 10) : undefined,
    checklist,
    isLand: Boolean(row.is_land),
    isNewConstruction: Boolean(row.is_new_construction),
    contactId: row.contact_id ? String(row.contact_id) : undefined,
  };
}

function txToRow(tx: StoredTransaction, userId: string | null) {
  return {
    id: tx.id,
    property_id: tx.propertyId,
    status: tx.status,
    buyer: tx.buyer ?? null,
    seller: tx.seller ?? null,
    price: tx.price,
    timeline: tx.timeline || {},
    documents: tx.documents || [],
    notes: tx.notes || [],
    brokerage_id: DEFAULT_BROKERAGE,
    agent_id: userId,
    address: tx.address ?? null,
    effective_date: tx.effectiveDate ?? null,
    checklist: tx.checklist || [],
    is_land: !!tx.isLand,
    is_new_construction: !!tx.isNewConstruction,
    contact_id: tx.contactId ?? null,
    updated_at: new Date().toISOString(),
  };
}

export async function loadTransactionsAsync(): Promise<{
  transactions: StoredTransaction[];
  mode: TxStorageMode;
}> {
  const sb = getClient();
  if (sb) {
    const userId = await sessionUserId(sb);
    if (userId) {
      try {
        const { data, error } = await sb
          .from('transactions')
          .select('*')
          .order('updated_at', { ascending: false });
        if (!error && data) {
          if (data.length > 0) {
            const transactions = data.map(rowToTx);
            localSave(transactions);
            return { transactions, mode: 'cloud' };
          }
          // First sync: push local files up
          const local = localLoad();
          if (local.length) {
            await sb.from('transactions').upsert(
              local.map((t) => txToRow(t, userId)),
              { onConflict: 'id' }
            );
            return { transactions: local, mode: 'cloud' };
          }
          return { transactions: [], mode: 'cloud' };
        }
        if (error) console.warn('[tx] cloud load:', error.message);
      } catch (e) {
        console.warn('[tx] cloud load error', e);
      }
    }
  }
  return { transactions: localLoad(), mode: 'local' };
}

export async function saveTransactionsAsync(
  list: StoredTransaction[]
): Promise<{ mode: TxStorageMode; error?: string }> {
  localSave(list);
  const sb = getClient();
  if (!sb) return { mode: 'local' };
  const userId = await sessionUserId(sb);
  if (!userId) return { mode: 'local' };
  try {
    const { error } = await sb
      .from('transactions')
      .upsert(list.map((t) => txToRow(t, userId)), { onConflict: 'id' });
    if (error) return { mode: 'local', error: error.message };
    return { mode: 'cloud' };
  } catch (e: unknown) {
    return { mode: 'local', error: e instanceof Error ? e.message : String(e) };
  }
}

export async function upsertTransactionAsync(
  tx: StoredTransaction
): Promise<{ tx: StoredTransaction; mode: TxStorageMode }> {
  const all = localLoad();
  const i = all.findIndex((t) => t.id === tx.id);
  if (i >= 0) all[i] = tx;
  else all.unshift(tx);
  localSave(all);

  const sb = getClient();
  if (!sb) return { tx, mode: 'local' };
  const userId = await sessionUserId(sb);
  if (!userId) return { tx, mode: 'local' };
  try {
    const { error } = await sb.from('transactions').upsert(txToRow(tx, userId), {
      onConflict: 'id',
    });
    if (error) {
      console.warn('[tx] upsert:', error.message);
      return { tx, mode: 'local' };
    }
    return { tx, mode: 'cloud' };
  } catch {
    return { tx, mode: 'local' };
  }
}

export async function createTransactionAsync(opts: {
  address: string;
  price: number;
  buyer?: string;
  seller?: string;
  isLand?: boolean;
  isNewConstruction?: boolean;
  contactId?: string;
}): Promise<{ tx: StoredTransaction; mode: TxStorageMode }> {
  // localCreate already prepends + saves local
  const tx = localCreate(opts);
  if (opts.contactId) {
    const patched = { ...tx, contactId: opts.contactId };
    return upsertTransactionAsync(patched);
  }
  return upsertTransactionAsync(tx);
}

export async function updateTransactionAsync(
  id: string,
  patch: Partial<StoredTransaction>
): Promise<{ tx: StoredTransaction | null; mode: TxStorageMode }> {
  const updated = localUpdate(id, patch);
  if (!updated) return { tx: null, mode: 'local' };
  return upsertTransactionAsync(updated);
}

export async function toggleChecklistItemAsync(
  txId: string,
  itemId: string,
  done: boolean
): Promise<{ tx: StoredTransaction | null; mode: TxStorageMode }> {
  const updated = localToggle(txId, itemId, done);
  if (!updated) return { tx: null, mode: 'local' };
  return upsertTransactionAsync(updated);
}

/** Open or reuse an open deal for a CRM contact. */
export async function openDealFromContactAsync(contact: {
  id: string;
  name: string;
  interest?: string;
  budget?: number;
  areas?: string[];
}): Promise<{ tx: StoredTransaction; mode: TxStorageMode; reused: boolean }> {
  const { transactions } = await loadTransactionsAsync();
  const open = transactions.find(
    (t) => t.contactId === contact.id && t.status !== 'closed'
  );
  if (open) {
    return { tx: open, mode: 'local', reused: true };
  }

  const area = contact.areas?.[0] || 'Eastern Idaho';
  const address =
    contact.interest && contact.interest.length < 80
      ? `${contact.interest} · ${area}`
      : `Buyer search · ${area}`;

  const { tx, mode } = await createTransactionAsync({
    address,
    price: contact.budget || 0,
    buyer: contact.name,
    contactId: contact.id,
    isLand: /land|acre|plat|subdiv/i.test(contact.interest || ''),
  });

  // Tag note for CRM trail
  const withNote: StoredTransaction = {
    ...tx,
    notes: [
      ...(tx.notes || []),
      `Opened from CRM contact ${contact.name} (${contact.id})`,
    ],
  };
  const saved = await upsertTransactionAsync(withNote);
  return { ...saved, reused: false };
}
