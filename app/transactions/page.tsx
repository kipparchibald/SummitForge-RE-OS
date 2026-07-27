'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { Transaction } from '@/lib/transaction/coordinator';
import {
  loadTransactions,
  toggleChecklistItem,
  type StoredTransaction,
} from '@/lib/transaction/store';
import {
  createTransactionWithToast,
  advanceTransactionWithToast,
} from '@/lib/transaction/actions';
import { dueDateIso, checklistForStage } from '@/lib/transaction/checklist';
import { TransactionCoordinator } from '@/lib/transaction/coordinator';
import StatusBadge, { transactionStageTone } from '@/components/ui/StatusBadge';
import SystemHealthStrip from '@/components/SystemHealthStrip';
import EmptyState from '@/components/ui/EmptyState';

const coordinator = new TransactionCoordinator();

const STATUS_FLOW: Transaction['status'][] = [
  'new', 'under_contract', 'inspection', 'appraisal', 'lending', 'title', 'closing', 'closed',
];

const STATUS_LABELS: Record<Transaction['status'], string> = {
  new: 'New',
  under_contract: 'Under Contract',
  inspection: 'Inspection',
  appraisal: 'Appraisal',
  lending: 'Lending',
  title: 'Title',
  closing: 'Closing',
  closed: 'Closed',
};

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<StoredTransaction[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [formResult, setFormResult] = useState<any>(null);
  const [newPrice, setNewPrice] = useState('450000');
  const [newAddress, setNewAddress] = useState('123 Example St, Rigby ID');
  const [buyer, setBuyer] = useState('');
  const [isLand, setIsLand] = useState(false);

  useEffect(() => {
    const list = loadTransactions();
    setTransactions(list);
    list.forEach((tx) => {
      try { (coordinator as any).transactions?.set?.(tx.id, tx); } catch { /* */ }
    });
  }, []);

  const selected = useMemo(
    () => transactions.find((t) => t.id === selectedId) || null,
    [transactions, selectedId]
  );

  const openCount = transactions.filter((t) => t.status !== 'closed').length;

  const createNew = () => {
    const tx = createTransactionWithToast({
      address: newAddress,
      price: Number(newPrice) || 0,
      buyer: buyer || undefined,
      isLand,
    });
    try { (coordinator as any).transactions?.set?.(tx.id, tx); } catch { /* */ }
    setTransactions(loadTransactions());
    setSelectedId(tx.id);
  };

  const advanceStatus = (tx: StoredTransaction) => {
    const idx = STATUS_FLOW.indexOf(tx.status);
    if (idx < 0 || idx >= STATUS_FLOW.length - 1) return;
    const updated = advanceTransactionWithToast(tx, STATUS_FLOW[idx + 1]);
    if (updated) {
      setTransactions(loadTransactions());
      setSelectedId(updated.id);
    }
  };

  const toggleItem = (itemId: string, done: boolean) => {
    if (!selected) return;
    toggleChecklistItem(selected.id, itemId, done);
    setTransactions(loadTransactions());
  };

  const generateForm = (formType: string) => {
    if (!selected) return;
    try { (coordinator as any).transactions?.set?.(selected.id, selected); } catch { /* */ }
    setFormResult(
      coordinator.generateIdahoForm(selected.id, formType, {
        address: selected.address || newAddress,
        buyerName: selected.buyer || buyer || 'Buyer',
        sellerName: selected.seller || 'Seller',
      })
    );
  };

  const visibleChecklist =
    selected?.checklist && selected.status
      ? checklistForStage(selected.checklist, selected.status)
      : selected?.checklist || [];
  const doneCount = (selected?.checklist || []).filter((c) => c.done).length;
  const totalCount = (selected?.checklist || []).length;

  return (
    <div className="min-h-[calc(100vh-60px)] bg-zinc-950 text-white">
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
        <SystemHealthStrip showLink={false} className="opacity-90" />
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Transaction Coordinator</h1>
            <p className="text-zinc-400 mt-1 text-sm sm:text-base">
              Idaho contingency checklist · forms · {openCount} open deals
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/crm" className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800">CRM</Link>
            <Link href="/forms" className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800">Forms library</Link>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-4">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 space-y-2">
              <div className="text-sm font-semibold text-zinc-200">Open new file</div>
              <input className="w-full border border-zinc-700 bg-zinc-950 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600" placeholder="Property address" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} />
              <input className="w-full border border-zinc-700 bg-zinc-950 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600" placeholder="Buyer name" value={buyer} onChange={(e) => setBuyer(e.target.value)} />
              <input className="w-full border border-zinc-700 bg-zinc-950 rounded-xl px-3 py-2 text-sm text-white placeholder:text-zinc-600" placeholder="Price" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input type="checkbox" checked={isLand} onChange={(e) => setIsLand(e.target.checked)} />
                Land / acreage (extra checklist)
              </label>
              <button type="button" onClick={createNew} className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-medium">+ Create transaction</button>
            </div>
            <div className="space-y-2 max-h-[520px] overflow-y-auto">
              {transactions.length === 0 ? (
                <EmptyState variant="dark" title="No open files yet" description="Create a transaction above to start the Idaho checklist and forms." className="py-8" />
              ) : (
                transactions.map((tx) => (
                  <button key={tx.id} type="button" onClick={() => { setSelectedId(tx.id); setFormResult(null); }}
                    className={`w-full text-left p-4 rounded-2xl border transition ${selectedId === tx.id ? 'border-emerald-600 bg-zinc-900' : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600'}`}>
                    <div className="font-medium text-sm truncate text-zinc-100">{tx.address || tx.propertyId}</div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <StatusBadge label={STATUS_LABELS[tx.status]} tone={transactionStageTone(tx.status)} size="sm" />
                      <span className="text-xs text-zinc-500">${tx.price.toLocaleString()}</span>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2">
            {!selected ? (
              <EmptyState variant="dark" title="Select or create a transaction" description="Open a file from the list or create one to manage checklist, stages, and Idaho forms." className="min-h-[280px] sm:min-h-[400px]" />
            ) : (
              <div className="bg-zinc-900 border border-zinc-800 rounded-3xl p-4 sm:p-6 space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-lg sm:text-xl font-semibold truncate">{selected.address || 'Transaction'}</h2>
                    <p className="text-sm text-zinc-400 mt-1">
                      ${selected.price.toLocaleString()}
                      {selected.buyer ? ` · Buyer: ${selected.buyer}` : ''}
                      {selected.effectiveDate ? ` · Effective ${selected.effectiveDate}` : ''}
                    </p>
                  </div>
                  <StatusBadge label={STATUS_LABELS[selected.status]} tone={transactionStageTone(selected.status)} />
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATUS_FLOW.map((s) => {
                    const active = s === selected.status;
                    const past = STATUS_FLOW.indexOf(s) < STATUS_FLOW.indexOf(selected.status);
                    return (
                      <span key={s} className={`text-[10px] px-2 py-1 rounded-full border ${active ? 'bg-emerald-600 text-white border-emerald-500' : past ? 'bg-emerald-950/50 text-emerald-400 border-emerald-900' : 'bg-zinc-950 text-zinc-500 border-zinc-800'}`}>
                        {STATUS_LABELS[s]}
                      </span>
                    );
                  })}
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={() => advanceStatus(selected)} disabled={selected.status === 'closed'} className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-500 disabled:opacity-40">Advance stage →</button>
                  {['RE-21', 'RE-24', 'RE-14', 'RE-16', 'RE-25', 'LeadPaint'].map((form) => (
                    <button key={form} type="button" onClick={() => generateForm(form)} className="px-3 py-2 border border-zinc-700 rounded-xl text-xs text-zinc-300 hover:bg-zinc-800">{form}</button>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-zinc-200">Idaho checklist</h3>
                    <span className="text-xs text-zinc-500">{doneCount}/{totalCount} complete</span>
                  </div>
                  <ul className="space-y-2">
                    {visibleChecklist.map((item) => (
                      <li key={item.id} className="flex items-start gap-3 rounded-xl border border-zinc-800 bg-zinc-950/80 px-3 py-2.5 text-sm">
                        <input type="checkbox" className="mt-1 accent-emerald-500" checked={!!item.done} onChange={(e) => toggleItem(item.id, e.target.checked)} />
                        <div className="min-w-0 flex-1">
                          <div className={item.done ? 'line-through text-zinc-500' : 'text-zinc-100'}>{item.title}</div>
                          <div className="text-[11px] text-zinc-500 mt-0.5">
                            {STATUS_LABELS[item.stage]} · {item.owner}
                            {item.dueDayOffset != null && selected.effectiveDate ? ` · due ~${dueDateIso(selected.effectiveDate, item.dueDayOffset)}` : item.dueDayOffset != null ? ` · day +${item.dueDayOffset}` : ''}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
                {formResult && (
                  <div className="rounded-2xl border border-sky-900 bg-sky-950/40 p-4 text-sm text-sky-100">
                    <div className="font-semibold text-xs uppercase tracking-wide text-sky-400 mb-2">Form generation</div>
                    <pre className="whitespace-pre-wrap text-xs overflow-auto max-h-48">{JSON.stringify(formResult, null, 2)}</pre>
                  </div>
                )}
                {selected.notes && selected.notes.length > 0 && (
                  <div>
                    <div className="text-sm font-medium text-zinc-300 mb-2">Notes</div>
                    <ul className="text-sm text-zinc-400 space-y-1">
                      {selected.notes.map((n, i) => (
                        <li key={i} className="border-l-2 border-zinc-700 pl-3">{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
