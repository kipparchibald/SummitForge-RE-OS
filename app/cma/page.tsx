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

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const DEMO_COMPS: CompProperty[] = [
  {
    address: '4500 E Sunnyside, Idaho Falls, ID',
    price: 2350000,
    acres: 47.3,
    propertyType: 'Land',
    distanceMi: 12,
    status: 'Active',
  },
  {
    address: 'Sample 40 acres near Terreton, Terreton, ID',
    price: 620000,
    acres: 40,
    propertyType: 'Land',
    distanceMi: 18,
    status: 'Active',
  },
  {
    address: '2200 W 7000 S, Rexburg, ID',
    price: 1450000,
    acres: 28.5,
    propertyType: 'Land',
    distanceMi: 22,
    status: 'Active',
  },
  {
    address: '155 Snake River Rd, Swan Valley, ID',
    price: 1180000,
    acres: 22,
    propertyType: 'Land',
    distanceMi: 28,
    status: 'Active',
  },
  {
    address: '769 1580 N, Shelley, ID',
    price: 575000,
    acres: 5.8,
    propertyType: 'Land',
    distanceMi: 14,
    status: 'Active',
  },
  {
    address: '789 Lindy Lane, Rigby, ID',
    price: 489000,
    sqft: 1680,
    beds: 3,
    baths: 2,
    propertyType: 'Single Family',
    distanceMi: 1.2,
    status: 'Pending',
  },
  {
    address: '172 Kiana Dr, Rigby, ID',
    price: 512000,
    sqft: 1850,
    beds: 4,
    baths: 2.5,
    propertyType: 'Single Family',
    distanceMi: 2.1,
    status: 'Coming Soon',
  },
  {
    address: '3120 Woodruff Ave, Idaho Falls, ID',
    price: 425000,
    sqft: 1920,
    beds: 4,
    baths: 2,
    propertyType: 'Single Family',
    distanceMi: 3.4,
    status: 'Active',
  },
  {
    address: '48 N 2nd E, Rexburg, ID',
    price: 379000,
    sqft: 1540,
    beds: 3,
    baths: 2,
    propertyType: 'Single Family',
    distanceMi: 8.1,
    status: 'Active',
  },
];

const DEFAULT_SUBJECT: SubjectProperty = {
  address: '12.5 acres near Rigby, ID',
  listPrice: 650000,
  acres: 12.5,
  propertyType: 'Land',
  city: 'Rigby',
};

export default function CMABuilder() {
  const [subject, setSubject] = useState<SubjectProperty>(DEFAULT_SUBJECT);
  const [gisHandoff, setGisHandoff] = useState<GisCmaHandoff | null>(null);
  const [comps, setComps] = useState<CompProperty[]>(DEMO_COMPS);
  const [loading, setLoading] = useState(false);
  const [aiNote, setAiNote] = useState('');
  const [status, setStatus] = useState('');
  const [ran, setRan] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate subject from GIS parcel selection (localStorage + ?from=gis)
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
          ? `GIS parcel applied as CMA subject${handoff.pin ? ` · PIN ${handoff.pin}` : ''}${
              handoff.yearBuilt ? ` · built ${handoff.yearBuilt}` : ''
            }${
              handoff.assessedValue
                ? ` · assessed ${money(handoff.assessedValue)}`
                : ''
            }${hasMap ? ' · aerial parcel map imported' : ''}. Review fields, pull comps, then Run CMA.`
          : `Restored GIS subject${handoff.pin ? ` · PIN ${handoff.pin}` : ''} from last parcel selection${
              hasMap ? ' (with parcel map)' : ''
            }.`
      );
    } else if (fromGis) {
      setStatus(
        'No GIS parcel in session — open GIS Parcel Explorer, select a lot, then Send to CMA.'
      );
    }
    setHydrated(true);
  }, []);

  const result = useMemo(() => (ran ? runCma(subject, comps, 5) : null), [ran, subject, comps]);

  const isResidential = /single|family|home|new construction|condo|town/i.test(
    subject.propertyType || ''
  );

  const pullNavicaComps = async () => {
    setLoading(true);
    setStatus('Pulling live / demo Navica listings…');
    try {
      const res = await fetch('/api/import/listings?live=navica');
      const data = await res.json();
      const listings = (data.listings || []) as {
        address: string;
        price: number;
        acres?: number;
        propertyType?: string;
        yearBuilt?: number;
        beds?: number;
        baths?: number;
        sqft?: number;
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
    setStatus('CMA calculated with adjusted weighted comps.');
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
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">CMA Builder</h1>
          <p className="text-gray-600 mt-1">
            Comparable market analysis for land and homes — pull assessor details from GIS parcel
            selection, then weight comps and AI valuation.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/monitoring"
            className="px-4 py-2 text-sm rounded-xl border border-sky-200 bg-sky-50 text-sky-900 hover:bg-sky-100"
          >
            Select parcel on GIS →
          </Link>
          <button
            type="button"
            onClick={pullNavicaComps}
            disabled={loading}
            className="px-4 py-2 text-sm rounded-xl border hover:bg-gray-50 disabled:opacity-50"
          >
            Pull Navica comps
          </button>
          <Link
            href="/development/plat"
            className="px-4 py-2 text-sm rounded-xl bg-emerald-600 text-white hover:bg-emerald-500"
          >
            AI Plat residual →
          </Link>
        </div>
      </div>

      {status && (
        <div className="mb-4 text-sm px-4 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-700">
          {status}
        </div>
      )}

      {gisHandoff && (
        <div className="mb-6 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm overflow-hidden">
          <div className="px-4 py-3 border-b border-sky-100 flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-sky-600 font-semibold">
                GIS / assessor subject
              </div>
              <div className="font-semibold text-slate-900 font-mono text-sm sm:text-base">
                {gisHandoff.pin || 'Parcel'}
                {gisHandoff.county ? ` · ${gisHandoff.county} County` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={clearGisSubject}
              className="text-xs px-3 py-1.5 rounded-lg border border-sky-200 text-sky-800 hover:bg-white"
            >
              Clear GIS subject
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:gap-px bg-sky-100/60">
            <div className="bg-white p-3 sm:p-4">
              <div className="text-[10px] uppercase tracking-wider text-sky-700 font-semibold mb-2">
                Parcel map · aerial photo
              </div>
              <ParcelAerialMap handoff={gisHandoff} heightClass="h-[280px] sm:h-[340px]" />
            </div>
            <div className="bg-white flex flex-col">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-sky-100/80">
                <GisStat
                  label="Year built"
                  value={gisHandoff.yearBuilt != null ? String(gisHandoff.yearBuilt) : '—'}
                />
                <GisStat
                  label="Total assessed"
                  value={gisHandoff.assessedValue != null ? money(gisHandoff.assessedValue) : '—'}
                  accent
                />
                <GisStat
                  label="Land value"
                  value={gisHandoff.landValue != null ? money(gisHandoff.landValue) : '—'}
                />
                <GisStat
                  label="Improvements $"
                  value={
                    gisHandoff.improvementValue != null
                      ? money(gisHandoff.improvementValue)
                      : '—'
                  }
                />
                <GisStat
                  label="Acres"
                  value={gisHandoff.acres != null ? String(gisHandoff.acres) : '—'}
                />
                <GisStat label="Type (inferred)" value={subject.propertyType || '—'} />
              </div>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 text-sm flex-1">
                <Detail label="Owner" value={gisHandoff.owner} />
                <Detail
                  label="Parcel address"
                  value={gisHandoff.parcelAddress || gisHandoff.situsAddress}
                />
                <Detail label="Mailing address" value={gisHandoff.mailingAddress} />
                <Detail label="Improvements" value={gisHandoff.improvements} />
                <Detail label="Land use" value={gisHandoff.landUse} />
                <Detail label="Zoning" value={gisHandoff.zoning} />
                <Detail
                  label="Legal"
                  value={gisHandoff.legalDescription}
                  className="sm:col-span-2"
                />
                <Detail
                  label="Source"
                  value={gisHandoff.source}
                  className="sm:col-span-2 text-xs text-slate-500"
                />
              </dl>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="text-sm font-semibold text-gray-800">Subject property</div>
            {!hydrated && (
              <p className="text-xs text-slate-400">Loading GIS session…</p>
            )}
            <Field
              label="Address"
              value={subject.address}
              onChange={(v) => setSubject((s) => ({ ...s, address: v }))}
            />
            <Field
              label="City (match boost)"
              value={subject.city || ''}
              onChange={(v) => setSubject((s) => ({ ...s, city: v }))}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="List / ask $"
                type="number"
                value={String(subject.listPrice || '')}
                onChange={(v) => setSubject((s) => ({ ...s, listPrice: Number(v) || undefined }))}
              />
              <Field
                label="Assessed $"
                type="number"
                value={String(subject.assessedValue || '')}
                onChange={(v) =>
                  setSubject((s) => ({ ...s, assessedValue: Number(v) || undefined }))
                }
              />
              <Field
                label="Acres"
                type="number"
                value={String(subject.acres || '')}
                onChange={(v) => setSubject((s) => ({ ...s, acres: Number(v) || undefined }))}
              />
              <Field
                label="Year built"
                type="number"
                value={String(subject.yearBuilt ?? '')}
                onChange={(v) =>
                  setSubject((s) => ({
                    ...s,
                    yearBuilt: v === '' ? undefined : Number(v) || undefined,
                  }))
                }
              />
              <Field
                label="Sqft (living)"
                type="number"
                value={String(subject.sqft || '')}
                onChange={(v) => setSubject((s) => ({ ...s, sqft: Number(v) || undefined }))}
              />
              <Field
                label="Beds"
                type="number"
                value={String(subject.beds ?? '')}
                onChange={(v) =>
                  setSubject((s) => ({ ...s, beds: v === '' ? undefined : Number(v) }))
                }
              />
            </div>
            <label className="block text-xs text-gray-500">
              Type
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={subject.propertyType || 'Land'}
                onChange={(e) => setSubject((s) => ({ ...s, propertyType: e.target.value }))}
              >
                <option>Land</option>
                <option>Vacant Land</option>
                <option>Single Family</option>
                <option>New Construction</option>
                <option>Farm/Ranch</option>
              </select>
            </label>
            {subject.pin && (
              <p className="text-[11px] text-slate-500 font-mono">PIN {subject.pin}</p>
            )}
            {isResidential && !subject.sqft && (
              <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1.5">
                Living area sqft is not on most county parcel layers — enter GLA if known for better
                residential adjustments.
              </p>
            )}
            <button
              type="button"
              onClick={runAnalysis}
              className="w-full py-2.5 bg-black text-white rounded-xl text-sm font-medium hover:bg-gray-900"
            >
              Run CMA
            </button>
            <button
              type="button"
              onClick={askAi}
              disabled={loading}
              className="w-full py-2.5 border rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
            >
              AI valuation assist
            </button>
          </div>

          <div className="bg-white border rounded-2xl p-5 text-xs text-gray-500 space-y-2">
            <div className="font-medium text-gray-800 text-sm">Comp pool ({comps.length})</div>
            <p>
              {isResidential
                ? 'Residential subject — score favors Single Family comps; add GLA/beds when known.'
                : 'Land subject — score favors acreage comps. Use GIS Send to CMA for house subjects.'}
            </p>
            <Link href="/import" className="text-sky-700 hover:underline">
              Import more listings →
            </Link>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {!result ? (
            <div className="bg-white border border-dashed rounded-3xl p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📊</div>
              <div className="font-medium text-gray-600">Ready when you are</div>
              <p className="text-sm mt-1 max-w-md mx-auto">
                {gisHandoff
                  ? 'GIS subject loaded with year built and assessed value. Pull Navica comps if needed, then Run CMA.'
                  : 'Select a parcel on GIS → Send to CMA, or enter the subject manually, then Run CMA.'}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <Stat label="Indicated value" value={money(result.indicatedValue)} accent />
                <Stat label="Range low" value={money(result.low)} />
                <Stat label="Range high" value={money(result.high)} />
                <Stat
                  label="Confidence"
                  value={`${Math.round(result.confidence * 100)}%`}
                />
              </div>
              {(result.perAcre || result.perSqFt || subject.assessedValue) && (
                <div className="text-sm text-gray-600 px-1 flex flex-wrap gap-x-4 gap-y-1">
                  {result.perAcre != null && (
                    <span>
                      <b>${result.perAcre.toLocaleString()}</b>/acre
                    </span>
                  )}
                  {result.perSqFt != null && (
                    <span>
                      <b>${result.perSqFt}</b>/sqft
                    </span>
                  )}
                  {subject.assessedValue != null && subject.assessedValue > 0 && (
                    <span>
                      vs assessed:{' '}
                      <b
                        className={
                          result.indicatedValue >= subject.assessedValue
                            ? 'text-emerald-700'
                            : 'text-amber-700'
                        }
                      >
                        {(
                          ((result.indicatedValue - subject.assessedValue) / subject.assessedValue) *
                          100
                        ).toFixed(1)}
                        %
                      </b>
                    </span>
                  )}
                  {subject.listPrice != null &&
                    subject.listPrice > 0 &&
                    subject.listPrice !== subject.assessedValue && (
                      <span>
                        vs list:{' '}
                        <b
                          className={
                            result.indicatedValue >= subject.listPrice
                              ? 'text-emerald-700'
                              : 'text-amber-700'
                          }
                        >
                          {(
                            ((result.indicatedValue - subject.listPrice) / subject.listPrice) *
                            100
                          ).toFixed(1)}
                          %
                        </b>
                      </span>
                    )}
                </div>
              )}

              <div className="bg-white border rounded-2xl overflow-hidden shadow-sm">
                <div className="px-4 py-3 border-b font-semibold text-sm">Adjusted comps</div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr>
                        <th className="px-3 py-2">Address</th>
                        <th className="px-3 py-2 text-right">Sale / list</th>
                        <th className="px-3 py-2 text-right">Net adj</th>
                        <th className="px-3 py-2 text-right">Adjusted</th>
                        <th className="px-3 py-2 text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.comps.map((c, i) => (
                        <tr key={i} className="border-t">
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-slate-800">{c.address}</div>
                            <div className="text-[11px] text-slate-400">
                              {c.propertyType ? `${c.propertyType} · ` : ''}
                              {c.acres ? `${c.acres} ac` : c.sqft ? `${c.sqft} sqft` : ''}
                              {c.adjustments.length
                                ? ` · ${c.adjustments.map((a) => a.label).join(', ')}`
                                : ''}
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{money(c.price)}</td>
                          <td
                            className={`px-3 py-2.5 text-right tabular-nums ${
                              c.netAdjustment >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {c.netAdjustment >= 0 ? '+' : ''}
                            {money(c.netAdjustment)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                            {money(c.adjustedPrice)}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums text-slate-500">
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
                  <div className="font-semibold text-xs uppercase tracking-wide text-blue-600 mb-2">
                    AI valuation assist
                  </div>
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

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
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

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        accent ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-500">{label}</div>
      <div
        className={`text-lg font-semibold tabular-nums mt-0.5 ${
          accent ? 'text-emerald-900' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function GisStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className={`bg-white px-3 py-2.5 ${accent ? 'bg-sky-50/80' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`text-sm font-semibold tabular-nums mt-0.5 ${accent ? 'text-sky-900' : 'text-slate-900'}`}>
        {value}
      </div>
    </div>
  );
}

function Detail({
  label,
  value,
  className = '',
}: {
  label: string;
  value: string | null | undefined;
  className?: string;
}) {
  if (!value) return null;
  return (
    <div className={className}>
      <dt className="text-[10px] uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className="text-slate-800 break-words">{value}</dd>
    </div>
  );
}
