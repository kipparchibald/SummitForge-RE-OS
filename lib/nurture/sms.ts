/**
 * SMS outbox for nurture sequences (SMS-first).
 * Uses POST /api/nurture/send-sms — Twilio when env is set, else simulated.
 */

export type SmsOutboxItem = {
  id: string;
  to: string;
  body: string;
  contactId?: string;
  sequenceId?: string;
  stepIndex?: number;
  createdAt: string;
  status: 'queued' | 'sent' | 'failed' | 'simulated';
  error?: string;
};

const OUTBOX_KEY = 'sf_nurture_sms_outbox';

export function loadSmsOutbox(): SmsOutboxItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    return raw ? (JSON.parse(raw) as SmsOutboxItem[]) : [];
  } catch {
    return [];
  }
}

function saveOutbox(list: SmsOutboxItem[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(list.slice(0, 200)));
}

export async function queueNurtureSms(opts: {
  to: string;
  body: string;
  contactId?: string;
  sequenceId?: string;
  stepIndex?: number;
}): Promise<SmsOutboxItem> {
  const item: SmsOutboxItem = {
    id: `sms_${Date.now()}`,
    to: opts.to,
    body: opts.body,
    contactId: opts.contactId,
    sequenceId: opts.sequenceId,
    stepIndex: opts.stepIndex,
    createdAt: new Date().toISOString(),
    status: 'queued',
  };

  try {
    const res = await fetch('/api/nurture/send-sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: opts.to, body: opts.body }),
    });
    if (res.ok) {
      const data = await res.json();
      item.status = data.simulated ? 'simulated' : 'sent';
    } else {
      item.status = 'simulated';
      item.error = 'API unavailable — queued as simulated';
    }
  } catch {
    item.status = 'simulated';
    item.error = 'Offline / no Twilio — message held in outbox';
  }

  const all = loadSmsOutbox();
  all.unshift(item);
  saveOutbox(all);
  return item;
}
