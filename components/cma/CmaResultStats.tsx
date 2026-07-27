'use client';

import type { CmaResult } from '@/lib/cma/engine';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Compass-inspired value strip after Run CMA. */
export default function CmaResultStats({ result }: { result: CmaResult }) {
  const mf = result.marketFactors;
  return (
    <div className="space-y-4">
      <div className="rounded-none border border-neutral-900 bg-white overflow-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="p-5 sm:p-6 border-b sm:border-b-0 lg:border-r border-neutral-200 bg-neutral-50/80">
            <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-500 font-semibold">
              Indicated value
            </div>
            <div className="mt-2 text-3xl sm:text-4xl font-medium tracking-tight text-neutral-900 tabular-nums font-serif">
              {money(result.indicatedValue)}
            </div>
            <div className="mt-2 text-xs text-neutral-500">
              {Math.round(result.confidence * 100)}% confidence · reconciled
            </div>
          </div>
          <Stat label="Weighted mean" value={money(result.weightedMean)} />
          <Stat label="Median" value={money(result.medianValue)} />
          <Stat label="Range low" value={money(result.low)} />
          <Stat label="Range high" value={money(result.high)} />
        </div>
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-neutral-500 px-0.5">
        <span>
          Market $/sqft{' '}
          <strong className="text-neutral-800 font-semibold">${mf.dollarsPerSqFt}</strong>
          <span className="text-neutral-400"> (n={mf.sqftSample})</span>
        </span>
        <span className="text-neutral-300 hidden sm:inline">·</span>
        <span>
          Market $/acre{' '}
          <strong className="text-neutral-800 font-semibold">
            ${mf.dollarsPerAcre.toLocaleString()}
          </strong>
          <span className="text-neutral-400"> (n={mf.acreSample})</span>
        </span>
        <span className="text-neutral-300 hidden sm:inline">·</span>
        <span>
          Time drift{' '}
          <strong className="text-neutral-800 font-semibold">
            {(mf.monthlyDrift * 100).toFixed(2)}%/mo
          </strong>
        </span>
        {result.perAcre != null && (
          <>
            <span className="text-neutral-300 hidden sm:inline">·</span>
            <span>
              Subject{' '}
              <strong className="text-neutral-800 font-semibold">
                ${result.perAcre.toLocaleString()}/ac
              </strong>
            </span>
          </>
        )}
        {result.perSqFt != null && (
          <>
            <span className="text-neutral-300 hidden sm:inline">·</span>
            <span>
              Subject{' '}
              <strong className="text-neutral-800 font-semibold">${result.perSqFt}/sf</strong>
            </span>
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 sm:p-5 border-b sm:border-b-0 sm:border-r last:border-r-0 border-neutral-200">
      <div className="text-[9px] uppercase tracking-[0.16em] text-neutral-400 font-semibold leading-tight">
        {label}
      </div>
      <div className="text-base sm:text-lg font-semibold tabular-nums mt-1.5 text-neutral-900 tracking-tight">
        {value}
      </div>
    </div>
  );
}
