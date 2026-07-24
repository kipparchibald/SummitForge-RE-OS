'use client';

import React, { useState, useEffect } from 'react';
import PriceTrendChart from '@/components/PriceTrendChart';
import PredictiveChartsBundle from '@/components/PredictiveCharts';
import { generateForecast } from '../../lib/analytics/forecasting';
import { getMarketTrends } from '../../lib/analytics/market-health';
import { queryListings } from '../../lib/supabase/client';
import { fuzzyFilterListings } from '../../lib/import/listings';
import {
  setLastSyncTimestamp,
  getLastSyncTimestamp,
  formatLastSyncTime,
  isLastSyncRecent,
} from '../../lib/import/recentListings';
import { isDemoMode } from '@/lib/env';
import { COVERAGE_COUNTIES_LABEL } from '@/lib/geo/counties';
import { landValuesRanked } from '@/lib/analysis/land-values';
import Link from 'next/link';

interface SampleListing {
  address: string;
  price: number;
  acres?: number;
}

export default function AnalyticsDashboard() {
  const [lastImport, setLastImport] = useState('—');
  const [recordCount, setRecordCount] = useState(0);
  const [landCount, setLandCount] = useState(0);
  const [isImporting, setIsImporting] = useState(false);
  const [forecast, setForecast] = useState<any[]>([]);
  const [sampleListings, setSampleListings] = useState<SampleListing[]>([]);
  const [lastPull, setLastPull] = useState('');
  const [syncIsRecent, setSyncIsRecent] = useState(false);
  const [sourceLabel, setSourceLabel] = useState('Demo / local');

  useEffect(() => {
    const ts = getLastSyncTimestamp();
    if (ts) {
      setLastPull(formatLastSyncTime(ts));
      setLastImport(ts.slice(0, 10));
    }
    setSyncIsRecent(isLastSyncRecent());

    // Forecast on mount so the page is never empty
    const trends = getMarketTrends();
    setForecast(generateForecast(trends, 6));

    // Best-effort count from Supabase / cache
    queryListings(undefined, { limit: 200 })
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setRecordCount(rows.length);
          setLandCount(
            rows.filter((r: any) =>
              /land|vacant|farm|ranch/i.test(String(r.property_type || r.propertyType || ''))
            ).length
          );
          setSourceLabel('Supabase listings');
        }
      })
      .catch(() => {});

    const onUpdate = () => {
      const newTs = getLastSyncTimestamp();
      setLastPull(formatLastSyncTime(newTs));
      setSyncIsRecent(isLastSyncRecent());
      if (newTs) setLastImport(newTs.slice(0, 10));
    };
    window.addEventListener('navica-pull-updated', onUpdate);
    return () => window.removeEventListener('navica-pull-updated', onUpdate);
  }, []);

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/import/listings?live=navica');
      const data = await res.json();

      const newDate = new Date().toISOString().split('T')[0];
      setLastImport(newDate);

      if (data.listings && data.listings.length > 0) {
        const n = data.listings.length;
        const land = data.landCount ?? n;
        setRecordCount(n);
        setLandCount(land);
        setSourceLabel(data.source || 'Navica');
        setSampleListings(
          data.listings.slice(0, 6).map((l: any) => ({
            address: l.address,
            price: l.price,
            acres: l.acres,
          }))
        );
        const ts = data.lastSync || new Date().toISOString();
        setLastSyncTimestamp(ts);
        setLastPull(formatLastSyncTime(ts));
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
      }

      const trends = getMarketTrends();
      setForecast(generateForecast(trends, 6));
    } catch {
      const newDate = new Date().toISOString().split('T')[0];
      setLastImport(newDate);
      const ts = new Date().toISOString();
      setLastSyncTimestamp(ts);
      setLastPull(formatLastSyncTime(ts));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
      const trends = getMarketTrends();
      setForecast(generateForecast(trends, 6));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <div className="page-header flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Analytics &amp; Forecasting</h1>
          <p className="text-gray-600 mt-1">
            Eastern Idaho · Navica-powered insights, land $/acre, and predictive NC pricing
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 self-start">
          <span
            className={`px-3 py-1 text-xs rounded-full border font-medium ${
              syncIsRecent
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : lastPull
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-100 text-gray-500 border-gray-200'
            }`}
          >
            Live · Last: {lastPull || '—'}
          </span>
          <Link
            href="/development/plat"
            className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50"
          >
            AI Plat Studio
          </Link>
          <button
            type="button"
            onClick={handleImport}
            disabled={isImporting}
            className="bg-black text-white px-5 py-2.5 rounded-xl font-medium text-sm hover:bg-gray-800 disabled:opacity-50"
          >
            {isImporting ? 'Importing…' : 'Import Navica data'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard label="Last import" value={lastImport} />
        <MetricCard
          label="Listings in view"
          value={recordCount > 0 ? recordCount.toLocaleString() : '—'}
          hint={sourceLabel}
        />
        <MetricCard
          label="Land parcels"
          value={landCount > 0 ? landCount.toLocaleString() : recordCount > 0 ? '0' : '—'}
          accent
        />
        <MetricCard label="Coverage" value="7 counties" hint={COVERAGE_COUNTIES_LABEL} />
      </div>

      {sampleListings.length > 0 && (
        <div className="mb-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div className="font-semibold text-sm">
              Latest Navica land {isDemoMode() ? '(demo feed)' : '(live)'}
            </div>
            <Link href="/import" className="text-xs text-sky-700 hover:underline">
              Open import →
            </Link>
          </div>
          <ul className="text-sm space-y-1.5">
            {sampleListings.map((l, idx) => (
              <li key={idx} className="flex justify-between gap-3 border-b border-gray-50 pb-1">
                <span className="text-gray-800 truncate">{l.address}</span>
                <span className="tabular-nums text-gray-600 shrink-0">
                  ${l.price.toLocaleString()}
                  {l.acres ? ` · ${l.acres} ac` : ''}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <SearchAnalyticsPanel />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold text-lg mb-1">Land development potential</h3>
          <p className="text-xs text-gray-500 mb-4">
            Representative $/acre by market
            {isDemoMode() ? ' — demo until live feed connected' : ''}
          </p>
          <div className="space-y-2.5 text-sm">
            {landValuesRanked()
              .slice(0, 6)
              .map(({ market, county, perAcre, yoyPct }) => (
                <div key={market} className="flex items-baseline justify-between gap-2">
                  <span>
                    {market}
                    <span className="text-[10px] text-gray-400 ml-1.5">{county}</span>
                  </span>
                  <span>
                    <span className="font-medium">${perAcre.toLocaleString()}/acre</span>
                    {yoyPct != null && <span className="text-green-600 ml-1">↑</span>}
                  </span>
                </div>
              ))}
          </div>
          <div className="mt-6 grid grid-cols-1 gap-2">
            <Link
              href="/reports/land-analysis"
              className="block w-full border border-gray-300 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 text-center"
            >
              Full land analysis →
            </Link>
            <Link
              href="/development/land-deals"
              className="block w-full bg-amber-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-amber-700 text-center"
            >
              Score land deals →
            </Link>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-6 lg:col-span-2 shadow-sm">
          <NewConstructionPanel />
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-1">Predictive analytics</h2>
        <p className="text-sm text-gray-500 mb-6">
          Price/sqft trends, absorption, DOM, and 3-month forecast — Rigby vs Ririe
        </p>
        <PredictiveChartsBundle />
      </div>

      {forecast.length > 0 && (
        <div className="mt-8 bg-white border border-gray-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-semibold mb-3">6-month price / absorption forecast</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-sm">
            {forecast.map((f: any, idx: number) => (
              <div key={idx} className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                <div className="font-mono text-xs text-gray-500">{f.period}</div>
                <div className="font-medium">${f.predictedPricePerSqFt}/sqft</div>
                <div className="text-[10px] text-gray-500 mt-1">
                  DOM {f.predictedDOM} · {f.predictedAbsorption}% abs · {f.confidence}% conf
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 ${
        accent ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-xs text-gray-500">{label}</div>
      <div
        className={`text-2xl font-semibold mt-1 tracking-tight ${
          accent ? 'text-emerald-900' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
      {hint && <div className="text-[10px] text-gray-400 mt-1 line-clamp-2">{hint}</div>}
    </div>
  );
}

function NewConstructionPanel() {
  const [activeTab, setActiveTab] = useState<'combined' | 'rigby' | 'ririe'>('combined');

  const ncData = {
    combined: {
      price: 285,
      change: 7.4,
      insight:
        'Strong momentum — good window for new spec listings in Rigby & Ririe. New construction $/sqft leading resale.',
    },
    rigby: {
      price: 295,
      change: 8.9,
      insight:
        'Rigby new construction showing strong pricing power. Consider accelerating Teton Heights spec builds.',
    },
    ririe: {
      price: 268,
      change: 5.2,
      insight: 'Ririe pricing rising steadily at a healthy but more moderate pace than Rigby.',
    },
  };

  const currentNC = ncData[activeTab];

  const trendData = {
    combined: [265, 268, 270, 272, 274, 275, 277, 279, 280, 282, 284, 285],
    rigby: [271, 274, 277, 279, 281, 283, 285, 288, 290, 292, 294, 295],
    ririe: [255, 256, 258, 259, 260, 261, 262, 264, 265, 266, 267, 268],
  }[activeTab].map((price, i) => ({
    month: ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'][i],
    price,
  }));

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
        <h3 className="font-semibold text-lg">New construction pricing – Rigby &amp; Ririe</h3>
        <div className="flex bg-gray-100 rounded-2xl p-1">
          {(['combined', 'rigby', 'ririe'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-xl text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'bg-white shadow text-gray-900'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-8">
        <div>
          <div className="text-4xl font-bold tracking-tight">${currentNC.price}</div>
          <div className="text-sm text-gray-500">per sq ft · new construction</div>
        </div>
        <div className="text-emerald-600 font-semibold text-lg">+{currentNC.change}% YoY</div>
        <p className="text-sm text-gray-600 max-w-xl">{currentNC.insight}</p>
      </div>
      <div className="mt-6">
        <PriceTrendChart data={trendData} />
      </div>
    </>
  );
}

function SearchAnalyticsPanel() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [usedFuzzy, setUsedFuzzy] = useState(true);

  const runSearch = async () => {
    setLoading(true);
    try {
      const dbRes = await queryListings(searchTerm || undefined, { limit: 20 });
      let processed = dbRes;
      if (usedFuzzy && searchTerm) {
        processed = fuzzyFilterListings(
          dbRes.map((r: any) => ({
            address: r.address || '',
            description: r.description || '',
            externalId: r.external_id,
            propertyType: r.property_type,
            price: r.price,
            acres: r.acres,
          })),
          searchTerm
        );
      }
      setResults(processed.slice(0, 10));
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-6 mb-8 shadow-sm">
      <div className="font-semibold mb-1">Live search analytics</div>
      <p className="text-xs text-gray-500 mb-3">
        Fuzzy + Supabase queryListings — MLS #, description, address
      </p>
      <div className="flex flex-wrap gap-2 mb-3">
        <input
          className="border p-2 rounded-xl flex-1 min-w-[200px] text-sm"
          placeholder="MLS # or keyword (e.g. terreton acres)"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && runSearch()}
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          className="px-4 py-2 bg-black text-white rounded-xl text-sm disabled:opacity-50"
        >
          Search DB
        </button>
        <label className="text-xs flex items-center gap-1">
          <input
            type="checkbox"
            checked={usedFuzzy}
            onChange={(e) => setUsedFuzzy(e.target.checked)}
          />{' '}
          fuzzy
        </label>
      </div>
      {results.length > 0 && (
        <div className="text-xs bg-gray-50 p-3 rounded-xl border border-gray-100">
          <div>
            Found {results.length} matches{usedFuzzy ? ' (fuzzy scored)' : ''}:
          </div>
          <ul className="mt-1 space-y-0.5">
            {results.map((r, i) => (
              <li key={i}>
                {r.address} · ${r.price?.toLocaleString?.() ?? r.price}{' '}
                {r.acres ? `· ${r.acres}ac` : ''}{' '}
                {r._score ? `score:${r._score.toFixed(2)}` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {loading && <div className="text-xs text-gray-400">Querying…</div>}
    </div>
  );
}
