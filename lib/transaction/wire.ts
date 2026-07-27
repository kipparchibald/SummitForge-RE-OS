/**
 * Drop-in replacements for transaction page handlers.
 * Import these in app/transactions/page.tsx to get toasts + realtime emit.
 */

export {
  createTransactionWithToast as createNewTransaction,
  advanceTransactionWithToast as advanceTransaction,
} from '@/lib/transaction/actions';
