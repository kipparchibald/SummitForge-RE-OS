'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { PopulatedForm } from '@/lib/forms/idaho-forms';
import {
  type CoverLetterDefaults,
  type CoverLetterDeal,
  type FinancingType,
  type PropertyKind,
  DEFAULT_COVER_DEFAULTS,
  createBlankDeal,
  formsForPropertyKind,
  loadDefaults,
  loadDeal,
  mergeCoverLetter,
  populateFormsFromCoverLetter,
  renderCoverLetterText,
  saveDeal,
  saveDefaults,
} from '@/lib/forms/cover-letter';
import {
  type FormSimplicityRoom,
  FS_STATUS_LABEL,
  createFormSimplicityRoom,
  exportHandoffJson,
  formSimplicityPortalUrl,
  loadRooms,
  openFormSimplicityPortal,
  saveRoom,
  sendFormSimplicityRoom,
  signAsRecipient,
} from '@/lib/forms/form-simplicity';

const money = (n: number) =>
  n
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
    : '—';

const FORM_OPTIONS = [
  { code: 'RE-21', label: 'RE-21 Purchase (residential)' },
  { code: 'RE-24', label: 'RE-24 Vacant land PSA' },
  { code: 'RE-22', label: 'RE-22 New construction' },
  { code: 'RE-23', label: 'RE-23 Commercial' },
  { code: 'RE-14', label: 'RE-14 Buyer representation' },
  { code: 'RE-16', label: 'RE-16 Seller representation' },
  { code: 'RE-25', label: 'RE-25 Seller disclosure' },
  { code: 'RE-25A', label: 'RE-25A Disclosure exempt' },
  { code: 'RE-26', label: 'RE-26 New construction disclosure' },
  { code: 'LeadPaint', label: 'Lead-based paint' },
  { code: 'RE-11', label: 'RE-11 Addendum' },
  { code: 'RE-13', label: 'RE-13 Counter offer' },
];

type Tab = 'cover' | 'defaults' | 'forms' | 'sign';

const DEMO_DEAL_PATCH: Partial<CoverLetterDeal> = {
  buyerName: 'Jordan Mitchell',
  buyerEmail: 'jordan.mitchell@example.com',
  buyerPhone: '(208) 555-0142',
  sellerName: 'Demo Seller LLC',
  sellerEmail: 'seller@example.com',
  propertyKind: 'Residential',
  address: '789 Lindy Lane',
  city: 'Rigby',
  county: 'Jefferson',
  zip: '83442',
  legalDescription: 'Lot 12, Block 3, Eagles Rest Subdivision, Jefferson County, Idaho',
  purchasePrice: 489000,
  listPrice: 499000,
  earnestMoney: 5000,
  financingType: 'Conventional',
  financingDetails: 'Buyer to obtain conventional financing; loan contingency applies.',
  inspectionDays: 10,
  coverNotes: 'Demo deal — replace with live transaction details.',
};

export default function FormsPage() {
  const [tab, setTab] = useState<Tab>('cover');
  const [defaults, setDefaults] = useState<CoverLetterDefaults>(DEFAULT_COVER_DEFAULTS);
  const [deal, setDeal] = useState<CoverLetterDeal>(() => createBlankDeal());
  const [forms, setForms] = useState<PopulatedForm[]>([]);
  const [selected, setSelected] = useState<PopulatedForm | null>(null);
  const [room, setRoom] = useState<FormSimplicityRoom | null>(null);
  const [rooms, setRooms] = useState<FormSimplicityRoom[]>([]);
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);
  const [signMessage, setSignMessage] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const d = loadDefaults();
    setDefaults(d);
    const saved = loadDeal();
    if (saved) setDeal(saved);
    else setDeal(createBlankDeal(d));
    setRooms(loadRooms());
    setHydrated(true);
  }, []);

  const cl = useMemo(() => mergeCoverLetter(defaults, deal), [defaults, deal]);
  const coverText = useMemo(() => renderCoverLetterText(cl), [cl]);

  const patchDeal = useCallback((patch: Partial<CoverLetterDeal>) => {
    setDeal((prev) => {
      const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
      saveDeal(next);
      return next;
    });
  }, []);

  const patchDefaults = useCallback((patch: Partial<CoverLetterDefaults>) => {
    setDefaults((prev) => {
      const next = { ...prev, ...patch };
      saveDefaults(next);
      return next;
    });
  }, []);

  const loadDemo = () => {
    const d = loadDefaults();
    const blank = createBlankDeal(d);
    const next = {
      ...blank,
      ...DEMO_DEAL_PATCH,
      formCodes: formsForPropertyKind(DEMO_DEAL_PATCH.propertyKind || 'Residential'),
      contingencies: d.standardContingencies,
      titleCompany: d.defaultTitleCompany,
      earnestHeldBy: d.defaultTitleCompany,
    };
    setDeal(next);
    saveDeal(next);
    setStatus('Demo deal loaded — edit any field, then Populate forms.');
    setTab('cover');
  };

  const applyKindForms = (kind: PropertyKind) => {
    patchDeal({ propertyKind: kind, formCodes: formsForPropertyKind(kind) });
  };

  const populate = () => {
    if (!deal.address && !deal.buyerName) {
      setStatus('Add at least a property address or buyer name on the cover letter.');
      return;
    }
    const populated = populateFormsFromCoverLetter(cl);
    setForms(populated);
    setSelected(populated[0] || null);
    patchDeal({ status: 'forms_ready' });
    setTab('forms');
    setStatus(`Populated ${populated.length} documents from cover letter (incl. cover).`);
  };

  /** Open Form Simplicity–style transaction room from cover letter + forms */
  const prepareSign = () => {
    if (forms.length === 0) {
      if (!deal.address && !deal.buyerName) {
        setStatus('Fill the cover letter first, then open the e-sign room.');
        return;
      }
      const populated = populateFormsFromCoverLetter(cl);
      setForms(populated);
    }
    const codes = forms.length
      ? forms.map((f) => f.formCode).filter((c) => c !== 'COVER')
      : deal.formCodes;
    const nextRoom = createFormSimplicityRoom(cl, codes, {
      message: signMessage || undefined,
    });
    setRoom(nextRoom);
    setRooms(loadRooms());
    setSignMessage(nextRoom.package.message);
    setTab('sign');
    setStatus(
      'Form Simplicity–style room ready. Send in-app links or open official Form Simplicity.'
    );
  };

  const sendPackage = async () => {
    if (!room) return;
    if (room.recipients.length === 0) {
      setStatus('Add buyer/seller emails on the cover letter so recipients can be invited.');
      return;
    }
    setBusy(true);
    try {
      const withMsg: FormSimplicityRoom = {
        ...room,
        package: { ...room.package, message: signMessage || room.package.message },
      };
      const sent = await sendFormSimplicityRoom(withMsg);
      setRoom(sent);
      setRooms(loadRooms());
      patchDeal({ status: 'sent_for_signature' });
      setStatus(
        `Out for signature · ${sent.recipients.length} recipient(s) · Form Simplicity–style links ready.`
      );
    } finally {
      setBusy(false);
    }
  };

  const demoSign = (role: FormSimplicityRoom['recipients'][0]['role']) => {
    if (!room) return;
    const next = signAsRecipient(room, role);
    setRoom(next);
    setRooms(loadRooms());
    if (next.status === 'completed') {
      patchDeal({ status: 'fully_signed' });
      setStatus(
        next.package.certificateOfAuthenticity
          ? `All parties signed · COA ${next.package.certificateOfAuthenticity.id} issued.`
          : 'All parties signed.'
      );
    } else {
      patchDeal({ status: 'partially_signed' });
      setStatus(`Partial: ${role.replace(/_/g, ' ')} signed. Waiting on others.`);
    }
  };

  const copyCoa = async () => {
    const text = room?.package.certificateOfAuthenticity?.fullText;
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setStatus('Certificate of Authenticity copied to clipboard.');
    } catch {
      setStatus('Could not copy COA — select text in the preview.');
    }
  };

  const printCoa = () => {
    const coa = room?.package.certificateOfAuthenticity;
    if (!coa?.fullText) return;
    const w = window.open('', '_blank', 'noopener,noreferrer');
    if (!w) {
      setStatus('Pop-up blocked — allow pop-ups to print the COA.');
      return;
    }
    w.document.write(
      `<!DOCTYPE html><html><head><title>COA ${coa.id}</title>` +
        `<style>body{font-family:ui-monospace,Menlo,monospace;font-size:11px;padding:24px;white-space:pre-wrap;}</style>` +
        `</head><body></body></html>`
    );
    w.document.body.textContent = coa.fullText;
    w.document.close();
    w.focus();
    w.print();
  };

  const copyHandoff = async () => {
    if (!room) return;
    try {
      await navigator.clipboard.writeText(exportHandoffJson(room));
      setStatus('Form Simplicity handoff JSON copied — paste into notes or an import tool.');
    } catch {
      setStatus('Could not copy handoff JSON.');
    }
  };

  const launchFs = () => {
    openFormSimplicityPortal(room || undefined);
    setStatus(
      `Opened Form Simplicity portal (${formSimplicityPortalUrl()}). Prepare in Voxli → finish legal e-sign there when preferred.`
    );
  };

  const copyCover = async () => {
    try {
      await navigator.clipboard.writeText(coverText);
      setStatus('Cover letter copied to clipboard.');
    } catch {
      setStatus('Could not copy — select text in the preview.');
    }
  };

  const newDeal = () => {
    const blank = createBlankDeal(defaults);
    setDeal(blank);
    saveDeal(blank);
    setForms([]);
    setSelected(null);
    setRoom(null);
    setStatus('New blank deal — defaults (agent, title, contingencies) carried over.');
    setTab('cover');
  };

  if (!hydrated) {
    return (
      <div className="p-8 text-sm text-gray-500">Loading cover letter…</div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--sf-bg,#f9fafb)]">
      <header className="bg-white border-b border-gray-200 px-4 sm:px-8 py-5">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 max-w-7xl mx-auto">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              Idaho Forms · Cover Letter → Form Simplicity E-Sign
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Prepare cover letter &amp; packet here · mirror Form Simplicity room · link out for
              official IAR signing
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadDemo}
              className="px-3 py-2 text-sm border rounded-xl hover:bg-gray-50"
            >
              Load demo deal
            </button>
            <button
              type="button"
              onClick={newDeal}
              className="px-3 py-2 text-sm border rounded-xl hover:bg-gray-50"
            >
              New deal
            </button>
            <button
              type="button"
              onClick={populate}
              className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800"
            >
              Populate forms
            </button>
            <button
              type="button"
              onClick={prepareSign}
              className="px-4 py-2 bg-emerald-600 text-white text-sm font-medium rounded-xl hover:bg-emerald-500"
            >
              Send for signature
            </button>
            <Link
              href="/transactions"
              className="px-3 py-2 border text-sm rounded-xl hover:bg-gray-50"
            >
              Transactions
            </Link>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-4 flex flex-wrap gap-1">
          {(
            [
              ['cover', '1. Cover letter'],
              ['defaults', '2. My defaults'],
              ['forms', '3. Forms tray'],
              ['sign', '4. Form Simplicity room'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                tab === id
                  ? 'bg-gray-900 text-white border-gray-900'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {label}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-gray-400 self-center capitalize">
            Deal status: {deal.status.replace(/_/g, ' ')}
          </span>
        </div>
      </header>

      {status && (
        <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-4">
          <div className="text-sm px-4 py-2.5 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-900">
            {status}
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto p-4 sm:p-8">
        {/* ─── COVER LETTER ─── */}
        {tab === 'cover' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
            <div className="xl:col-span-3 space-y-6">
              {/* Deal-specific: money & terms */}
              <Section title="Deal-specific terms" hint="Usually change every transaction">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Purchase price $"
                    type="number"
                    value={deal.purchasePrice || ''}
                    onChange={(v) => patchDeal({ purchasePrice: Number(v) || 0 })}
                  />
                  <Field
                    label="List price $ (optional)"
                    type="number"
                    value={deal.listPrice || ''}
                    onChange={(v) => patchDeal({ listPrice: v ? Number(v) : undefined })}
                  />
                  <Field
                    label="Earnest money $"
                    type="number"
                    value={deal.earnestMoney || ''}
                    onChange={(v) => patchDeal({ earnestMoney: Number(v) || 0 })}
                  />
                  <Field
                    label="Earnest held by"
                    value={deal.earnestHeldBy}
                    onChange={(v) => patchDeal({ earnestHeldBy: v })}
                  />
                  <Field
                    label="Closing date"
                    type="date"
                    value={deal.closingDate}
                    onChange={(v) => patchDeal({ closingDate: v })}
                  />
                  <Field
                    label="Agreement / offer date"
                    type="date"
                    value={deal.agreementDate}
                    onChange={(v) => patchDeal({ agreementDate: v })}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <label className="block text-xs text-gray-500">
                    Financing type
                    <select
                      className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                      value={deal.financingType}
                      onChange={(e) =>
                        patchDeal({ financingType: e.target.value as FinancingType })
                      }
                    >
                      {(
                        [
                          'Conventional',
                          'FHA',
                          'VA',
                          'USDA',
                          'Cash',
                          'Seller finance',
                          'Other',
                        ] as FinancingType[]
                      ).map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="Loan amount $ (optional)"
                    type="number"
                    value={deal.loanAmount || ''}
                    onChange={(v) => patchDeal({ loanAmount: v ? Number(v) : undefined })}
                  />
                  <Field
                    label="Inspection days"
                    type="number"
                    value={deal.inspectionDays}
                    onChange={(v) => patchDeal({ inspectionDays: Number(v) || 0 })}
                  />
                  <Field
                    label="Inspection deadline (optional)"
                    type="date"
                    value={deal.inspectionDeadline || ''}
                    onChange={(v) => patchDeal({ inspectionDeadline: v || undefined })}
                  />
                </div>
                <label className="block text-xs text-gray-500 mt-3">
                  Financing details
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[60px]"
                    value={deal.financingDetails || ''}
                    onChange={(e) => patchDeal({ financingDetails: e.target.value })}
                    placeholder="e.g. Conventional 30-yr; pre-approved with…"
                  />
                </label>
                <label className="block text-xs text-gray-500 mt-3">
                  Contingencies
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[88px]"
                    value={deal.contingencies}
                    onChange={(e) => patchDeal({ contingencies: e.target.value })}
                  />
                </label>
                <label className="block text-xs text-gray-500 mt-3">
                  Additional terms (optional)
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[60px]"
                    value={deal.additionalTerms || ''}
                    onChange={(e) => patchDeal({ additionalTerms: e.target.value })}
                  />
                </label>
              </Section>

              <Section title="Title company" hint="Often same default; override per deal">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Title company"
                    value={deal.titleCompany}
                    onChange={(v) => patchDeal({ titleCompany: v, earnestHeldBy: deal.earnestHeldBy || v })}
                  />
                  <Field
                    label="Title officer"
                    value={deal.titleOfficer || ''}
                    onChange={(v) => patchDeal({ titleOfficer: v })}
                  />
                  <Field
                    label="Title email"
                    value={deal.titleEmail || ''}
                    onChange={(v) => patchDeal({ titleEmail: v })}
                  />
                  <Field
                    label="Title phone"
                    value={deal.titlePhone || ''}
                    onChange={(v) => patchDeal({ titlePhone: v })}
                  />
                </div>
              </Section>

              <Section title="Property & legal" hint="Legal description is critical">
                <label className="block text-xs text-gray-500 mb-3">
                  Property type
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                    value={deal.propertyKind}
                    onChange={(e) => applyKindForms(e.target.value as PropertyKind)}
                  >
                    {(
                      ['Residential', 'Vacant Land', 'New Construction', 'Commercial'] as PropertyKind[]
                    ).map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Street address"
                  value={deal.address}
                  onChange={(v) => patchDeal({ address: v })}
                />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                  <Field label="City" value={deal.city} onChange={(v) => patchDeal({ city: v })} />
                  <Field
                    label="County"
                    value={deal.county}
                    onChange={(v) => patchDeal({ county: v })}
                  />
                  <Field label="State" value={deal.state} onChange={(v) => patchDeal({ state: v })} />
                  <Field label="ZIP" value={deal.zip} onChange={(v) => patchDeal({ zip: v })} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
                  <Field
                    label="Acres (land)"
                    value={deal.acres || ''}
                    onChange={(v) => patchDeal({ acres: v })}
                  />
                  <Field
                    label="APN / parcel"
                    value={deal.parcelOrApn || ''}
                    onChange={(v) => patchDeal({ parcelOrApn: v })}
                  />
                  <Field
                    label="Subdivision / lot"
                    value={deal.subdivision || deal.lotNumber || ''}
                    onChange={(v) => patchDeal({ subdivision: v })}
                  />
                </div>
                <label className="block text-xs text-gray-500 mt-3">
                  Legal description
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[80px] font-mono"
                    value={deal.legalDescription}
                    onChange={(e) => patchDeal({ legalDescription: e.target.value })}
                    placeholder="Lot __, Block __, ____ Subdivision, ____ County, Idaho…"
                  />
                </label>
              </Section>

              <Section title="Parties" hint="Emails required to send for e-sign">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 border">
                    <div className="text-xs font-semibold text-slate-600">Buyer</div>
                    <Field
                      label="Name"
                      value={deal.buyerName}
                      onChange={(v) => patchDeal({ buyerName: v })}
                    />
                    <Field
                      label="Email"
                      value={deal.buyerEmail}
                      onChange={(v) => patchDeal({ buyerEmail: v })}
                    />
                    <Field
                      label="Phone"
                      value={deal.buyerPhone || ''}
                      onChange={(v) => patchDeal({ buyerPhone: v })}
                    />
                  </div>
                  <div className="space-y-2 p-3 rounded-xl bg-slate-50 border">
                    <div className="text-xs font-semibold text-slate-600">Seller</div>
                    <Field
                      label="Name"
                      value={deal.sellerName}
                      onChange={(v) => patchDeal({ sellerName: v })}
                    />
                    <Field
                      label="Email"
                      value={deal.sellerEmail}
                      onChange={(v) => patchDeal({ sellerEmail: v })}
                    />
                    <Field
                      label="Phone"
                      value={deal.sellerPhone || ''}
                      onChange={(v) => patchDeal({ sellerPhone: v })}
                    />
                  </div>
                </div>
              </Section>

              <Section title="Forms in packet">
                <div className="flex flex-wrap gap-2">
                  {FORM_OPTIONS.map((f) => {
                    const on = deal.formCodes.includes(f.code);
                    return (
                      <button
                        key={f.code}
                        type="button"
                        onClick={() => {
                          const codes = on
                            ? deal.formCodes.filter((c) => c !== f.code)
                            : [...deal.formCodes, f.code];
                          patchDeal({ formCodes: codes });
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] border ${
                          on
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-600 border-gray-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    );
                  })}
                </div>
                <label className="block text-xs text-gray-500 mt-3">
                  Agent notes (cover only)
                  <textarea
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[60px]"
                    value={deal.coverNotes || ''}
                    onChange={(e) => patchDeal({ coverNotes: e.target.value })}
                  />
                </label>
              </Section>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={populate}
                  className="px-5 py-2.5 bg-black text-white text-sm font-semibold rounded-xl"
                >
                  Populate forms from cover letter →
                </button>
                <button
                  type="button"
                  onClick={prepareSign}
                  className="px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-xl"
                >
                  Prepare e-sign package
                </button>
              </div>
            </div>

            {/* Live cover preview */}
            <div className="xl:col-span-2">
              <div className="sticky top-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="font-semibold text-gray-900">Cover letter preview</h2>
                  <button
                    type="button"
                    onClick={copyCover}
                    className="text-xs px-3 py-1.5 border rounded-lg hover:bg-gray-50"
                  >
                    Copy text
                  </button>
                </div>
                <pre className="bg-white border rounded-2xl p-5 text-[11px] leading-relaxed text-gray-700 whitespace-pre-wrap font-mono max-h-[70vh] overflow-auto shadow-sm">
                  {coverText}
                </pre>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <Stat label="Price" value={money(deal.purchasePrice)} />
                  <Stat label="Earnest" value={money(deal.earnestMoney)} />
                  <Stat label="Close" value={deal.closingDate || '—'} />
                  <Stat label="Inspect" value={`${deal.inspectionDays}d`} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ─── DEFAULTS ─── */}
        {tab === 'defaults' && (
          <div className="max-w-2xl space-y-6">
            <p className="text-sm text-gray-600">
              These stick across deals. Edit once — new deals inherit title company, earnest default,
              inspection days, contingency boilerplate, and your agent info.
            </p>
            <Section title="Agent & brokerage">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Agent name"
                  value={defaults.agentName}
                  onChange={(v) => patchDefaults({ agentName: v })}
                />
                <Field
                  label="License #"
                  value={defaults.agentLicense || ''}
                  onChange={(v) => patchDefaults({ agentLicense: v })}
                />
                <Field
                  label="Email"
                  value={defaults.agentEmail}
                  onChange={(v) => patchDefaults({ agentEmail: v })}
                />
                <Field
                  label="Phone"
                  value={defaults.agentPhone}
                  onChange={(v) => patchDefaults({ agentPhone: v })}
                />
                <Field
                  label="Brokerage"
                  value={defaults.brokerage}
                  onChange={(v) => patchDefaults({ brokerage: v })}
                />
                <Field
                  label="Brokerage address"
                  value={defaults.brokerageAddress || ''}
                  onChange={(v) => patchDefaults({ brokerageAddress: v })}
                />
              </div>
            </Section>
            <Section title="Usual deal settings">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Field
                  label="Default title company"
                  value={defaults.defaultTitleCompany}
                  onChange={(v) => patchDefaults({ defaultTitleCompany: v })}
                />
                <Field
                  label="Default earnest $"
                  type="number"
                  value={defaults.defaultEarnestMoney}
                  onChange={(v) => patchDefaults({ defaultEarnestMoney: Number(v) || 0 })}
                />
                <Field
                  label="Default inspection days"
                  type="number"
                  value={defaults.defaultInspectionDays}
                  onChange={(v) => patchDefaults({ defaultInspectionDays: Number(v) || 10 })}
                />
                <Field
                  label="Days to close (from offer)"
                  type="number"
                  value={defaults.defaultClosingDaysFromOffer}
                  onChange={(v) =>
                    patchDefaults({ defaultClosingDaysFromOffer: Number(v) || 30 })
                  }
                />
                <label className="block text-xs text-gray-500">
                  Default financing
                  <select
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                    value={defaults.defaultFinancingType}
                    onChange={(e) =>
                      patchDefaults({
                        defaultFinancingType: e.target.value as FinancingType,
                      })
                    }
                  >
                    {(
                      [
                        'Conventional',
                        'FHA',
                        'VA',
                        'USDA',
                        'Cash',
                        'Seller finance',
                        'Other',
                      ] as FinancingType[]
                    ).map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <Field
                  label="Default county"
                  value={defaults.preferredCounty}
                  onChange={(v) => patchDefaults({ preferredCounty: v })}
                />
              </div>
              <label className="block text-xs text-gray-500 mt-3">
                Standard contingencies (boilerplate)
                <textarea
                  className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[100px]"
                  value={defaults.standardContingencies}
                  onChange={(e) => patchDefaults({ standardContingencies: e.target.value })}
                />
              </label>
              <p className="text-[11px] text-gray-400 mt-2">
                Defaults save automatically in this browser.
              </p>
            </Section>
          </div>
        )}

        {/* ─── FORMS ─── */}
        {tab === 'forms' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">Packet ({forms.length})</h2>
                <button
                  type="button"
                  onClick={populate}
                  className="text-xs px-3 py-1.5 bg-black text-white rounded-lg"
                >
                  Re-populate
                </button>
              </div>
              {forms.length === 0 ? (
                <div className="border border-dashed rounded-2xl p-8 text-center text-sm text-gray-500">
                  Fill the cover letter, then click Populate forms.
                </div>
              ) : (
                forms.map((f) => (
                  <button
                    key={f.formCode}
                    type="button"
                    onClick={() => setSelected(f)}
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

            <div className="lg:col-span-2">
              {selected ? (
                <div className="bg-white border rounded-3xl p-6 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                    <div>
                      <h2 className="text-xl font-semibold">
                        {selected.formCode} — {selected.formName}
                      </h2>
                      <p className="text-sm text-gray-500 mt-1">
                        Auto-filled from cover letter · {money(deal.purchasePrice)} ·{' '}
                        {deal.address || 'no address'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={prepareSign}
                      className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-xl"
                    >
                      Send packet for signature
                    </button>
                  </div>

                  {selected.formCode === 'COVER' ? (
                    <pre className="text-xs whitespace-pre-wrap font-mono bg-gray-50 rounded-2xl p-4 max-h-[60vh] overflow-auto">
                      {String(selected.populatedFields.fullText || '')}
                    </pre>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto">
                      {Object.entries(selected.populatedFields).map(([key, value]) => (
                        <div key={key} className="bg-gray-50 rounded-xl px-3 py-2 text-sm">
                          <div className="text-[10px] uppercase tracking-wide text-gray-400">
                            {key}
                          </div>
                          <div className="font-medium text-gray-800 break-words whitespace-pre-wrap">
                            {value === '' || value == null ? '—' : String(value)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="border border-dashed rounded-3xl p-16 text-center text-gray-500">
                  Select a form to preview populated fields.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── FORM SIMPLICITY–STYLE ROOM ─── */}
        {tab === 'sign' && (
          <div className="space-y-4">
            {/* Recommendation banner */}
            <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-950">
              <div className="font-semibold">Link vs embed</div>
              <p className="text-xs mt-1 text-sky-900/90 leading-relaxed">
                <strong>Recommended:</strong> prepare the packet here, then{' '}
                <button type="button" onClick={launchFs} className="underline font-medium">
                  open Form Simplicity
                </button>{' '}
                for official IAR e-sign (legal forms, compliance, their COC). Embedding Form
                Simplicity in an iframe usually fails (login/SSO + frame blocking). This tab{' '}
                <em>mirrors</em> the Form Simplicity room for demos and training; production can
                keep both paths.
              </p>
            </div>

            {!room ? (
              <div className="bg-white border rounded-3xl p-10 text-center space-y-4 shadow-sm">
                <div className="text-3xl">📋</div>
                <h2 className="text-lg font-semibold">No transaction room yet</h2>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  Build a Form Simplicity–style room from your cover letter: forms tray, routing
                  order, send for signature, track, COA.
                </p>
                <button
                  type="button"
                  onClick={prepareSign}
                  className="px-5 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold"
                >
                  Create Form Simplicity–style room
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                {/* Left: room chrome */}
                <div className="xl:col-span-2 space-y-4">
                  <div className="bg-slate-900 text-white rounded-2xl p-5 shadow-lg">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="text-[10px] uppercase tracking-widest text-slate-400">
                          Transaction room · Form Simplicity mirror
                        </div>
                        <h2 className="text-xl font-semibold mt-0.5">{room.roomName}</h2>
                        <p className="text-sm text-slate-300 mt-1">{room.propertyLabel}</p>
                      </div>
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                        {FS_STATUS_LABEL[room.status]}
                      </span>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={launchFs}
                        className="px-4 py-2 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100"
                      >
                        Open Form Simplicity ↗
                      </button>
                      <button
                        type="button"
                        onClick={copyHandoff}
                        className="px-4 py-2 rounded-xl border border-slate-600 text-sm hover:bg-slate-800"
                      >
                        Copy handoff JSON
                      </button>
                      <button
                        type="button"
                        onClick={prepareSign}
                        className="px-4 py-2 rounded-xl border border-slate-600 text-sm hover:bg-slate-800"
                      >
                        Rebuild room from cover letter
                      </button>
                    </div>
                  </div>

                  {/* Forms tray */}
                  <div className="bg-white border rounded-2xl p-5 shadow-sm">
                    <h3 className="font-semibold text-slate-900 mb-3">Forms tray</h3>
                    <ul className="divide-y">
                      {room.forms.map((f) => (
                        <li key={f.code} className="py-2.5 flex items-center justify-between gap-3 text-sm">
                          <div>
                            <span className="font-mono text-xs text-slate-400 mr-2">{f.code}</span>
                            <span className="font-medium text-slate-800">{f.name}</span>
                          </div>
                          <span
                            className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                              f.status === 'signed'
                                ? 'bg-emerald-100 text-emerald-800'
                                : f.status === 'sent'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-slate-100 text-slate-600'
                            }`}
                          >
                            {f.status.replace(/_/g, ' ')}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recipients & routing */}
                  <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
                    <h3 className="font-semibold text-slate-900">Recipients &amp; routing</h3>
                    <p className="text-xs text-slate-500">
                      Order mirrors Form Simplicity: sequential e-sign (Buyer → Seller → Agent).
                    </p>
                    {room.recipients.length === 0 ? (
                      <p className="text-sm text-rose-600">
                        No recipients — add buyer/seller emails on the cover letter.
                      </p>
                    ) : (
                      <ul className="space-y-2">
                        {room.recipients.map((r) => (
                          <li
                            key={r.accessToken}
                            className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl border bg-slate-50 text-sm"
                          >
                            <div className="min-w-0">
                              <div className="font-medium">
                                {r.routingOrder}. {r.name}{' '}
                                <span className="text-slate-400 text-xs capitalize">
                                  ({r.role.replace(/_/g, ' ')})
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">{r.email}</div>
                              {room.status !== 'ready_to_send' && room.status !== 'draft' && (
                                <a
                                  href={r.signingUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-sky-700 underline break-all"
                                >
                                  Open signing link (email-style)
                                </a>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full ${
                                  r.status === 'signed'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : r.status === 'sent'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-gray-200 text-gray-600'
                                }`}
                              >
                                {r.status}
                              </span>
                              {(room.status === 'out_for_signature' ||
                                room.status === 'partially_signed') &&
                                r.status !== 'signed' && (
                                  <button
                                    type="button"
                                    onClick={() => demoSign(r.role)}
                                    className="text-xs text-emerald-700 underline"
                                  >
                                    Sign as them (demo)
                                  </button>
                                )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}

                    <label className="block text-xs text-slate-500">
                      Invitation message
                      <textarea
                        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[100px]"
                        value={signMessage}
                        onChange={(e) => {
                          setSignMessage(e.target.value);
                          if (room) {
                            const updated = {
                              ...room,
                              package: { ...room.package, message: e.target.value },
                            };
                            setRoom(updated);
                            saveRoom(updated);
                          }
                        }}
                      />
                    </label>

                    {(room.status === 'ready_to_send' || room.status === 'draft') && (
                      <button
                        type="button"
                        disabled={busy || room.recipients.length === 0}
                        onClick={sendPackage}
                        className="w-full py-3 bg-emerald-600 text-white rounded-2xl font-semibold text-sm disabled:opacity-50"
                      >
                        {busy ? 'Sending…' : 'Send for e-signature (Form Simplicity style)'}
                      </button>
                    )}
                  </div>

                  {room.package.certificateOfAuthenticity && (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-5 space-y-3">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <h3 className="font-semibold text-emerald-900">
                            Certificate of Authenticity (COA)
                          </h3>
                          <p className="text-xs text-emerald-800/80 mt-0.5 font-mono">
                            {room.package.certificateOfAuthenticity.id} · hash{' '}
                            {room.package.certificateOfAuthenticity.documentHash}
                          </p>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={copyCoa}
                            className="px-3 py-1.5 text-xs border border-emerald-300 rounded-lg bg-white"
                          >
                            Copy COA
                          </button>
                          <button
                            type="button"
                            onClick={printCoa}
                            className="px-3 py-1.5 text-xs border border-emerald-300 rounded-lg bg-white"
                          >
                            Print COA
                          </button>
                        </div>
                      </div>
                      <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono bg-white border rounded-xl p-3 max-h-48 overflow-auto text-gray-700">
                        {room.package.certificateOfAuthenticity.fullText}
                      </pre>
                    </div>
                  )}
                </div>

                {/* Right rail */}
                <div className="space-y-4">
                  <div className="bg-white border rounded-2xl p-5 shadow-sm">
                    <h3 className="font-semibold mb-2">Form Simplicity workflow</h3>
                    <ol className="text-xs text-slate-600 space-y-2 list-decimal pl-4">
                      {room.instructions.map((line, i) => (
                        <li key={i}>{line.replace(/^\d+\.\s*/, '')}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="bg-white border rounded-2xl p-5 shadow-sm text-xs text-slate-600 space-y-2">
                    <div className="font-semibold text-slate-900 text-sm">Why not embed?</div>
                    <p>
                      Form Simplicity (like most MLS portals) typically blocks iframes and requires
                      its own login. Linking out is more reliable and keeps you on official IAR
                      forms for binding e-sign.
                    </p>
                    <p>
                      Set <code className="bg-slate-100 px-1 rounded">NEXT_PUBLIC_FORM_SIMPLICITY_URL</code>{' '}
                      to your brokerage’s FS login if it differs from the default.
                    </p>
                  </div>
                  {rooms.length > 0 && (
                    <div className="bg-white border rounded-2xl p-5 shadow-sm">
                      <h3 className="font-semibold mb-3 text-sm">Recent rooms</h3>
                      <ul className="space-y-2 text-sm">
                        {rooms.slice(0, 6).map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              className="w-full text-left hover:text-emerald-700"
                              onClick={() => {
                                setRoom(r);
                                setSignMessage(r.package.message);
                              }}
                            >
                              <div className="font-medium truncate">{r.roomName}</div>
                              <div className="text-[11px] text-slate-400">
                                {FS_STATUS_LABEL[r.status]}
                              </div>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white border rounded-2xl p-5 shadow-sm">
      <div className="mb-3">
        <h2 className="font-semibold text-gray-900">{title}</h2>
        {hint && <p className="text-xs text-gray-400 mt-0.5">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs text-gray-500">
      {label}
      <input
        type={type}
        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm text-gray-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-white px-3 py-2">
      <div className="text-[10px] uppercase text-gray-400">{label}</div>
      <div className="font-semibold text-sm tabular-nums">{value}</div>
    </div>
  );
}
