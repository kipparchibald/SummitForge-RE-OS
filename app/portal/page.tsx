'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ClientPortal() {
  const [deal, setDeal] = useState({
    address: 'Lot 7 - Teton Heights',
    stage: 'Under Contract',
    tasks: [
      { id: 1, title: 'Earnest Money Deposited', done: true },
      { id: 2, title: 'Title Search Initiated', done: true },
      { id: 3, title: 'Septic Design Review', done: false },
      { id: 4, title: 'Final Plat Approval', done: false },
    ]
  });

  const toggleTask = (id: number) => {
    setDeal(prev => ({
      ...prev,
      tasks: prev.tasks.map(t => t.id === id ? { ...t, done: !t.done } : t)
    }));
  };

  return (
    <div className="max-w-4xl mx-auto p-8">
      <div className="page-header">
        <h1>Client Portal</h1>
        <p>Your private view of the Teton Heights transaction. Fully white-label ready for your brokerage.</p>
      </div>

      <div className="bg-white border rounded-2xl p-8">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className="text-sm text-gray-500">Property</div>
            <div className="text-2xl font-semibold">{deal.address}</div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Current Stage</div>
            <div className="text-xl font-semibold text-green-600">{deal.stage}</div>
          </div>
        </div>

        <div>
          <h3 className="font-semibold mb-4">Transaction Checklist</h3>
          <div className="space-y-3">
            {deal.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input 
                  type="checkbox" 
                  checked={task.done} 
                  onChange={() => toggleTask(task.id)}
                  className="w-5 h-5"
                />
                <span className={task.done ? 'line-through text-gray-500' : ''}>{task.title}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-8 pt-6 border-t text-sm text-gray-500">
          Documents and updates will appear here. Use the AI Assistants (Council or Transaction) for instant timeline answers.
        </div>
      </div>

      <div className="mt-6 flex gap-4 text-xs">
        <Link href="/ai-assistants" className="underline">Ask AI about this deal →</Link>
        <Link href="/settings/branding" className="underline">Apply your branding to this portal →</Link>
      </div>
      <p className="text-xs text-center text-gray-400 mt-6">Prototype of the branded client portal. In production: authenticated per-client views + document vault + notifications.</p>
    </div>
  );
}
