import type { CrmContact } from '@/lib/crm/store';
import { scoreContact, type ScoreBreakdown } from '@/lib/crm/predict-score';

export function isNoelWired(): boolean {
  return Boolean(process.env.NOEL_API_URL && process.env.NOEL_API_KEY);
}

/** Local score until Noel is wired. Do not call an unknown host. */
export async function scoreWithNoelOrLocal(contact: CrmContact): Promise<ScoreBreakdown & { source: 'noel' | 'local' }> {
  return { ...scoreContact(contact), source: 'local' };
}
