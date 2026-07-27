'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { runCma, type CompProperty, type SubjectProperty } from '@/lib/cma/engine';
import {
  clearGisCmaHandoff,
  handoffToSubject,
  loadGisCmaHandoff,
  type GisCmaHandoff,
} from '@/lib/cma/from-gis';
import ParcelAerialMap from '@/components/cma/ParcelAerialMap';
import ExportCmaButton from '@/components/cma/ExportCmaButton';
import CmaOfferLink from '@/components/cma/CmaOfferLink';
import CmaResultStats from '@/components/cma/CmaResultStats';
import SubjectPresets, { PRESET_LAND } from '@/components/cma/SubjectPresets';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Demo pool includes closed sales with soldDate so time adjustment runs offline. */
const DEMO_COMPS: CompProperty[] = [
  { address: '4500 E Sunnyside, Idaho Falls, ID', price: 2350000, acres: 47.3, propertyType: 'Land', distanceMi: 12, status: 'Sold', soldDate: '2025-11-12' },
  { address: 'Sample 40 acres near Terreton, Terreton, ID', price: 620000, acres: 40, propertyType: 'Land', distanceMi: 18, status: 'Sold', soldDate: '2026-01-20' },
  { address: '2200 W 7000 S, Rexburg, ID', price: 1450000, acres: 28.5, propertyType: 'Land', distanceMi: 22, status: 'Sold', soldDate: '2025-09-05' },
  { address: '155 Snake River Rd, Swan Valley, ID', price: 1180000, acres: 22, propertyType: 'Land', distanceMi: 28, status: 'Active' },
  { address: '769 1580 N, Shelley, ID', price: 575000, acres: 5.8, propertyType: 'Land', distanceMi: 14, status: 'Sold', soldDate: '2026-03-01' },
  { address: '412 Birch St, Rigby, ID', price: 465000, sqft: 1720, beds: 3, baths: 2, propertyType: 'Single Family', distanceMi: 1.5, status: 'Sold', soldDate: '2026-05-12' },
  { address: '88 Cottonwood Ln, Rigby, ID', price: 492000, sqft: 1850, beds: 3, baths: 2, propertyType: 'Single Family', distanceMi: 2.0, status: 'Sold', soldDate: '2026-06-02' },
  { address: '201 Falcon Dr, Rigby, ID', price: 438000, sqft: 1620, beds: 3, baths: 2, propertyType: 'Single Family', distanceMi: 2.4, status: 'Sold', soldDate: '2026-04-20' },
  { address: '789 Lindy Lane, Rigby, ID', price: 489000, sqft: 1680, beds: 3, baths: 2, propertyType: 'Single Family', distanceMi: 1.2, status: 'Pending' },
  { address: '172 Kiana Dr, Rigby, ID', price: 512000, sqft: 1850, beds: 4, baths: 2.5, propertyType: 'New Construction', distanceMi: 2.1, status: 'Coming Soon' },
  { address: '3120 Woodruff Ave, Idaho Falls, ID', price: 425000, sqft: 1920, beds: 4, baths: 2, propertyType: 'Single Family', distanceMi: 3.4, status: 'Sold', soldDate: '2026-02-14' },
  { address: '48 N 2nd E, Rexburg, ID', price: 379000, sqft: 1540, beds: 3, baths: 2, propertyType: 'Single Family', distanceMi: 8.1, status: 'Sold', soldDate: '2025-12-08' },
];

const DEFAULT_SUBJECT: SubjectProperty = PRESET_LAND;

export default function CMABuilder() {
  const [subject, setSubject] = useState<SubjectProperty>(DEFAULT_SUBJECT);
  const [gisHandoff, setGisHandoff] = useState<GisCmaHandoff | null>(null);
  const [comps, setComps] = useState<CompProperty[]>(DEMO_COMPS);
  const [loading, setLoading] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [status, setStatus] = useState('');
  const [ran, setRan] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const fromGis = params.get('from') === 'gis';
    const handoff = loadGisCmaHandoff();

    if (handoff) {
      const mapped = handoffToSubject(handoff);
      setGisHandoff(handoff);
      setSubject(mapped);
      const hasMap = !!(handoff.ring?.length || handoff.geojson);
      setStatus(
        fromGis
          ? `GIS parcel applied as CMA subject${handoff.pin ? ` · PIN ${handoff.pin}` : ''}${handoff.yearBuilt ? ` · built ${handoff.yearBuilt}` : ''}${handoff.assessedValue ? ` · assessed ${money(handoff.assessedValue)}` : ''}${hasMap ? ' · aerial parcel map imported' : ''}. Review fields, pull comps, then Run CMA.`
          : `Restored GIS subject${handoff.pin ? ` · PIN ${handoff.pin}` : ''} from last parcel selection${hasMap ? ' (with parcel map)' : ''}.`
      );
    } else if (fromGis) {
      setStatus('No GIS parcel in session — open GIS Parcel Explorer, select a lot, then Send to CMA.');
    }
    setHydrated(true);
  }, []);

  const result = useMemo(() => (ran ? runCma(subject, comps, 5) : null), [ran, subject, comps]);
  const isResidential = /single|family|home|new construction|condo|town/i.test(subject.propertyType || '');

  const applyPreset = (next: SubjectProperty) => {
    setSubject(next);
    setRan(false);
    setGisHandoff(null);
    clearGisCmaHandoff();
    setStatus(`Demo subject: ${next.address} (${next.propertyType}). Click Run CMA.`);
  };

  const pullNavicaComps = async () => {
    setLoading(true);
    setStatus('Pulling live / demo Navica listings…');
    try {
      const res = await fetch('/api/import/listings?live=navica');
      const data = await res.json();
      const listings = (data.listings || []) as {
        address: string; price: number; acres?: number; propertyType?: string;
        yearBuilt?: number; beds?: number; baths?: number; sqft?: number; soldDate?: string;
      }[];
      if (listings.length) {
        const mapped: CompProperty[] = listings.map((l) => ({
          address: l.address,
          price: l.price,
          acres: l.acres,
          sqft: l.sqft,
          beds: l.beds,
          baths: l.baths,
          propertyType: l.propertyType || 'Land',
          status: 'Active',
          distanceMi: 5 + Math.random() * 20,
          soldDate: l.soldDate,
        }));
        setComps((prev) => {
          const merged = [...mapped, ...prev];
          const seen = new Set<string>();
          return merged.filter((c) => {
            const k = `${c.address}|${c.price}`;
            if (seen.has(k)) return false;
            seen.add(k);
            return true;
          });
        });
        setStatus(`Loaded ${listings.length} Navica listings as comps.`);
      } else {
        setStatus('No listings returned — using built-in demo comps.');
      }
    } catch {
      setStatus('Pull failed — demo comps still available.');
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = () => {
    setRan(true);
    setStatus(
      'CMA run: reconciled mean + median, market $/sqft & $/acre, time adjustment on sold comps.'
    );
  };

  const askAi = async () => {
    setLoading(true);
    setAiNote('');
    try {
      const res = await fetch('/api/ai/valuation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          property: {
            address: subject.address,
            acres: subject.acres,
            price: subject.listPrice || result?.indicatedValue,
            sqft: subject.sqft,
            yearBuilt: subject.yearBuilt,
            assessedValue: subject.assessedValue,
            pin: subject.pin,
            propertyType: subject.propertyType,
          },
          profile: {
            focusAreas: [
              'CMA',
              subject.propertyType || 'land',
              subject.yearBuilt ? `year built ${subject.yearBuilt}` : '',
              subject.assessedValue ? `assessed ${subject.assessedValue}` : '',
            ].filter(Boolean),
          },
        }),
      });
      const data = await res.json();
      const parts = [
        data.aiInsights,
        data.estimatedValue != null ? `Model estimate: ${money(data.estimatedValue)}` : null,
        data.suggestedListPrice != null ? `Suggested list: ${money(data.suggestedListPrice)}` : null,
      ].filter(Boolean);
      setAiNote(parts.join('\n\n') || 'AI valuation complete.');
    } catch {
      setAiNote('AI valuation unavailable — local CMA still valid.');
    } finally {
      setLoading(false);
    }
  };

  const clearGisSubject = () => {
    clearGisCmaHandoff();
    setGisHandoff(null);
    setSubject(DEFAULT_SUBJECT);
    setRan(false);
    setStatus('Cleared GIS subject — restored demo land subject.');
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('from');
      url.searchParams.delete('pin');
      window.history.replaceState({}, '', url.pathname);
    }
  };

  return (
    <div className="p-6 sm:p-10 max-w-6xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 pb-6 mb-6 border-b border-neutral-900">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
            Valuation
          </div>
          <h1 className="text-3xl sm:text-4xl font-medium tracking-tight text-neutral-900 font-serif">
            Comparative Market Analysis
          </h1>
          <p className="text-neutral-500 mt-2 max-w-xl text-sm leading-relaxed">
            Reconciled comps for land and homes — weighted mean, median, market $/sqft &amp; $/acre,
            and time adjustment on closed sales.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/monitoring"
            className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white transition"
          >
            Select parcel
          </Link>
          <button
            type="button"
            onClick={pullNavicaComps}
            disabled={loading}
            className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold border border-neutral-300 text-neutral-700 hover:border-neutral-900 disabled:opacity-50"
          >
            Pull comps
          </button>
          <Link
            href="/offer"
            className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold border border-neutral-300 text-neutral-700 hover:border-neutral-900"
          >
            Offer engine
          </Link>
          <Link
            href="/development/plat"
            className="px-4 py-2.5 text-[11px] uppercase tracking-wider font-semibold bg-neutral-900 text-white hover:bg-black"
          >
            AI plat
          </Link>
        </div>
      </div>

      {status && (
        <div className="mb-4 text-sm px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">{status}</div>
      )}

      {gisHandoff && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-sky-600 font-semibold">GIS / assessor subject</div>
              <div className="font-semibold text-slate-900 font-mono text-sm sm:text-base">
                {gisHandoff.pin || 'Parcel'}{gisHandoff.county ? ` · ${gisHandoff.county} County` : ''}
              </div>
            </div>
            <button type="button" onClick={clearGisSubject} className="text-xs px-3 py-1.5 rounded-lg border border-sky-200 text-sky-800 hover:bg-white">
              Clear GIS subject
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-px bg-sky-100/60">
            <div className="bg-white p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-wider text-sky-700 font-semibold mb-2">Parcel map · aerial photo</div>
              <ParcelAerialMap handoff={gisHandoff} heightClass="h-[280px] sm:h-[340px]" />
            </div>
            <div className="bg-white flex flex-col">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-sky-100/80">
                <GisStat label="Year built" value={gisHandoff.yearBuilt != null ? String(gisHandoff.yearBuilt) : '—'} />
                <GisStat label="Total assessed" value={gisHandoff.assessedValue != null ? money(gisHandoff.assessedValue) : '—'} accent />
                <GisStat label="Land value" value={gisHandoff.landValue != null ? money(gisHandoff.landValue) : '—'} />
                <GisStat label="Improvements $" value={gisHandoff.improvementValue != null ? money(gisHandoff.improvementValue) : '—'} />
                <GisStat label="Acres" value={gisHandoff.acres != null ? String(gisHandoff.acres) : '—'} />
                <GisStat label="Type (inferred)" value={subject.propertyType || '—'} />
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-sm flex-1">
                <Detail label="Owner" value={gisHandoff.owner} />
                <Detail label="Parcel address" value={gisHandoff.parcelAddress || gisHandoff.situsAddress} />
                <Detail label="Mailing address" value={gisHandoff.mailingAddress} />
                <Detail label="Improvements" value={gisHandoff.improvements} />
                <Detail label="Land use" value={gisHandoff.landUse} />
                <Detail label="Zoning" value={gisHandoff.zoning} />
                <Detail label="Legal" value={gisHandoff.legalDescription} className="sm:col-span-2" />
                <Detail label="Source" value={gisHandoff.source} className="sm:col-span-2 text-xs text-slate-500" />
              </dl>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border border-neutral-200 p-5 sm:p-6 space-y-3 shadow-none">
            <div className="text-[10px] uppercase tracking-[0.16em] font-semibold text-neutral-500">
              Subject property
            </div>
            {!gisHandoff && (
              <SubjectPresets subject={subject} onSelect={applyPreset} />
            )}
            {!hydrated && <p className="text-xs text-slate-400">Loading GIS session…</p>}
            <Field label="Address" value={subject.address} onChange={(v) => setSubject((s) => ({ ...s, address: v }))} />
            <Field label="City (match boost)" value={subject.city || ''} onChange={(v) => setSubject((s) => ({ ...s, city: v }))} />
            <div className="grid grid-cols-2 gap-2">
              <Field label="List / ask $" type="number" value={String(subject.listPrice || '')} onChange={(v) => setSubject((s) => ({ ...s, listPrice: Number(v) || undefined }))} />
              <Field label="Assessed $" type="number" value={String(subject.assessedValue || '')} onChange={(v) => setSubject((s) => ({ ...s, assessedValue: Number(v) || undefined }))} />
              <Field label="Acres" type="number" value={String(subject.acres || '')} onChange={(v) => setSubject((s) => ({ ...s, acres: Number(v) || undefined }))} />
              <Field label="Year built" type="number" value={String(subject.yearBuilt ?? '')} onChange={(v) => setSubject((s) => ({ ...s, yearBuilt: v === '' ? undefined : Number(v) || undefined }))} />
              <Field label="Sqft (living)" type="number" value={String(subject.sqft || '')} onChange={(v) => setSubject((s) => ({ ...s, sqft: Number(v) || undefined }))} />
              <Field label="Beds" type="number" value={String(subject.beds ?? '')} onChange={(v) => setSubject((s) => ({ ...s, beds: v === '' ? undefined : Number(v) }))} />
            </div>
            <label className="block text-xs text-gray-500">
              Type
              <select className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" value={subject.propertyType || 'Land'} onChange={(e) => setSubject((s) => ({ ...s, propertyType: e.target.value }))}>
                <option>Land</option>
                <option>Vacant Land</option>
                <option>Single Family</option>
                <option>New Construction</option>
                <option>Farm/Ranch</option>
              </select>
            </label>
            {subject.pin && <p className="text-[11px] text-slate-500 font-mono">PIN {subject.pin}</p>}
            {isResidential && !subject.sqft && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                Living area sqft is not on most county parcel layers — enter GLA if known for better residential adjustments.
              </p>
            )}
            <button
              type="button"
              onClick={runAnalysis}
              className="w-full py-3 bg-neutral-900 text-white text-[11px] font-semibold uppercase tracking-[0.14em] hover:bg-black"
            >
              Run CMA
            </button>
            <button
              type="button"
              onClick={askAi}
              disabled={loading}
              className="w-full py-3 border border-neutral-300 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-800 hover:border-neutral-900 disabled:opacity-50"
            >
              AI valuation assist
            </button>
            {result && (
              <>
                <ExportCmaButton result={result} />
                <CmaOfferLink
                  address={subject.address}
                  listPrice={subject.listPrice}
                  indicatedValue={result.indicatedValue}
                  acres={subject.acres}
                  sqft={subject.sqft}
                  propertyType={subject.propertyType}
                />
              </>
            )}
          </div>

          <div className="bg-white border rounded-2xl p-5 text-xs text-gray-500 space-y-2">
            <div className="font-medium text-gray-800 text-sm">Comp pool ({comps.length})</div>
            <p>
              {isResidential
                ? 'Residential subject — score favors Single Family comps; add GLA/beds when known.'
                : 'Land subject — score favors acreage comps. Use GIS Send to CMA for house subjects.'}
            </p>
            <p className="text-slate-400">
              Closed sales with dates drive time adjustment; actives still help size/type scoring.
            </p>
            <Link href="/import" className="text-sky-700 hover:underline">Import more listings →</Link>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <div className="bg-white border border-neutral-200 p-14 text-center">
              <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-semibold mb-3">
                Results
              </div>
              <div className="font-serif text-2xl text-neutral-800 tracking-tight">Ready when you are</div>
              <p className="text-sm mt-3 max-w-md mx-auto text-neutral-500 leading-relaxed">
                {gisHandoff
                  ? 'GIS subject loaded with year built and assessed value. Pull comps if needed, then Run CMA.'
                  : 'Pick a demo subject (Land / Home / NC), or select a parcel on GIS → Send to CMA, then Run CMA.'}
              </p>
            </div>
          ) : (
            <>
              <CmaResultStats result={result} />

              <div className="bg-white border border-neutral-200 overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-900 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-[0.16em] font-semibold text-neutral-800">
                    Adjusted comparables
                  </span>
                  <ExportCmaButton
                    result={result}
                    label="Export PDF"
                    className="px-3 py-2 bg-neutral-900 text-white text-[10px] font-semibold uppercase tracking-wider hover:bg-black"
                  />
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left">
                      <tr className="border-b border-neutral-200">
                        <th className="px-4 py-3 text-[9px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                          Address
                        </th>
                        <th className="px-4 py-3 text-right text-[9px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                          Sale / list
                        </th>
                        <th className="px-4 py-3 text-right text-[9px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                          Net adj
                        </th>
                        <th className="px-4 py-3 text-right text-[9px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                          Adjusted
                        </th>
                        <th className="px-4 py-3 text-right text-[9px] uppercase tracking-[0.14em] text-neutral-400 font-semibold">
                          Score
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.comps.map((c, i) => (
                        <tr key={i} className="border-b border-neutral-100 last:border-0">
                          <td className="px-4 py-3.5">
                            <div className="font-semibold text-neutral-900">{c.address}</div>
                            <div className="text-[11px] text-neutral-400 mt-0.5">
                              {c.propertyType ? `${c.propertyType} · ` : ''}
                              {c.acres ? `${c.acres} ac` : c.sqft ? `${c.sqft} sqft` : ''}
                              {c.monthsSinceSale != null ? ` · ${c.monthsSinceSale} mo ago` : ''}
                              {c.adjustments.length
                                ? ` · ${c.adjustments.map((a) => a.label).join(', ')}`
                                : ''}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-neutral-800">
                            {money(c.price)}
                          </td>
                          <td
                            className={`px-4 py-3.5 text-right tabular-nums ${
                              c.netAdjustment >= 0 ? 'text-emerald-800' : 'text-rose-700'
                            }`}
                          >
                            {c.netAdjustment >= 0 ? '+' : ''}
                            {money(c.netAdjustment)}
                          </td>
                          <td className="px-4 py-3.5 text-right font-semibold tabular-nums text-neutral-900">
                            {money(c.adjustedPrice)}
                          </td>
                          <td className="px-4 py-3.5 text-right tabular-nums text-neutral-400">
                            {(c.score * 100).toFixed(0)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <ul className="text-xs text-gray-500 space-y-1 px-1">
                {result.notes.map((n, i) => (
                  <li key={i}>• {n}</li>
                ))}
              </ul>

              {aiNote && (
                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 text-sm text-blue-900 whitespace-pre-wrap">
                  <div className="font-semibold text-xs uppercase tracking-wide text-blue-600 mb-2">AI valuation assist</div>
                  {aiNote}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <label className="block text-xs text-gray-500">
      {label}
      <input type={type} className="mt-1 w-full border rounded-xl px-3 py-2 text-sm text-gray-900" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function GisStat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`bg-white px-3 py-2.5 ${accent ? 'bg-sky-50/80' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${accent ? 'text-sky-900' : 'text-slate-900'}`}>{value}</div>
    </div>
  );
}

function Detail({ label, value, className = '' }: { label: string; value: string | null | undefined; className?: string }) {
  if (!value) return null;
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-slate-800 break-words">{value}</dd>
    </div>
  );
}
