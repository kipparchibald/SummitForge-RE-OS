/**
 * Build per-contact intent context from existing client stores.
 */

import { getStoredMatches } from '@/lib/alerts/store';
import type { NurtureEnrollment } from '@/lib/nurture/sequences';
import type { ShowingRequest } from '@/lib/portal/matches';
import type { StoredTransaction } from '@/lib/transaction/store';
import { loadTransactions } from '@/lib/transaction/store';
import type { CrmContact } from './store';
import type { IntentContext } from './intent';

export type ContactContextBundle = {
  showings: ShowingRequest[];
  enrollments: NurtureEnrollment[];
  transactions: StoredTransaction[];
  alertMatchCount: number;
};

/** Desk-level alert matches in the last 7 days. */
export function recentAlertMatchCount(): number {
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  return getStoredMatches().filter((m) => new Date(m.matchedAt).getTime() >= cutoff).length;
}

export function buildContactContext(
  contact: CrmContact,
  opts: {
    showings?: ShowingRequest[];
    enrollments?: NurtureEnrollment[];
    transactions?: StoredTransaction[];
    alertMatchCount?: number;
  } = {}
): IntentContext {
  return {
    contact,
    showings: opts.showings,
    enrollments: opts.enrollments,
    transactions: opts.transactions ?? loadTransactions(),
    alertMatchCount: opts.alertMatchCount ?? recentAlertMatchCount(),
  };
}

export function contextBundleForAll(
  showings: ShowingRequest[],
  enrollments: NurtureEnrollment[]
): Omit<ContactContextBundle, 'transactions'> & { transactions: StoredTransaction[] } {
  return {
    showings,
    enrollments,
    transactions: loadTransactions(),
    alertMatchCount: recentAlertMatchCount(),
  };
}

/** Partial context for a single contact id (for maps in today queue). */
export function contextForContact(
  contactId: string,
  bundle: ContactContextBundle
): Omit<IntentContext, 'contact'> {
  return {
    showings: bundle.showings,
    enrollments: bundle.enrollments.filter((e) => e.contactId === contactId),
    transactions: bundle.transactions.filter((t) => t.contactId === contactId),
    alertMatchCount: bundle.alertMatchCount,
  };
}
