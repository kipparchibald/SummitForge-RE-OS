/**
 * Client-side campaign store (localStorage).
 * Server routes return campaign objects; UI persists history.
 */

import type { MarketingCampaign } from './types';

const KEY = 'sf_marketing_campaigns';

export function loadCampaigns(): MarketingCampaign[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MarketingCampaign[];
  } catch {
    return [];
  }
}

export function saveCampaigns(list: MarketingCampaign[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 40)));
}

export function upsertCampaign(campaign: MarketingCampaign) {
  const list = loadCampaigns();
  const i = list.findIndex((c) => c.id === campaign.id);
  if (i >= 0) list[i] = campaign;
  else list.unshift(campaign);
  saveCampaigns(list);
  return list;
}

export function getCampaign(id: string): MarketingCampaign | undefined {
  return loadCampaigns().find((c) => c.id === id);
}
