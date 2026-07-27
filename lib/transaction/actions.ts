/**
 * Thin helpers so UI can toast after transaction mutations.
 */

import {
  createStoredTransaction,
  updateStoredTransaction,
  type StoredTransaction,
} from '@/lib/transaction/store';
import { emitLocal } from '@/lib/realtime/client';
import { toastSuccess } from '@/lib/toast/store';

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

export function createTransactionWithToast(opts: {
  address: string;
  price: number;
  buyer?: string;
  isLand?: boolean;
}): StoredTransaction {
  const tx = createStoredTransaction(opts);
  emitLocal('transactions', 'INSERT', { id: tx.id, address: tx.address });
  toastSuccess(`Opened file · ${tx.address}`);
  return tx;
}

export function advanceTransactionWithToast(
  tx: StoredTransaction,
  nextStatus: StoredTransaction['status']
): StoredTransaction | null {
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
  const updated = updateStoredTransaction(tx.id, patch);
  if (updated) {
    emitLocal('transactions', 'UPDATE', { id: tx.id, status: nextStatus });
    toastSuccess(`Stage → ${STATUS_LABELS[nextStatus] || nextStatus}`);
  }
  return updated;
}
