'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

const money = (n: number) =>
  (n < 0 ? '-' : '') +
  '$' +
  Math.round(Math.abs(n)).toLocaleString();

type Deal = {
  id?: string;
  address: string;
  url?: string;
  county: string;
  acres: number;
  lots: number;
  price: number;
  devCost: number;
  maxOffer: number;
  spread: number;
  verdict: 'OFFER' | 'PASS' | string;
  marginAtList?: number;
};

export default function LandDealsPage() {
  const [data, setData] = useState<{
    source?: string;
    listingsScanned?: number;
    analyzed?: number;
    dealsPenciling?: number;
    all?: Deal[];
    top?: Deal[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [minAcres, setMinAcres] = useState(5);
  const [verdictFilter, setVerdictFilter] = useState<'all' | 'OFFER' | 'PASS'>('all');

  const load = useCallback(async (min = minAcres) => {
    setLoading(true);
    setErr('');
    try {
      const r = await fetch(`/api/development/land-scan?minAcres=${min}`);
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || `Scan failed (${r.status})`);
      setData(j);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Scan failed');
    } finally {
      setLoading(false);
    }
  }, [minAcres]);

  useEffect(() => {
    load();
  }, [load]);

  const deals = (data?.all ?? []).filter((d) =>
    verdictFilter === 'all' ? true : d.verdict === verdictFilter
  );
  const offerCount = (data?.all ?? []).filter((d) => d.verdict === 'OFFER').length;

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Land Deals — Development Pipeline
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Raw-land listings scored for subdivision upside (Snake River MLS / Archibald-Bagley).
              {data && (
                <>
                  {' '}
                  Source: {data.source} · scanned {data.listingsScanned} · analyzed {data.analyzed} ·{' '}
                  <b className="text-emerald-700">{data.dealsPenciling} pencil</b>.
                </>
              )}
            </p>
          </div>
          <Link
            href="/reports/land-analysis"
            className="text-sm text-sky-700 hover:underline shrink-0"
          >
            Full land report →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <SummaryCard label="Scanned" value={data?.listingsScanned ?? '—'} />
        <SummaryCard label="Analyzed" value={data?.analyzed ?? '—'} />
        <SummaryCard
          label="Offer"
          value={offerCount > 0 ? offerCount : (data?.dealsPenciling ?? '—')}
          accent
        />
        <SummaryCard label="Showing" value={loading ? '…' : deals.length} />
      </div>

      <div className="my-4 flex flex-wrap items-center gap-3 text-sm">
        <label className="text-slate-600">
          Min acres:{' '}
          <select
            className="rounded-lg border border-slate-200 px-2 py-1.5 ml-1 bg-white"
            value={minAcres}
            onChange={(e) => {
              const m = +e.target.value;
              setMinAcres(m);
              load(m);
            }}
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
          </select>
        </label>
        <div className="inline-flex rounded-lg border border-slate-200 overflow-hidden">
          {(['all', 'OFFER', 'PASS'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVerdictFilter(v)}
              className={`px-3 py-1.5 text-xs font-medium ${
                verdictFilter === v
                  ? 'bg-slate-800 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {v === 'all' ? 'All' : v}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="rounded-lg bg-amber-600 px-3 py-1.5 font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          onClick={() => load()}
          disabled={loading}
        >
          {loading ? 'Scanning…' : 'Refresh'}
        </button>
      </div>

      {loading && (
        <div className="space-y-2 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-slate-100" />
          ))}
        </div>
      )}
      {err && (
        <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          Error: {err}
        </div>
      )}
      {!loading && !err && (
        <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                {[
                  'Listing',
                  'County',
                  'Acres',
                  'Lots',
                  'List',
                  'Infra cost',
                  'Max offer',
                  'Spread',
                  'Verdict',
                ].map((h, i) => (
                  <th
                    key={h}
                    className={`px-3 py-2.5 ${i >= 2 && i <= 7 ? 'text-right' : 'text-left'} font-medium`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((d, i) => (
                <tr
                  key={d.id ?? i}
                  className={`${i % 2 ? 'bg-slate-50' : 'bg-white'} hover:bg-amber-50/40 transition`}
                >
                  <td className="px-3 py-2.5 max-w-[220px]">
                    {d.url ? (
                      <a
                        className="text-sky-700 hover:underline font-medium"
                        href={d.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {d.address}
                      </a>
                    ) : (
                      <span className="font-medium text-slate-800">{d.address}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{d.county}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.acres}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.lots}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{money(d.price)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                    {money(d.devCost)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                    {money(d.maxOffer)}
                  </td>
                  <td
                    className={`px-3 py-2.5 text-right tabular-nums font-bold ${
                      d.spread >= 0 ? 'text-green-700' : 'text-red-600'
                    }`}
                  >
                    {d.spread >= 0 ? '+' : '-'}
                    {money(Math.abs(d.spread))}
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      className={`rounded-md px-2 py-0.5 text-xs font-bold text-white ${
                        d.verdict === 'OFFER' ? 'bg-green-700' : 'bg-red-600'
                      }`}
                    >
                      {d.verdict}
                    </span>
                  </td>
                </tr>
              ))}
              {deals.length === 0 && (
                <tr>
                  <td className="px-3 py-8 text-center text-slate-500" colSpan={9}>
                    No land listings match this filter. Try lowering min acres or switch to All.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Planning-grade estimates using calibrated Idaho comps &amp; ISPWC costs. Max offer = most
        payable at a 20% target return with financing carry &amp; absorption. Verify with a licensed
        PLS/PE and county P&amp;Z before offering.
      </p>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        accent
          ? 'border-emerald-200 bg-emerald-50'
          : 'border-slate-200 bg-white'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div
        className={`text-xl font-semibold tabular-nums mt-0.5 ${
          accent ? 'text-emerald-800' : 'text-slate-800'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
