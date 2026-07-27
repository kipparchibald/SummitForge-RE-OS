'use client';

import type { CmaResult } from '@/lib/cma/engine';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Dual indicated values + market factor strip after Run CMA. */
export default function CmaResultStats({ result }: { result: CmaResult }) {
  const mf = result.marketFactors;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Stat label="Indicated (reconciled)" value={money(result.indicatedValue)} accent />
        <Stat label="Weighted mean" value={money(result.weightedMean)} />
        <Stat label="Median" value={money(result.medianValue)} />
        <Stat label="Range low" value={money(result.low)} />
        <Stat label="Range high" value={money(result.high)} />
        <Stat label="Confidence" value={`${Math.round(result.confidence * 100)}%`} />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 px-1">
        <span>
          Market $/sqft: <strong className="text-slate-700">${mf.dollarsPerSqFt}</strong>
          <span className="text-slate-400"> (n={mf.sqftSample})</span>
        </span>
        <span>
          Market $/acre: <strong className="text-slate-700">${mf.dollarsPerAcre.toLocaleString()}</strong>
          <span className="text-slate-400"> (n={mf.acreSample})</span>
        </span>
        <span>
          Time drift: <strong className="text-slate-700">{(mf.monthlyDrift * 100).toFixed(2)}%/mo</strong>
        </span>
        {result.perAcre != null && (
          <span>
            Subject: <strong className="text-slate-700">${result.perAcre.toLocaleString()}/ac</strong>
          </span>
        )}
        {result.perSqFt != null && (
          <span>
            Subject: <strong className="text-slate-700">${result.perSqFt}/sf</strong>
          </span>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div
      className={`rounded-2xl border p-3 sm:p-4 ${
        accent ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="text-[10px] uppercase tracking-wider text-gray-500 leading-tight">{label}</div>
      <div
        className={`text-base sm:text-lg font-semibold tabular-nums mt-0.5 ${
          accent ? 'text-emerald-900' : 'text-gray-900'
        }`}
      >
        {value}
      </div>
    </div>
  );
}
