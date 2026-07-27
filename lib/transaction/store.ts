/**
 * Persistent transaction store (localStorage) with checklist support.
 */

import type { Transaction } from './coordinator';
import { buildResidentialChecklist, type ChecklistItem } from './checklist';

const KEY = 'sf_transactions_v2';

export type StoredTransaction = Transaction & {
  address?: string;
  effectiveDate?: string;
  checklist?: ChecklistItem[];
  isLand?: boolean;
  isNewConstruction?: boolean;
};

export function loadTransactions(): StoredTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StoredTransaction[];
    // migrate legacy key
    const legacy = localStorage.getItem('sf_transactions');
    if (legacy) {
      const list = JSON.parse(legacy) as StoredTransaction[];
      saveTransactions(list);
      return list;
    }
    return [];
  } catch {
    return [];
  }
}

export function saveTransactions(list: StoredTransaction[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function createStoredTransaction(opts: {
  address: string;
  price: number;
  buyer?: string;
  seller?: string;
  isLand?: boolean;
  isNewConstruction?: boolean;
}): StoredTransaction {
  const effectiveDate = new Date().toISOString().slice(0, 10);
  const tx: StoredTransaction = {
    id: `tx_${Date.now()}`,
    propertyId: `prop_${Date.now()}`,
    status: 'new',
    price: opts.price,
    buyer: opts.buyer,
    seller: opts.seller,
    address: opts.address,
    effectiveDate,
    timeline: {},
    documents: [],
    notes: [`Opened ${effectiveDate} · ${opts.address}`],
    isLand: opts.isLand,
    isNewConstruction: opts.isNewConstruction,
    checklist: buildResidentialChecklist({
      effectiveDate,
      isLand: opts.isLand,
      isNewConstruction: opts.isNewConstruction,
    }),
  };
  const all = loadTransactions();
  all.unshift(tx);
  saveTransactions(all);
  return tx;
}

export function updateStoredTransaction(
  id: string,
  patch: Partial<StoredTransaction>
): StoredTransaction | null {
  const all = loadTransactions();
  const i = all.findIndex((t) => t.id === id);
  if (i < 0) return null;
  all[i] = { ...all[i], ...patch };
  saveTransactions(all);
  return all[i];
}

export function toggleChecklistItem(
  txId: string,
  itemId: string,
  done: boolean
): StoredTransaction | null {
  const all = loadTransactions();
  const i = all.findIndex((t) => t.id === txId);
  if (i < 0) return null;
  const checklist = (all[i].checklist || []).map((c) =>
    c.id === itemId ? { ...c, done } : c
  );
  all[i] = { ...all[i], checklist };
  saveTransactions(all);
  return all[i];
}
