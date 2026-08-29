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
  deleteContactAsync,
  loadContactsAsync,
  migrateLocalCrmToCloud,
  saveContactsAsync,
  type CrmStorageMode,
} from '@/lib/crm/supabase-store';
import { isBrowserSupabaseConfigured } from '@/lib/auth/browser';
import { openDealFromContactWithToast } from '@/lib/transaction/actions';
import NurturePanel from '@/components/crm/NurturePanel';
import ShowingInbox from '@/components/crm/ShowingInbox';
import Contact360 from '@/components/crm/Contact360';
import {
  enrollContact,
  sequencesForStage,
  type NurtureSequence,
} from '@/lib/nurture/sequences';
import {
  loadEnrollmentsAsync,
  loadShowingsAsync,
} from '@/lib/crm/supabase-store';
import { contextBundleForAll } from '@/lib/crm/intent-context';
import { recordTouch, refreshAllContactIntent } from '@/lib/crm/intent';
import { loadTransactions } from '@/lib/transaction/store';
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
  const [syncing, setSyncing] = useState(false);
  const [storageMode, setStorageMode] = useState<CrmStorageMode>('local');
  const [cloudReady, setCloudReady] = useState(false);
  const [showings, setShowings] = useState<import('@/lib/portal/matches').ShowingRequest[]>([]);
  const [enrollments, setEnrollments] = useState<import('@/lib/nurture/sequences').NurtureEnrollment[]>([]);
  const [transactions, setTransactions] = useState(loadTransactions());
  const [form, setForm] = useState({
    name: '',
    phone: '',
    email: '',
    interest: '',
    budget: '',
    areas: 'Rigby',
  });

  useEffect(() => {
    setCloudReady(isBrowserSupabaseConfigured());
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [{ contacts: list, mode }, showRes, enrollRes] = await Promise.all([
        loadContactsAsync(),
        loadShowingsAsync(),
        loadEnrollmentsAsync(),
      ]);
      if (cancelled) return;
      const bundle = contextBundleForAll(showRes.showings, enrollRes.enrollments);
      const scored = refreshAllContactIntent(list, bundle);
      setContacts(scored);
      setShowings(showRes.showings);
      setEnrollments(enrollRes.enrollments);
      setTransactions(bundle.transactions);
      setStorageMode(mode);
      setLoading(false);
      if (typeof window !== 'undefined') {
        const pick = sessionStorage.getItem('sf_crm_select');
        if (pick) {
          sessionStorage.removeItem('sf_crm_select');
          const found = scored.find((c) => c.id === pick);
          if (found) setSelected(found);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persist = async (list: CrmContact[]) => {
    const bundle = contextBundleForAll(showings, enrollments);
    const scored = refreshAllContactIntent(list, bundle);
    setContacts(scored);
    const { mode, error } = await saveContactsAsync(scored);
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
    const merged = contacts.map((c) => {
      if (c.id !== id) return c;
      const next = { ...c, ...patch, updatedAt: new Date().toISOString() };
      if (patch.notes || patch.stage) {
        return recordTouch(next);
      }
      return next;
    });
    await persist(merged);
    setSelected(merged.find((c) => c.id === id) || null);
  };

  const removeContact = async (id: string) => {
    if (!confirm('Delete this contact from the pipeline?')) return;
    const mode = await deleteContactAsync(id);
    const list = contacts.filter((c) => c.id !== id);
    setContacts(list);
    setSelected(null);
    setStorageMode(mode);
    toastSuccess('Contact removed');
  };

  const syncToCloud = async () => {
    setSyncing(true);
    try {
      const result = await migrateLocalCrmToCloud();
      setStorageMode(result.mode);
      if (result.error) {
        toastInfo(result.error);
      } else if (result.mode === 'cloud') {
        toastSuccess(`Synced ${result.contacts} contacts to Supabase`);
        const { contacts: list, mode } = await loadContactsAsync();
        setContacts(list);
        setStorageMode(mode);
      } else {
        toastInfo('Sign in with Supabase to enable cloud CRM (see /login)');
      }
    } finally {
      setSyncing(false);
    }
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
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                storageMode === 'cloud'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  storageMode === 'cloud' ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {storageMode === 'cloud' ? 'Supabase · brokerage synced' : 'This device only'}
              {loading ? ' · loading…' : ''}
            </span>
            {cloudReady && storageMode === 'local' && (
              <button
                type="button"
                onClick={syncToCloud}
                disabled={syncing}
                className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border border-slate-300 hover:border-slate-900 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync device → cloud'}
              </button>
            )}
            {!cloudReady && (
              <Link
                href="/setup"
                className="text-[11px] text-slate-500 underline underline-offset-2"
              >
                Configure Supabase for multi-device CRM
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link
            href="/today"
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-orange-300 text-orange-800 hover:border-orange-500"
          >
            Today
          </Link>
          <Link
            href="/inbox"
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            Inbox
          </Link>
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
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Phone"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Interest"
              value={form.interest}
              onChange={(e) => setForm({ ...form, interest: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm"
                placeholder="Budget"
                value={form.budget}
                onChange={(e) => setForm({ ...form, budget: e.target.value })}
              />
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm"
                placeholder="Areas"
                value={form.areas}
                onChange={(e) => setForm({ ...form, areas: e.target.value })}
              />
            </div>
            <button
              type="button"
              onClick={addContact}
              className="w-full btn-primary py-2 rounded-xl text-sm font-semibold"
            >
              Add to pipeline
            </button>
          </div>

          <div className="space-y-2 max-h-[560px] overflow-y-auto pr-1">
            {filtered.map((c) => {
              const stage = CRM_STAGES.find((s) => s.id === c.stage);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setSelected(c)}
                  className={`w-full text-left bg-white border rounded-2xl p-3 shadow-sm hover:border-slate-400 transition ${
                    selected?.id === c.id ? 'ring-2 ring-slate-900 border-slate-900' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="font-medium text-sm text-slate-900">{c.name}</div>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stage?.color || ''}`}
                    >
                      {stage?.label || c.stage}
                    </span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1 line-clamp-2">{c.interest}</div>
                  <div className="text-[11px] text-slate-400 mt-1.5 flex gap-2">
                    <span>{money(c.budget)}</span>
                    <span>·</span>
                    <span>{c.areas.join(', ') || '—'}</span>
                    {c.score != null && (
                      <>
                        <span>·</span>
                        <span className={c.score >= 70 ? 'text-orange-600 font-semibold' : ''}>
                          {c.score}
                        </span>
                      </>
                    )}
                  </div>
                </button>
              );
            })}
            {!loading && filtered.length === 0 && (
              <div className="text-sm text-slate-400 text-center py-8">No contacts in this stage</div>
            )}
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <ShowingInbox />

          {selected ? (
            <div className="space-y-4">
              <Contact360
                contact={selected}
                showings={showings}
                enrollments={enrollments}
                transactions={transactions}
                onTouch={async () => {
                  const touched = recordTouch(selected, 'Logged touch from Contact 360');
                  await update(selected.id, touched);
                  toastSuccess('Touch logged — back on your radar');
                }}
                onOpenDraft={() => {
                  router.push(`/inbox?contact=${encodeURIComponent(selected.id)}`);
                }}
              />

              <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      update(selected.id, { stage: advanceStage(selected.stage) })
                    }
                    className="px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-slate-50"
                  >
                    Advance stage
                  </button>
                  <button
                    type="button"
                    onClick={() => qualifyWithAi(selected)}
                    disabled={busy}
                    className="px-3 py-1.5 text-xs font-semibold border rounded-lg hover:bg-slate-50 disabled:opacity-50"
                  >
                    {busy ? 'AI…' : 'AI qualify'}
                  </button>
                  <button
                    type="button"
                    onClick={() => openDeal(selected)}
                    disabled={dealBusy}
                    className="px-3 py-1.5 text-xs font-semibold bg-slate-900 text-white rounded-lg hover:bg-black disabled:opacity-50"
                  >
                    {dealBusy ? 'Opening…' : 'Open deal'}
                  </button>
                  <button
                    type="button"
                    onClick={() => removeContact(selected.id)}
                    className="px-3 py-1.5 text-xs font-semibold border border-rose-200 text-rose-700 rounded-lg hover:bg-rose-50"
                  >
                    Delete
                  </button>
                </div>

                {aiReply && (
                  <div className="text-sm bg-slate-50 border rounded-xl p-3 text-slate-700">
                    {aiReply}
                  </div>
                )}

                <div>
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                    Notes
                  </div>
                  <ul className="space-y-1.5">
                    {selected.notes.length === 0 && (
                      <li className="text-sm text-slate-400">No notes yet</li>
                    )}
                    {selected.notes.map((n, i) => (
                      <li key={i} className="text-sm text-slate-600 border-l-2 border-slate-200 pl-3">
                        {n}
                      </li>
                    ))}
                  </ul>
                </div>

                {stageSequences.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                      Enroll in nurture
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {stageSequences.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => enrollSelected(s.id)}
                          className="px-3 py-1.5 text-xs font-medium border rounded-lg hover:border-slate-900"
                          title={s.description}
                        >
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white border rounded-2xl p-10 text-center text-slate-400 text-sm shadow-sm">
              Select a contact to qualify, nurture, or open a deal
            </div>
          )}

          <NurturePanel />
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
      className={`rounded-2xl border p-4 shadow-sm ${
        accent ? 'bg-emerald-50/50 border-emerald-100' : 'bg-white'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">
        {label}
      </div>
      <div className="text-2xl font-semibold tracking-tight mt-1 text-slate-900">{value}</div>
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
      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
        active
          ? 'bg-slate-900 text-white border-slate-900'
          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
      }`}
    >
      {label}
      <span className={`ml-1.5 ${active ? 'text-slate-300' : 'text-slate-400'}`}>{count}</span>
    </button>
  );
}
