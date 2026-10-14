import type { CrmContact } from '@/lib/crm/store';
import { scoreContact, type ScoreBreakdown } from '@/lib/crm/predict-score';
import { enrollContact, getSequence, type NurtureEnrollment } from '@/lib/nurture/sequences';
import { PREDICTIVE_SEQUENCES } from '@/lib/nurture/sequences-extra';
import { scoreWithNoelOrLocal } from '@/lib/nurture/noel';

export async function recommendAndEnroll(contact: CrmContact, opts?: { sequenceId?: string }): Promise<{ enrollment: NurtureEnrollment; score: ScoreBreakdown; source: 'noel' | 'local' }> {
  const scored = await scoreWithNoelOrLocal(contact);
  let sequenceId = opts?.sequenceId || scored.recommendedSequenceId;
  if (!getSequence(sequenceId) && !PREDICTIVE_SEQUENCES.some((s) => s.id === sequenceId)) {
    sequenceId = 'new-lead-welcome';
  }
  const enrollment = enrollContact(contact.id, sequenceId);
  return { enrollment, score: scored, source: scored.source };
}
