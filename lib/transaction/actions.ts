/**
 * UI helpers for transaction mutations + toasts.
 * Prefer async helpers so cloud dual-store can sync.
 */

import type { StoredTransaction } from '@/lib/transaction/store';
import {
  createTransactionAsync,
  updateTransactionAsync,
  openDealFromContactAsync,
} from '@/lib/transaction/supabase-store';
import { emitLocal } from '@/lib/realtime/client';
import { toastSuccess, toastInfo } from '@/lib/toast/store';
import type { CrmContact } from '@/lib/crm/store';

const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  under_contract: 'Under Contract',
  inspection: 'Inspection',
  appraisal: 'Appraisal',
  lending: 'Lending',
  title: 'Title',
  closing: 'Closing',
  closed: 'Closed',
};

export async function createTransactionWithToast(opts: {
  address: string;
  price: number;
  buyer?: string;
  isLand?: boolean;
  contactId?: string;
}): Promise<StoredTransaction> {
  const { tx, mode } = await createTransactionAsync(opts);
  emitLocal('transactions', 'INSERT', { id: tx.id, address: tx.address });
  toastSuccess(
    mode === 'cloud'
      ? `Opened file · ${tx.address} (synced)`
      : `Opened file · ${tx.address}`
  );
  return tx;
}

export async function advanceTransactionWithToast(
  tx: StoredTransaction,
  nextStatus: StoredTransaction['status']
): Promise<StoredTransaction | null> {
  const patch: Partial<StoredTransaction> = {
    status: nextStatus,
    notes: [...(tx.notes || []), `Advanced to ${STATUS_LABELS[nextStatus] || nextStatus}`],
  };
  if (nextStatus === 'under_contract' && !tx.effectiveDate) {
    patch.effectiveDate = new Date().toISOString().slice(0, 10);
  }
  if (nextStatus === 'inspection') {
    patch.timeline = {
      ...tx.timeline,
      inspectionDate: new Date(Date.now() + 10 * 86400000).toISOString().slice(0, 10),
    };
  }
  const { tx: updated } = await updateTransactionAsync(tx.id, patch);
  if (updated) {
    emitLocal('transactions', 'UPDATE', { id: tx.id, status: nextStatus });
    toastSuccess(`Stage → ${STATUS_LABELS[nextStatus] || nextStatus}`);
  }
  return updated;
}

/** CRM → Transaction Coordinator handoff */
export async function openDealFromContactWithToast(
  contact: CrmContact
): Promise<StoredTransaction> {
  const { tx, mode, reused } = await openDealFromContactAsync(contact);
  if (reused) {
    toastInfo(`Opened existing file · ${tx.address || tx.id}`);
  } else {
    toastSuccess(
      mode === 'cloud'
        ? `Deal opened for ${contact.name} (synced)`
        : `Deal opened for ${contact.name}`
    );
  }
  emitLocal('transactions', reused ? 'UPDATE' : 'INSERT', { id: tx.id, contactId: contact.id });
  return tx;
}
