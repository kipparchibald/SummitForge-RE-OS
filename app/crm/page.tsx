'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  CRM_STAGES,
  advanceStage,
  createContact,
  type CrmContact,
  type CrmStage,
} from '@/lib/crm/store';
import {
  loadContactsAsync,
  saveContactsAsync,
  type CrmStorageMode,
} from '@/lib/crm/supabase-store';
import { openDealFromContactWithToast } from '@/lib/transaction/actions';
import NurturePanel from '@/components/crm/NurturePanel';
import ShowingInbox from '@/components/crm/ShowingInbox';
import {
  enrollContact,
  sequencesForStage,
  type NurtureSequence,
} from '@/lib/nurture/sequences';
import { toastSuccess, toastInfo } from '@/lib/toast/store';

const money = (n?: number) =>
  n != null
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';

export default function CrmPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const [filter, setFilter] = useState<CrmStage | 'all'>('all');
  const [aiReply, setAiReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [dealBusy, setDealBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storageMode, setStorageMode] = useState<CrmStorageMode>('local');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    interest: '',
    budget: '',
    areas: 'Rigby',
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { contacts: list, mode } = await loadContactsAsync();
      if (cancelled) return;
      setContacts(list);
      setStorageMode(mode);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (list: CrmContact[]) => {
    setContacts(list);
    const { mode, error } = await saveContactsAsync(list);
    setStorageMode(mode);
    if (error) {
      toastInfo('Saved on this device — cloud sync failed (check login / CRM schema)');
    }
  };

  const filtered = useMemo(
    () => (filter === 'all' ? contacts : contacts.filter((c) => c.stage === filter)),
    [contacts, filter]
  );

  const counts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const s of CRM_STAGES) m[s.id] = contacts.filter((c) => c.stage === s.id).length;
    return m;
  }, [contacts]);

  const openPipeline = contacts.filter((c) => !['closed', 'lost'].includes(c.stage)).length;

  const stageSequences: NurtureSequence[] = selected
    ? sequencesForStage(
        (['lead', 'qualified', 'nurture', 'active', 'under_contract', 'closed'].includes(
          selected.stage
        )
          ? selected.stage
          : 'lead') as NurtureSequence['triggerStage']
      )
    : [];

  const addContact = async () => {
    if (!form.name.trim()) return;
    const c = createContact({
      name: form.name.trim(),
      phone: form.phone || undefined,
      email: form.email || undefined,
      interest: form.interest || 'General inquiry',
      budget: form.budget ? Number(form.budget) : undefined,
      areas: form.areas.split(',').map((a) => a.trim()).filter(Boolean),
      stage: 'lead',
      source: 'Manual',
      score: 50,
    });
    await persist([c, ...contacts]);
    setSelected(c);
    setForm({ name: '', phone: '', email: '', interest: '', budget: '', areas: 'Rigby' });
    toastSuccess(`Lead added: ${c.name}`);
  };

  const update = async (id: string, patch: Partial<CrmContact>) => {
    const list = contacts.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
    );
    await persist(list);
    setSelected(list.find((c) => c.id === id) || null);
  };

  const enrollSelected = async (sequenceId: string) => {
    if (!selected) return;
    enrollContact(selected.id, sequenceId);
    const seqName = stageSequences.find((s) => s.id === sequenceId)?.name || sequenceId;
    await update(selected.id, {
      notes: [...selected.notes, `Enrolled in nurture: ${seqName}`],
      stage: selected.stage === 'lead' ? 'nurture' : selected.stage,
    });
    toastSuccess(`Enrolled ${selected.name} in “${seqName}”`);
  };

  const openDeal = async (c: CrmContact) => {
    setDealBusy(true);
    try {
      // Move pipeline toward under contract if still early
      if (['lead', 'qualified', 'nurture', 'active'].includes(c.stage)) {
        await update(c.id, {
          stage: 'under_contract',
          notes: [...c.notes, 'Opened transaction file from CRM'],
        });
      }
      const tx = await openDealFromContactWithToast(c);
      router.push(`/transactions?id=${encodeURIComponent(tx.id)}`);
    } finally {
      setDealBusy(false);
    }
  };

  const qualifyWithAi = async (c: CrmContact) => {
    setBusy(true);
    setAiReply('');
    try {
      const res = await fetch('/api/ai/lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leadInfo: {
            name: c.name,
            interest: c.interest,
            budget: c.budget,
            areas: c.areas,
            phone: c.phone,
            email: c.email,
          },
        }),
      });
      const data = await res.json();
      const msg =
        data.message ||
        data.qualification ||
        data.aiInsights ||
        JSON.stringify(data).slice(0, 400);
      setAiReply(typeof msg === 'string' ? msg : 'Lead reviewed.');
      await update(c.id, {
        stage: c.stage === 'lead' ? 'qualified' : c.stage,
        score: Math.min(99, (c.score || 50) + 15),
        notes: [...c.notes, `AI qualify: ${String(msg).slice(0, 120)}`],
      });
      toastSuccess(`${c.name} qualified`);
    } catch {
      setAiReply('Lead agent unavailable — contact still saved.');
      toastInfo('Lead agent unavailable — contact still saved');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-7xl mx-auto">
      <div className="page-header flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-6 mb-6 border-b border-neutral-900">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
            Pipeline
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight font-serif text-neutral-900">
            CRM
          </h1>
          <p className="text-neutral-500 mt-2 text-sm max-w-xl leading-relaxed">
            Leads, nurture, showings, and active buyers — open a deal when they go under contract.
          </p>
          <p className="text-[11px] text-neutral-400 mt-2">
            Storage:{' '}
            <span className={storageMode === 'cloud' ? 'text-emerald-700 font-medium' : ''}>
              {storageMode === 'cloud' ? 'Supabase (synced)' : 'This device (sign in for cloud sync)'}
            </span>
            {loading ? ' · loading…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/alerts"
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            Alerts
          </Link>
          <Link
            href="/transactions"
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            Transactions
          </Link>
          <Link
            href="/portal"
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            Portal
          </Link>
          <Link
            href="/ai-assistants"
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold bg-neutral-900 text-white hover:bg-black"
          >
            AI Assistants
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <Kpi label="Open pipeline" value={String(openPipeline)} />
        <Kpi label="Total contacts" value={String(contacts.length)} />
        <Kpi label="Active search" value={String(counts.active || 0)} accent />
        <Kpi label="Under contract" value={String(counts.under_contract || 0)} />
      </div>

      <div className="flex flex-wrap gap-1.5 mb-6">
        <FilterChip
          active={filter === 'all'}
          onClick={() => setFilter('all')}
          label="All"
          count={contacts.length}
        />
        {CRM_STAGES.map((s) => (
          <FilterChip
            key={s.id}
            active={filter === s.id}
            onClick={() => setFilter(s.id)}
            label={s.label}
            count={counts[s.id] || 0}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          <div className="bg-white border rounded-2xl p-4 space-y-2 shadow-sm">
            <div className="text-sm font-semibold">Add lead</div>
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            />
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Interest / needs"
              value={form.interest}
              onChange={(e) => setForm((f) => ({ ...f, interest: e.target.value }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="border rounded-xl px-3 py-2 text-sm"
                placeholder="Budget $"
                value={form.budget}
                onChange={(e) => setForm((f) => ({ ...f, budget: e.target.value }))}
              />
              <input
                className="border rounded-xl px-3 py-2 text-sm"
                placeholder="Areas"
                value={form.areas}
                onChange={(e) => setForm((f) => ({ ...f, areas: e.target.value }))}
              />
            </div>
            <button
              type="button"
              onClick={() => void addContact()}
              className="w-full py-2 bg-black text-white rounded-xl text-sm font-medium"
            >
              + Add to pipeline
            </button>
          </div>

          <ShowingInbox />
          <NurturePanel />

          <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-gray-400 border border-dashed rounded-2xl text-sm">
                {loading ? 'Loading pipeline…' : 'No contacts in this stage'}
              </div>
            )}
            {filtered.map((c) => {
              const stageMeta = CRM_STAGES.find((s) => s.id === c.stage);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelected(c);
                    setAiReply('');
                  }}
                  className={`w-full text-left p-4 rounded-2xl border transition ${
                    selected?.id === c.id
                      ? 'border-black bg-gray-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm">{c.name}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${stageMeta?.color}`}>
                      {stageMeta?.label}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1 line-clamp-2">{c.interest}</div>
                  <div className="text-[11px] text-gray-400 mt-1">
                    {money(c.budget)} · {c.areas.join(', ')}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="border border-dashed rounded-2xl p-12 text-center text-gray-400 text-sm">
              Select a contact to manage stage, notes, AI qualify, and open a deal.
            </div>
          ) : (
            <div className="bg-white border rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-serif font-medium text-neutral-900">
                    {selected.name}
                  </h2>
                  <p className="text-sm text-neutral-500 mt-1">{selected.interest}</p>
                  <p className="text-xs text-neutral-400 mt-2">
                    {selected.phone || 'No phone'}
                    {selected.email ? ` · ${selected.email}` : ''}
                    {selected.source ? ` · ${selected.source}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void qualifyWithAi(selected)}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-neutral-900 text-white rounded-lg disabled:opacity-50"
                  >
                    {busy ? 'Qualifying…' : 'AI Qualify'}
                  </button>
                  <button
                    type="button"
                    disabled={dealBusy}
                    onClick={() => void openDeal(selected)}
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wider bg-emerald-700 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {dealBusy ? 'Opening…' : 'Open deal'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void update(selected.id, { stage: advanceStage(selected.stage) })
                    }
                    className="px-3 py-2 text-xs font-semibold uppercase tracking-wider border border-neutral-300 rounded-lg"
                  >
                    Advance stage
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {CRM_STAGES.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => void update(selected.id, { stage: s.id })}
                    className={`text-[11px] px-2.5 py-1 rounded-full border ${
                      selected.stage === s.id
                        ? 'border-black bg-black text-white'
                        : 'border-neutral-200 text-neutral-600 hover:border-neutral-400'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {aiReply && (
                <div className="rounded-xl bg-neutral-50 border border-neutral-200 p-3 text-sm text-neutral-700 whitespace-pre-wrap">
                  {aiReply}
                </div>
              )}

              {stageSequences.length > 0 && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                    Enroll nurture
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {stageSequences.map((seq) => (
                      <button
                        key={seq.id}
                        type="button"
                        onClick={() => void enrollSelected(seq.id)}
                        className="px-3 py-1.5 text-xs border border-neutral-300 rounded-lg hover:border-neutral-900"
                      >
                        {seq.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-2">
                  Notes
                </div>
                <ul className="space-y-1.5 text-sm text-neutral-600">
                  {selected.notes.length === 0 && (
                    <li className="text-neutral-400">No notes yet</li>
                  )}
                  {selected.notes.map((n, i) => (
                    <li key={i} className="border-l-2 border-neutral-200 pl-3">
                      {n}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? 'border-emerald-200 bg-emerald-50/50' : 'border-neutral-200 bg-white'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-neutral-500 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-medium mt-1 tabular-nums">{value}</div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 rounded-full border transition ${
        active
          ? 'bg-neutral-900 text-white border-neutral-900'
          : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-400'
      }`}
    >
      {label}
      <span className={`ml-1.5 tabular-nums ${active ? 'text-neutral-300' : 'text-neutral-400'}`}>
        {count}
      </span>
    </button>
  );
}
