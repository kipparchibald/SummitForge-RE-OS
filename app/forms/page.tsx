'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  createIdahoFormsEngine,
  type PopulatedForm,
} from '@/lib/forms/idaho-forms';

const DEMO_TX = {
  agreementDate: new Date().toLocaleDateString(),
  purchasePrice: 489000,
  earnestMoney: 5000,
  closingDate: '2026-08-15',
  financingType: 'Conventional',
  inspectionDays: '10',
  listPrice: 499000,
  commission: '3%',
  propertyType: 'Residential',
  buyerBrokerCompensation: 'As per offer',
  addendumText: '',
  counterOfferChanges: '',
  counterExpiration: '',
  completionDate: '',
  capRate: '',
  noi: '',
};

const DEMO_PROPERTY = {
  address: '789 Lindy Lane',
  city: 'Rigby',
  county: 'Jefferson',
  zip: '83442',
  legalDescription: 'Lot 12, Block 3, Eagles Rest Subdivision',
  acres: '',
  zoning: 'R-1',
  yearBuilt: 2019,
  wellSeptic: 'N/A',
  access: 'Public road',
  lotNumber: '12',
  subdivision: 'Eagles Rest',
  knownDefects: 'None disclosed',
  exemptionReason: '',
  annexationStatus: 'Not in city impact area',
  cityServices: 'No',
  consentToAnnex: 'No',
  knownLeadHazards: 'No known lead-based paint hazards',
  leadRecords: 'No reports available',
};

const DEMO_BUYER = { name: 'Jordan Mitchell' };
const DEMO_SELLER = { name: 'Summit Forge Seller LLC' };
const DEMO_AGENT = {
  name: 'Kipp Archibald',
  brokerage: 'Archibald-Bagley Real Estate',
};

export default function FormsPage() {
  const [forms, setForms] = useState<PopulatedForm[]>([]);
  const [selected, setSelected] = useState<PopulatedForm | null>(null);
  const [signatureStep, setSignatureStep] = useState<'idle' | 'review' | 'signed'>('idle');
  const [signerName, setSignerName] = useState('');

  const generateAll = () => {
    const engine = createIdahoFormsEngine(
      DEMO_TX,
      DEMO_PROPERTY,
      DEMO_BUYER,
      DEMO_SELLER,
      DEMO_AGENT
    );
    const all = engine.generateAllCriticalForms();
    setForms(all);
    setSelected(all[0] || null);
    setSignatureStep('idle');
  };

  const startSign = () => {
    if (!selected) return;
    setSignatureStep('review');
  };

  const completeSign = () => {
    if (!signerName.trim()) return;
    setSignatureStep('signed');
  };

  return (
    <div className="min-h-screen bg-[var(--sf-bg,#f9fafb)]">
      <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Idaho Forms & E-Sign
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Auto-populate official IAR forms · simulate Form Simplicity / DocuSign flow
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={generateAll}
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800"
          >
            Populate all critical forms
          </button>
          <Link
            href="/transactions"
            className="px-4 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50"
          >
            Transactions
          </Link>
        </div>
      </header>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900">Forms ready for this deal</h2>
          {forms.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-8 text-center text-sm text-gray-500">
              Click Populate all critical forms to auto-fill RE-21, RE-24, RE-14, RE-16, disclosures, addenda, and more from transaction data.
            </div>
          ) : (
            forms.map((f) => (
              <button
                key={f.formCode}
                onClick={() => {
                  setSelected(f);
                  setSignatureStep('idle');
                }}
                className={`w-full text-left p-4 rounded-2xl border transition ${
                  selected?.formCode === f.formCode
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div className="font-medium text-gray-900">{f.formCode}</div>
                <div className="text-xs text-gray-500 mt-0.5">{f.formName}</div>
                {f.notes && (
                  <div className="text-[11px] text-emerald-600 mt-1">{f.notes}</div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          {selected ? (
            <>
              <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900">
                      {selected.formCode} — {selected.formName}
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">
                      PDF-ready · Export: {selected.exportFormat.toUpperCase()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={startSign}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl hover:bg-emerald-700"
                    >
                      Send for signature
                    </button>
                    <button className="px-4 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50">
                      Download PDF
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                  {Object.entries(selected.populatedFields).map(([key, value]) => (
                    <div
                      key={key}
                      className="bg-gray-50 rounded-xl px-3 py-2 text-sm"
                    >
                      <div className="text-[10px] uppercase tracking-wide text-gray-400">
                        {key}
                      </div>
                      <div className="font-medium text-gray-800 break-words">
                        {String(value ?? '—')}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {signatureStep !== 'idle' && (
                <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl">
                  <h3 className="font-semibold mb-2">E-Signature simulation</h3>
                  <p className="text-sm text-slate-300 mb-4">
                    Mirrors Form Simplicity / DocuSign handoff. Agent reviews then client signs.
                  </p>

                  {signatureStep === 'review' && (
                    <div className="space-y-4">
                      <p className="text-sm">
                        Document: <strong>{selected.formCode}</strong> ready for{' '}
                        {DEMO_BUYER.name}
                      </p>
                      <input
                        type="text"
                        placeholder="Type full legal name to sign"
                        value={signerName}
                        onChange={(e) => setSignerName(e.target.value)}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400"
                      />
                      <button
                        onClick={completeSign}
                        disabled={!signerName.trim()}
                        className="px-6 py-3 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-40 rounded-xl font-medium"
                      >
                        Apply electronic signature
                      </button>
                    </div>
                  )}

                  {signatureStep === 'signed' && (
                    <div className="space-y-2">
                      <p className="text-emerald-300 font-medium">
                        Signed by {signerName}
                      </p>
                      <p className="text-sm text-slate-300">
                        Timestamp: {new Date().toLocaleString()} · Audit trail saved.
                      </p>
                      <p className="text-xs text-slate-500">
                        Next: wire real Form Simplicity or DocuSign API when credentials are available.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="bg-white border border-dashed border-gray-300 rounded-3xl p-16 text-center text-gray-500">
              Select a form or generate the full set to preview auto-populated fields.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
