'use client';

import React, { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

/** Jefferson County / Eastern Idaho planning defaults (not quotes). */
const DEFAULT_TAX_RATE = 0.007; // ~0.70% effective property tax (planning)
const DEFAULT_INS_ANNUAL = 1800;
const PMI_RATE = 0.0055; // annual of loan when LTV > 80%

function monthlyPrincipalInterest(principal: number, annualRatePct: number, years: number): number {
  if (principal <= 0 || years <= 0) return 0;
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  if (r <= 0) return principal / n;
  const factor = Math.pow(1 + r, n);
  return (principal * r * factor) / (factor - 1);
}

function MortgageCalculatorInner() {
  const searchParams = useSearchParams();
  const [price, setPrice] = useState(489000);
  const [downPct, setDownPct] = useState(20);
  const [rate, setRate] = useState(6.75);
  const [term, setTerm] = useState(30);
  const [taxRate, setTaxRate] = useState(DEFAULT_TAX_RATE * 100);
  const [insuranceAnnual, setInsuranceAnnual] = useState(DEFAULT_INS_ANNUAL);
  const [hoaMonthly, setHoaMonthly] = useState(0);

  // Deep-link: /mortgage?price=489000&down=20&rate=6.75&term=30
  useEffect(() => {
    const p = Number(searchParams.get('price') || 0);
    const d = Number(searchParams.get('down') || 0);
    const r = Number(searchParams.get('rate') || 0);
    const t = Number(searchParams.get('term') || 0);
    if (p > 0) setPrice(p);
    if (d > 0 && d <= 100) setDownPct(d);
    if (r > 0) setRate(r);
    if (t === 15 || t === 20 || t === 30) setTerm(t);
  }, [searchParams]);

  const downPayment = Math.round((price * downPct) / 100);
  const principal = Math.max(0, price - downPayment);
  const ltv = price > 0 ? principal / price : 0;
  const needsPmi = ltv > 0.8;

  const pi = useMemo(
    () => monthlyPrincipalInterest(principal, rate, term),
    [principal, rate, term]
  );
  const taxMonthly = (price * (taxRate / 100)) / 12;
  const insMonthly = insuranceAnnual / 12;
  const pmiMonthly = needsPmi ? (principal * PMI_RATE) / 12 : 0;
  const piti = pi + taxMonthly + insMonthly + pmiMonthly + hoaMonthly;

  const totalPayments = pi * term * 12;
  const totalInterest = Math.max(0, totalPayments - principal);

  const applyPreset = (p: number, down: number) => {
    setPrice(p);
    setDownPct(down);
  };

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto">
      <div className="pb-6 mb-8 border-b border-neutral-900">
        <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
          Financing
        </div>
        <h1 className="text-3xl sm:text-4xl font-medium tracking-tight font-serif text-neutral-900">
          Payment estimator
        </h1>
        <p className="text-neutral-500 mt-2 text-sm max-w-xl leading-relaxed">
          Principal & interest, taxes, insurance, and PMI for Eastern Idaho purchases. Planning
          figures only — not a lender quote.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => applyPreset(489000, 20)}
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            Rigby home $489k
          </button>
          <button
            type="button"
            onClick={() => applyPreset(650000, 25)}
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            Land $650k
          </button>
          <button
            type="button"
            onClick={() => applyPreset(512000, 10)}
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            NC 10% down
          </button>
          <Link
            href="/offer"
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border border-neutral-900 text-neutral-900 hover:bg-neutral-900 hover:text-white"
          >
            Offer engine →
          </Link>
          <Link
            href="/cma"
            className="px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold border border-neutral-300 hover:border-neutral-900"
          >
            CMA →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 border border-neutral-200 bg-white p-6 sm:p-8 space-y-8">
          <Field
            label="Purchase price"
            valueLabel={money(price)}
            min={100000}
            max={2000000}
            step={5000}
            value={price}
            onChange={setPrice}
          />
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
                Down payment
              </label>
              <span className="text-sm font-semibold tabular-nums">
                {money(downPayment)} · {downPct.toFixed(0)}%
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={50}
              step={1}
              value={downPct}
              onChange={(e) => setDownPct(Number(e.target.value))}
              className="w-full accent-neutral-900"
            />
            <div className="flex gap-2 mt-2">
              {[5, 10, 15, 20, 25].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setDownPct(p)}
                  className={`flex-1 py-2 text-xs font-semibold border transition ${
                    downPct === p
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {p}%
                </button>
              ))}
            </div>
          </div>
          <Field
            label="Interest rate"
            valueLabel={`${rate}%`}
            min={3}
            max={10}
            step={0.125}
            value={rate}
            onChange={setRate}
            numberStep={0.125}
          />
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
                Loan term
              </label>
              <span className="text-sm font-semibold">{term} years</span>
            </div>
            <div className="flex gap-2">
              {[15, 20, 30].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTerm(t)}
                  className={`flex-1 py-3 text-sm font-semibold border transition ${
                    term === t
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'border-neutral-200 hover:border-neutral-400'
                  }`}
                >
                  {t} yr
                </button>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-100 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
                Tax rate %/yr
              </label>
              <input
                type="number"
                step={0.05}
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
                className="mt-1 w-full border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
                Insurance $/yr
              </label>
              <input
                type="number"
                step={50}
                value={insuranceAnnual}
                onChange={(e) => setInsuranceAnnual(Number(e.target.value) || 0)}
                className="mt-1 w-full border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
                HOA $/mo
              </label>
              <input
                type="number"
                step={25}
                value={hoaMonthly}
                onChange={(e) => setHoaMonthly(Number(e.target.value) || 0)}
                className="mt-1 w-full border border-neutral-200 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="lg:col-span-2 bg-neutral-900 text-white p-6 sm:p-8 flex flex-col min-h-[420px]">
          <div className="text-[10px] uppercase tracking-[0.18em] text-neutral-400 font-semibold">
            Estimated PITI
          </div>
          <div className="mt-2 font-serif text-5xl tracking-tight tabular-nums">
            {money(Math.round(piti))}
          </div>
          <p className="text-xs text-neutral-400 mt-2">per month · all-in planning</p>

          <dl className="mt-8 space-y-0 text-sm flex-1">
            <Row label="Principal & interest" value={money(Math.round(pi))} />
            <Row label="Property tax" value={money(Math.round(taxMonthly))} />
            <Row label="Insurance" value={money(Math.round(insMonthly))} />
            <Row
              label={needsPmi ? 'PMI (est.)' : 'PMI'}
              value={needsPmi ? money(Math.round(pmiMonthly)) : '—'}
              hint={needsPmi ? 'LTV over 80%' : '20%+ down'}
            />
            {hoaMonthly > 0 && <Row label="HOA" value={money(Math.round(hoaMonthly))} />}
            <Row label="Loan amount" value={money(principal)} />
            <Row label="LTV" value={`${(ltv * 100).toFixed(1)}%`} />
            <Row label="Total interest" value={money(Math.round(totalInterest))} muted />
          </dl>

          <div className="mt-6 pt-4 border-t border-white/10 space-y-2">
            <Link
              href={`/offer?price=${price}&address=${encodeURIComponent('Mortgage scenario')}`}
              className="block w-full text-center py-3 bg-white text-neutral-900 text-[11px] font-semibold uppercase tracking-wider hover:bg-neutral-100"
            >
              Score an offer at this price
            </Link>
            <p className="text-[10px] text-neutral-500 leading-relaxed">
              Tax/insurance/PMI are planning defaults for Eastern Idaho. Confirm with your lender and
              the county assessor.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  valueLabel,
  min,
  max,
  step,
  value,
  onChange,
  numberStep,
}: {
  label: string;
  valueLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (n: number) => void;
  numberStep?: number;
}) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        <label className="text-[10px] uppercase tracking-[0.14em] font-semibold text-neutral-500">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums">{valueLabel}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-neutral-900"
      />
      <input
        type="number"
        step={numberStep ?? step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-2 w-full border border-neutral-200 px-3 py-2 text-sm"
      />
    </div>
  );
}

function Row({
  label,
  value,
  hint,
  muted,
}: {
  label: string;
  value: string;
  hint?: string;
  muted?: boolean;
}) {
  return (
    <div className="flex justify-between gap-3 py-2.5 border-b border-white/10">
      <div>
        <span className={muted ? 'text-neutral-500' : 'text-neutral-300'}>{label}</span>
        {hint && <span className="block text-[10px] text-neutral-500">{hint}</span>}
      </div>
      <span className={`tabular-nums font-medium ${muted ? 'text-neutral-400' : ''}`}>{value}</span>
    </div>
  );
}

export default function MortgageCalculator() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-neutral-500">
          Loading payment estimator…
        </div>
      }
    >
      <MortgageCalculatorInner />
    </Suspense>
  );
}
