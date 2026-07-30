'use client';

import React, { useEffect, useState } from 'react';
import {
  NURTURE_SEQUENCES,
  enrollContact,
  loadEnrollments,
  type NurtureEnrollment,
  renderTemplate,
} from '@/lib/nurture/sequences';
import { type CrmContact } from '@/lib/crm/store';
import { loadContactsAsync, loadEnrollmentsAsync } from '@/lib/crm/supabase-store';
import { nurtureBrandContext } from '@/lib/nurture/brand';
import { queueNurtureSms } from '@/lib/nurture/sms';

/** MoxiWorks-style nurture enrollment + preview for agent CRM. */
export default function NurturePanel() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [enrollments, setEnrollments] = useState<NurtureEnrollment[]>([]);
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedSeq, setSelectedSeq] = useState(NURTURE_SEQUENCES[0]?.id || '');
  const [toast, setToast] = useState('');
  const [mode, setMode] = useState<'cloud' | 'local'>('local');

  useEffect(() => {
    void loadContactsAsync().then(({ contacts: list }) => setContacts(list));
    void loadEnrollmentsAsync().then(({ enrollments: list, mode: m }) => {
      setEnrollments(list);
      setMode(m);
    });
  }, []);

  const seq = NURTURE_SEQUENCES.find((s) => s.id === selectedSeq);
  const contact = contacts.find((c) => c.id === selectedContact);
  const brand = nurtureBrandContext();

  const onEnroll = async () => {
    if (!selectedContact || !selectedSeq || !seq) return;
    enrollContact(selectedContact, selectedSeq);
    const { enrollments: list, mode: m } = await loadEnrollmentsAsync();
    setEnrollments(list.length ? list : loadEnrollments());
    setMode(m);

    const step0 = seq.steps[0];
    if (step0?.channel === 'sms' && contact?.phone) {
      const body = renderTemplate(step0.body, {
        name: contact.name,
        agent: brand.agent,
        area: contact.areas?.[0] || 'Eastern Idaho',
        budget: contact.budget,
        interest: contact.interest,
      });
      try {
        const sms = await queueNurtureSms({
          to: contact.phone,
          body,
          contactId: contact.id,
          sequenceId: seq.id,
          stepIndex: 0,
        });
        setToast(
          `Enrolled ${contact.name} · first SMS ${sms.status === 'sent' ? 'sent' : 'queued (simulated)'}`
        );
      } catch {
        setToast(`Enrolled ${contact.name} in “${seq.name}”`);
      }
    } else {
      setToast(`Enrolled ${contact?.name || 'contact'} in “${seq.name}”`);
    }
    setTimeout(() => setToast(''), 4000);
  };

  const preview =
    seq && contact
      ? renderTemplate(seq.steps[0]?.body || '', {
          name: contact.name,
          agent: brand.agent,
          area: contact.areas?.[0] || 'Eastern Idaho',
          budget: contact.budget,
          interest: contact.interest,
        })
      : '';

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-zinc-900">Nurture sequences</div>
          <p className="text-xs text-zinc-500 mt-0.5">
            SMS-first drips · {mode === 'cloud' ? 'cloud synced' : 'this device'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select
          className="border rounded-xl px-3 py-2 text-sm"
          value={selectedContact}
          onChange={(e) => setSelectedContact(e.target.value)}
        >
          <option value="">Select contact…</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          className="border rounded-xl px-3 py-2 text-sm"
          value={selectedSeq}
          onChange={(e) => setSelectedSeq(e.target.value)}
        >
          {NURTURE_SEQUENCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      {preview && (
        <div className="text-xs bg-zinc-50 border rounded-xl p-3 text-zinc-600">
          <div className="font-semibold text-zinc-500 mb-1">First touch preview</div>
          {preview}
        </div>
      )}

      <button
        type="button"
        onClick={onEnroll}
        disabled={!selectedContact || !selectedSeq}
        className="w-full sm:w-auto px-4 py-2 text-sm font-semibold bg-zinc-900 text-white rounded-xl disabled:opacity-50"
      >
        Enroll contact
      </button>

      {toast && (
        <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2">
          {toast}
        </div>
      )}

      {enrollments.length > 0 && (
        <div className="border-t pt-3">
          <div className="text-[10px] uppercase tracking-wider text-zinc-400 font-semibold mb-2">
            Active enrollments
          </div>
          <ul className="space-y-1.5 max-h-36 overflow-y-auto">
            {enrollments
              .filter((e) => e.status === 'active')
              .slice(0, 12)
              .map((e) => {
                const c = contacts.find((x) => x.id === e.contactId);
                const s = NURTURE_SEQUENCES.find((x) => x.id === e.sequenceId);
                return (
                  <li key={e.id} className="text-xs text-zinc-600 flex justify-between gap-2">
                    <span>
                      {c?.name || e.contactId} · {s?.name || e.sequenceId}
                    </span>
                    <span className="text-zinc-400">step {e.nextStepIndex + 1}</span>
                  </li>
                );
              })}
          </ul>
        </div>
      )}
    </div>
  );
}
