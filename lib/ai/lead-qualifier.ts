import { callLLM, SYSTEM_PROMPTS } from './client';
import { scoreContact } from '@/lib/crm/predict-score';
import type { CrmContact } from '@/lib/crm/store';

export class LeadQualifier {
  async qualify(leadInfo: any) {
    const now = new Date().toISOString();
    const contact: CrmContact = {
      id: leadInfo?.id || 'tmp',
      name: leadInfo?.name || 'Lead',
      email: leadInfo?.email,
      phone: leadInfo?.phone,
      stage: leadInfo?.stage || 'lead',
      interest: leadInfo?.interest || '',
      budget: leadInfo?.budget,
      areas: leadInfo?.areas || (leadInfo?.area ? [leadInfo.area] : []),
      source: leadInfo?.source,
      notes: leadInfo?.notes || [],
      createdAt: leadInfo?.createdAt || now,
      updatedAt: leadInfo?.updatedAt || now,
    };
    const score = scoreContact(contact);
    const prompt = `Lead: ${JSON.stringify(leadInfo)}
Score ${score.total} (${score.band}). Sequence ${score.recommendedSequenceId}.
Write a one-sentence read, two pain points, and an SMS under 160 characters with STOP. Eastern Idaho voice. No hype.`;
    const aiResponse = await callLLM(SYSTEM_PROMPTS.lead || 'You are an expert real estate lead assistant for Eastern Idaho.', prompt);
    return {
      qualificationScore: score.total,
      band: score.band,
      recommendedSequenceId: score.recommendedSequenceId,
      breakdown: score,
      insights: aiResponse,
      recommendedActions: [`Enroll in ${score.recommendedSequenceId}`, score.band === 'hot' ? 'Call today' : 'Text first'],
      lastUpdated: now,
    };
  }
}

export const leadQualifier = new LeadQualifier();
