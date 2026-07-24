'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CRM_STAGES,
  advanceStage,
  createContact,
  loadContacts,
  saveContacts,
  type CrmContact,
  type CrmStage,
} from '@/lib/crm/store';

const money = (n?: number) =>
  n != null
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';

export default function CrmPage() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const [filter, setFilter] = useState<CrmStage | 'all'>('all');
  const [aiReply, setAiReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    interest: '',
    budget: '',
    areas: 'Rigby',
  });

  useEffect(() => {
    const list = loadContacts();
    setContacts(list);
  }, []);

  const persist = (list: CrmContact[]) => {
    setContacts(list);
    saveContacts(list);
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

  const openPipeline = contacts.filter(
    (c) => !['closed', 'lost'].includes(c.stage)
  ).length;

  const addContact = () => {
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
    const list = [c, ...contacts];
    persist(list);
    setSelected(c);
    setForm({ name: '', phone: '', email: '', interest: '', budget: '', areas: 'Rigby' });
  };

  const update = (id: string, patch: Partial<CrmContact>) => {
    const list = contacts.map((c) =>
      c.id === id ? { ...c, ...patch, updatedAt: new Date().toISOString() } : c
    );
    persist(list);
    const next = list.find((c) => c.id === id) || null;
    setSelected(next);
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
      update(c.id, {
        stage: c.stage === 'lead' ? 'qualified' : c.stage,
        score: Math.min(99, (c.score || 50) + 15),
        notes: [...c.notes, `AI qualify: ${String(msg).slice(0, 120)}`],
      });
    } catch {
      setAiReply('Lead agent unavailable — contact still saved.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <div className="page-header flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">CRM Pipeline</h1>
          <p className="text-gray-600 mt-1">
            Leads, nurture, and active buyers — linked to alerts, transactions, portal, and AI
            qualification.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/alerts" className="px-3 py-2 rounded-xl border hover:bg-gray-50">
            Property Alerts
          </Link>
          <Link href="/transactions" className="px-3 py-2 rounded-xl border hover:bg-gray-50">
            Transactions
          </Link>
          <Link href="/portal" className="px-3 py-2 rounded-xl border hover:bg-gray-50">
            Client Portal
          </Link>
          <Link
            href="/ai-assistants"
            className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
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
        <FilterChip active={filter === 'all'} onClick={() => setFilter('all')} label="All" count={contacts.length} />
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
              onClick={addContact}
              className="w-full py-2 bg-black text-white rounded-xl text-sm font-medium"
            >
              + Add to pipeline
            </button>
          </div>

          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {filtered.length === 0 && (
              <div className="text-center py-10 text-gray-400 border border-dashed rounded-2xl text-sm">
                No contacts in this stage
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
                    {c.score != null ? ` · score ${c.score}` : ''}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full min-h-[400px] flex items-center justify-center text-gray-400 border border-dashed rounded-3xl">
              Select a contact or add a new lead
            </div>
          ) : (
            <div className="bg-white border rounded-3xl p-6 shadow-sm space-y-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{selected.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {[selected.email, selected.phone].filter(Boolean).join(' · ') || 'No contact info'}
                  </p>
                </div>
                <span
                  className={`px-3 py-1 rounded-full text-xs font-medium ${
                    CRM_STAGES.find((s) => s.id === selected.stage)?.color
                  }`}
                >
                  {CRM_STAGES.find((s) => s.id === selected.stage)?.label}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <Info label="Budget" value={money(selected.budget)} />
                <Info label="Areas" value={selected.areas.join(', ') || '—'} />
                <Info label="Source" value={selected.source || '—'} />
                <Info label="Score" value={selected.score != null ? String(selected.score) : '—'} />
                <Info
                  label="Updated"
                  value={new Date(selected.updatedAt).toLocaleDateString()}
                />
                <Info label="Interest" value={selected.interest} />
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => qualifyWithAi(selected)}
                  className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-500 disabled:opacity-50"
                >
                  {busy ? 'Qualifying…' : 'AI qualify lead'}
                </button>
                <button
                  type="button"
                  onClick={() => update(selected.id, { stage: advanceStage(selected.stage) })}
                  className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-500"
                >
                  Advance stage →
                </button>
                <select
                  className="px-3 py-2 border rounded-xl text-sm"
                  value={selected.stage}
                  onChange={(e) => update(selected.id, { stage: e.target.value as CrmStage })}
                >
                  {CRM_STAGES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <Link
                  href="/cma"
                  className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50"
                >
                  Run CMA
                </Link>
                <Link
                  href="/development/plat"
                  className="px-4 py-2 border rounded-xl text-sm hover:bg-gray-50"
                >
                  AI Plat
                </Link>
              </div>

              {aiReply && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl text-sm text-blue-900 whitespace-pre-wrap">
                  {aiReply}
                </div>
              )}

              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Notes</div>
                {selected.notes.length === 0 ? (
                  <p className="text-sm text-gray-400">No notes yet</p>
                ) : (
                  <ul className="text-sm text-gray-600 space-y-1">
                    {selected.notes.map((n, i) => (
                      <li key={i} className="border-l-2 border-gray-200 pl-3">
                        {n}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? 'border-emerald-200 bg-emerald-50' : 'bg-white border-gray-200'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div className={`text-2xl font-semibold mt-0.5 ${accent ? 'text-emerald-900' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function FilterChip({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
        active ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
      }`}
    >
      {label} <span className="opacity-70">{count}</span>
    </button>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-medium text-gray-800 mt-0.5 break-words">{value}</div>
    </div>
  );
}
