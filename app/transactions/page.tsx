'use client';

import React, { useState, useEffect } from 'react';
import { TransactionCoordinator, type Transaction } from '@/lib/transaction/coordinator';

const coordinator = new TransactionCoordinator();

const STATUS_FLOW: Transaction['status'][] = [
  'new',
  'under_contract',
  'inspection',
  'appraisal',
  'lending',
  'title',
  'closing',
  'closed',
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
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selected, setSelected] = useState<Transaction | null>(null);
  const [formResult, setFormResult] = useState<any>(null);
  const [newPrice, setNewPrice] = useState('450000');
  const [newAddress, setNewAddress] = useState('123 Example St, Rigby ID');

  // Load from localStorage for demo persistence
  useEffect(() => {
    try {
      const raw = localStorage.getItem('sf_transactions');
      if (raw) {
        const list = JSON.parse(raw) as Transaction[];
        list.forEach(tx => {
          // rehydrate into coordinator
          (coordinator as any).transactions.set(tx.id, tx);
        });
        setTransactions(list);
      }
    } catch {}
  }, []);

  const persist = (list: Transaction[]) => {
    setTransactions(list);
    localStorage.setItem('sf_transactions', JSON.stringify(list));
  };

  const createNew = () => {
    const tx = coordinator.createTransaction('prop-' + Date.now(), Number(newPrice) || 0);
    tx.notes.push(`Property: ${newAddress}`);
    const list = [tx, ...transactions];
    persist(list);
    setSelected(tx);
  };

  const advanceStatus = (tx: Transaction) => {
    const idx = STATUS_FLOW.indexOf(tx.status);
    if (idx < STATUS_FLOW.length - 1) {
      const next = STATUS_FLOW[idx + 1];
      coordinator.updateStatus(tx.id, next);
      const updated = { ...tx, status: next };
      const list = transactions.map(t => (t.id === tx.id ? updated : t));
      persist(list);
      setSelected(updated);
    }
  };

  const generateForm = (formType: string) => {
    if (!selected) return;
    const result = coordinator.generateIdahoForm(selected.id, formType, {
      address: newAddress,
      buyerName: 'Buyer Name',
      sellerName: 'Seller Name',
    });
    setFormResult(result);
  };

  return (
    <div className="min-h-screen">
      <header className="bg-white border-b px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transaction Coordinator</h1>
          <p className="text-sm text-gray-500">Track deals, generate Idaho forms, AI-assisted workflow</p>
        </div>
        <button
          onClick={createNew}
          className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800"
        >
          + New Transaction
        </button>
      </header>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* List */}
        <div className="lg:col-span-1 space-y-3">
          <div className="bg-white border rounded-3xl p-4 space-y-3">
            <div className="text-sm font-medium text-gray-700">Quick Create</div>
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Address"
              value={newAddress}
              onChange={e => setNewAddress(e.target.value)}
            />
            <input
              className="w-full border rounded-xl px-3 py-2 text-sm"
              placeholder="Price"
              value={newPrice}
              onChange={e => setNewPrice(e.target.value)}
            />
          </div>

          {transactions.length === 0 && (
            <div className="text-center py-12 text-gray-400 border border-dashed rounded-3xl">
              No open transactions yet
            </div>
          )}

          {transactions.map(tx => (
            <button
              key={tx.id}
              onClick={() => setSelected(tx)}
              className={`w-full text-left p-4 rounded-2xl border transition ${
                selected?.id === tx.id
                  ? 'border-black bg-gray-50 shadow-sm'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="font-medium text-sm">{tx.notes[0] || tx.propertyId}</div>
              <div className="text-xs text-gray-500 mt-1">
                ${tx.price.toLocaleString()} • {STATUS_LABELS[tx.status]}
              </div>
            </button>
          ))}
        </div>

        {/* Detail */}
        <div className="lg:col-span-2">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-gray-400 border border-dashed rounded-3xl min-h-[400px]">
              Select or create a transaction
            </div>
          ) : (
            <div className="bg-white border rounded-3xl p-6 space-y-6 shadow-sm">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-xl font-semibold">{selected.notes[0] || selected.propertyId}</h2>
                  <p className="text-gray-500 text-sm mt-1">
                    ${selected.price.toLocaleString()} • ID: {selected.id}
                  </p>
                </div>
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                  {STATUS_LABELS[selected.status]}
                </span>
              </div>

              {/* Pipeline */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">Pipeline</div>
                <div className="flex flex-wrap gap-2">
                  {STATUS_FLOW.map((s, i) => {
                    const currentIdx = STATUS_FLOW.indexOf(selected.status);
                    const done = i <= currentIdx;
                    return (
                      <div
                        key={s}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium ${
                          done
                            ? 'bg-black text-white'
                            : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {STATUS_LABELS[s]}
                      </div>
                    );
                  })}
                </div>
                {selected.status !== 'closed' && (
                  <button
                    onClick={() => advanceStatus(selected)}
                    className="mt-4 px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700"
                  >
                    Advance to next stage →
                  </button>
                )}
              </div>

              {/* Idaho Forms */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-3">Generate Idaho Forms</div>
                <div className="flex flex-wrap gap-2">
                  {['RE-21', 'RE-24', 'RE-14', 'RE-16', 'RE-25', 'LeadPaint', 'RE-11', 'RE-13'].map(
                    form => (
                      <button
                        key={form}
                        onClick={() => generateForm(form)}
                        className="px-3 py-1.5 border rounded-xl text-xs hover:bg-gray-50"
                      >
                        {form}
                      </button>
                    )
                  )}
                  <button
                    onClick={() => generateForm('all')}
                    className="px-3 py-1.5 bg-black text-white rounded-xl text-xs"
                  >
                    All Critical
                  </button>
                </div>

                {formResult && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-2xl text-xs overflow-auto max-h-64">
                    <pre>{JSON.stringify(formResult, null, 2)}</pre>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div>
                <div className="text-sm font-medium text-gray-700 mb-2">Timeline</div>
                <div className="text-sm text-gray-600 space-y-1">
                  {selected.timeline.showingDate && (
                    <div>Showing: {new Date(selected.timeline.showingDate).toLocaleDateString()}</div>
                  )}
                  {selected.timeline.inspectionDate && (
                    <div>Inspection: {new Date(selected.timeline.inspectionDate).toLocaleDateString()}</div>
                  )}
                  {selected.timeline.closingDate && (
                    <div>Closing: {new Date(selected.timeline.closingDate).toLocaleDateString()}</div>
                  )}
                  {!selected.timeline.inspectionDate && !selected.timeline.closingDate && (
                    <div className="text-gray-400">No dates set yet — advance stages to auto-populate</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
