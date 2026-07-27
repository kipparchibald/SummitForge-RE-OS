'use client';

import React, { useEffect, useState } from 'react';
import {
  NURTURE_SEQUENCES,
  enrollContact,
  loadEnrollments,
  type NurtureEnrollment,
  renderTemplate,
} from '@/lib/nurture/sequences';
import { loadContacts, type CrmContact } from '@/lib/crm/store';
import { nurtureBrandContext } from '@/lib/nurture/brand';
import { queueNurtureSms } from '@/lib/nurture/sms';

/** MoxiWorks-style nurture enrollment + preview for agent CRM. */
export default function NurturePanel() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [enrollments, setEnrollments] = useState<NurtureEnrollment[]>([]);
  const [selectedContact, setSelectedContact] = useState('');
  const [selectedSeq, setSelectedSeq] = useState(NURTURE_SEQUENCES[0]?.id || '');
  const [toast, setToast] = useState('');

  useEffect(() => {
    setContacts(loadContacts());
    setEnrollments(loadEnrollments());
  }, []);

  const seq = NURTURE_SEQUENCES.find((s) => s.id === selectedSeq);
  const contact = contacts.find((c) => c.id === selectedContact);
  const brand = nurtureBrandContext();

  const onEnroll = async () => {
    if (!selectedContact || !selectedSeq || !seq) return;
    enrollContact(selectedContact, selectedSeq);
    setEnrollments(loadEnrollments());

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
      <div>
        <h3 className="font-semibold text-zinc-900">Automated nurture</h3>
        <p className="text-xs text-zinc-500 mt-0.5">SMS-first drips · {brand.brokerage}</p>
      </div>

      <label className="block text-xs text-zinc-500">
        Contact
        <select
          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
          value={selectedContact}
          onChange={(e) => setSelectedContact(e.target.value)}
        >
          <option value="">Select contact…</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} · {c.stage}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs text-zinc-500">
        Sequence
        <select
          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
          value={selectedSeq}
          onChange={(e) => setSelectedSeq(e.target.value)}
        >
          {NURTURE_SEQUENCES.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.steps.length} steps)
            </option>
          ))}
        </select>
      </label>

      {seq && (
        <div className="text-xs text-zinc-500 bg-zinc-50 rounded-xl p-3 border border-zinc-100">
          <div className="font-medium text-zinc-700 mb-1">{seq.description}</div>
          <ul className="space-y-1">
            {seq.steps.map((st, i) => (
              <li key={i}>
                Day {st.dayOffset} · {st.channel.toUpperCase()}
              </li>
            ))}
          </ul>
        </div>
      )}

      {preview && (
        <div className="text-sm bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-emerald-900">
          <div className="text-[10px] uppercase tracking-wide text-emerald-600 font-semibold mb-1">
            First message preview
          </div>
          {preview}
        </div>
      )}

      <button
        type="button"
        onClick={onEnroll}
        disabled={!selectedContact || !selectedSeq}
        className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 disabled:opacity-40"
      >
        Enroll in sequence
      </button>

      {enrollments.length > 0 && (
        <div className="pt-2 border-t text-xs text-zinc-500">
          <div className="font-medium text-zinc-700 mb-1">Active enrollments</div>
          {enrollments
            .filter((e) => e.status === 'active')
            .slice(0, 5)
            .map((e) => {
              const c = contacts.find((x) => x.id === e.contactId);
              const s = NURTURE_SEQUENCES.find((x) => x.id === e.sequenceId);
              return (
                <div key={e.id} className="flex justify-between gap-2 py-0.5">
                  <span className="truncate">{c?.name || e.contactId}</span>
                  <span className="shrink-0 text-zinc-400">{s?.name || e.sequenceId}</span>
                </div>
              );
            })}
        </div>
      )}

      {toast && <p className="text-xs text-emerald-600">{toast}</p>}
    </div>
  );
}
