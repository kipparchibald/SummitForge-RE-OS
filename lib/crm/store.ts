/**
 * Lightweight agent CRM store (localStorage).
 * Pipeline stages cover lead → closed for Archibald-Bagley style ops.
 */

export type CrmStage =
  | 'lead'
  | 'qualified'
  | 'nurture'
  | 'active'
  | 'under_contract'
  | 'closed'
  | 'lost';

export type CrmContact = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  stage: CrmStage;
  interest: string;
  budget?: number;
  areas: string[];
  source?: string;
  notes: string[];
  createdAt: string;
  updatedAt: string;
  score?: number;
};

const KEY = 'sf_crm_contacts';

export const CRM_STAGES: { id: CrmStage; label: string; color: string }[] = [
  { id: 'lead', label: 'New Lead', color: 'bg-slate-100 text-slate-700' },
  { id: 'qualified', label: 'Qualified', color: 'bg-blue-100 text-blue-800' },
  { id: 'nurture', label: 'Nurture', color: 'bg-amber-100 text-amber-800' },
  { id: 'active', label: 'Active Search', color: 'bg-emerald-100 text-emerald-800' },
  { id: 'under_contract', label: 'Under Contract', color: 'bg-purple-100 text-purple-800' },
  { id: 'closed', label: 'Closed', color: 'bg-green-100 text-green-800' },
  { id: 'lost', label: 'Lost', color: 'bg-rose-100 text-rose-700' },
];

export const DEMO_CONTACTS: CrmContact[] = [
  {
    id: 'crm_demo_1',
    name: 'Jordan & Taylor Mitchell',
    email: 'mitchell.family@example.com',
    phone: '(208) 555-0142',
    stage: 'active',
    interest: 'Single-level home, Rigby/Ririe under $525k',
    budget: 525000,
    areas: ['Rigby', 'Ririe'],
    source: 'Portal',
    notes: ['Prefers ADA-friendly layout', 'Financing pre-approved'],
    createdAt: '2026-07-01T12:00:00.000Z',
    updatedAt: '2026-07-20T12:00:00.000Z',
    score: 88,
  },
  {
    id: 'crm_demo_2',
    name: 'Alex Rivera',
    email: 'alex.builder@example.com',
    phone: '(208) 555-0199',
    stage: 'qualified',
    interest: '5–20 acre raw land for small subdivision',
    budget: 900000,
    areas: ['Rigby', 'Jefferson'],
    source: 'AI Lead Agent',
    notes: ['Builder — wants plat concept before offer'],
    createdAt: '2026-07-10T12:00:00.000Z',
    updatedAt: '2026-07-18T12:00:00.000Z',
    score: 92,
  },
  {
    id: 'crm_demo_3',
    name: 'Sam Chen',
    phone: '(208) 555-0110',
    stage: 'lead',
    interest: 'Looking for acreage near Rexburg for investment',
    budget: 400000,
    areas: ['Rexburg', 'Sugar City'],
    source: 'Web form',
    notes: [],
    createdAt: '2026-07-22T12:00:00.000Z',
    updatedAt: '2026-07-22T12:00:00.000Z',
    score: 61,
  },
];

export function loadContacts(): CrmContact[] {
  if (typeof window === 'undefined') return DEMO_CONTACTS;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) {
      localStorage.setItem(KEY, JSON.stringify(DEMO_CONTACTS));
      return DEMO_CONTACTS;
    }
    return JSON.parse(raw) as CrmContact[];
  } catch {
    return DEMO_CONTACTS;
  }
}

export function saveContacts(list: CrmContact[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function createContact(
  partial: Omit<CrmContact, 'id' | 'createdAt' | 'updatedAt' | 'notes'> & { notes?: string[] }
): CrmContact {
  const now = new Date().toISOString();
  return {
    ...partial,
    notes: partial.notes || [],
    id: `crm_${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
}

export function advanceStage(stage: CrmStage): CrmStage {
  const order: CrmStage[] = ['lead', 'qualified', 'nurture', 'active', 'under_contract', 'closed'];
  const i = order.indexOf(stage);
  if (i < 0 || i >= order.length - 1) return stage;
  return order[i + 1];
}
