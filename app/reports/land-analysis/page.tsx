'use client';

// Printable land development analysis.
//
// PDF export is the browser's own print-to-PDF rather than a JS PDF library:
// it produces real selectable text and vector output, respects the white-label
// CSS vars, and adds no dependencies. Print rules live in app/globals.css under
// @media print (screen chrome hides; .sf-page-break controls pagination).

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { landValuesRanked, landValuesByCounty } from '@/lib/analysis/land-values';
import { COUNTY_PRESETS, estimateYield, infraCost, feasibility } from '@/lib/development/land-engine';
import { getMarketTrends } from '@/lib/analytics/market-health';
import { generateForecast } from '@/lib/analytics/forecasting';
import { COVERAGE_COUNTIES_LABEL } from '@/lib/geo/counties';

const money = (n: number) => `$${Math.round(n).toLocaleString()}`;

/** Development economics for a representative 40-acre parcel in each county. */
const MODEL_ACRES = 40;

function countyEconomics() {
  return Object.values(COUNTY_PRESETS)
    .filter((p) => p.key !== 'Default')
    .map((p) => {
      const y = estimateYield(MODEL_ACRES, p);
      const devCost = infraCost(y.roadLF, y.lots, p.urban);
      const f = feasibility(y.lots, devCost, {
        lotPrice: p.lotPrice,
        absorption: p.absorption,
        asking: 0, // maxOffer is what we want here, not an offer verdict
      });
      return {
        county: p.key,
        label: p.label,
        lots: y.lots,
        netAcres: y.netAcres,
        devCost,
        lotPrice: p.lotPrice,
        grossRevenue: f.grossRevenue,
        maxOffer: f.maxOffer,
        months: f.months,
        perAcreOffer: y.lots > 0 ? Math.round(f.maxOffer / MODEL_ACRES) : 0,
      };
    })
    .sort((a, b) => b.maxOffer - a.maxOffer);
}

export default function LandAnalysisReport() {
  const [generatedAt, setGeneratedAt] = useState('');
  const ranked = landValuesRanked();
  const byCounty = landValuesByCounty();
  const economics = countyEconomics();
  const forecast = generateForecast(getMarketTrends(), 6);

  // Stamped client-side: a server-rendered date would mismatch on hydration.
  useEffect(() => {
    setGeneratedAt(
      new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    );
  }, []);

  const topMarket = ranked[0];
  const bottomMarket = ranked[ranked.length - 1];
  const spread = topMarket && bottomMarket ? Math.round(topMarket.perAcre / bottomMarket.perAcre) : 0;

  return (
    <div className="sf-report bg-gray-100 min-h-screen py-8 print:bg-white print:py-0">
      {/* Screen-only toolbar */}
      <div className="sf-no-print max-w-[8.5in] mx-auto mb-6 flex items-center justify-between px-4">
        <Link href="/analytics" className="text-sm text-gray-600 hover:text-gray-900">
          ← Back to Analytics
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-500 hidden sm:inline">
            Save as PDF from the print dialog
          </span>
          <button
            onClick={() => window.print()}
            className="btn-primary px-5 py-2.5 rounded-xl text-sm font-semibold"
          >
            Download PDF
          </button>
        </div>
      </div>

      {/* Page */}
      <article className="sf-sheet max-w-[8.5in] mx-auto bg-white shadow-sm print:shadow-none px-[0.75in] py-[0.6in] print:p-0">
        {/* Masthead */}
        <header className="flex items-start justify-between border-b-2 pb-4 mb-6" style={{ borderColor: 'var(--primary)' }}>
          <div>
            <div className="text-2xl font-bold tracking-tight" style={{ color: 'var(--primary)' }} data-company-name>
              SummitForge
            </div>
            <div className="text-[11px] uppercase tracking-widest text-gray-500 mt-0.5">
              Land Development Analysis
            </div>
          </div>
          <div className="text-right text-[11px] text-gray-500 leading-relaxed">
            <div>{generatedAt || ' '}</div>
            <div data-phone>(208) 745-5911</div>
            <div>Archibald-Bagley Real Estate</div>
          </div>
        </header>

        <h1 className="text-[26px] font-bold tracking-tight leading-tight mb-1">
          Eastern Idaho Raw Land — Market &amp; Feasibility Review
        </h1>
        <p className="text-sm text-gray-600 mb-6">{COVERAGE_COUNTIES_LABEL} counties</p>

        {/* Executive summary */}
        <section className="mb-7">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-900 mb-2 pb-1 border-b">
            Executive Summary
          </h2>
          <p className="text-[13px] leading-relaxed text-gray-800">
            Raw land across the seven-county Eastern Idaho footprint spans roughly a{' '}
            <strong>{spread}× range</strong> in per-acre value, from{' '}
            <strong>{money(bottomMarket.perAcre)}/acre</strong> in {bottomMarket.market} to{' '}
            <strong>{money(topMarket.perAcre)}/acre</strong> in {topMarket.market}. The Teton Valley
            resort corridor and the Rexburg growth corridor lead on both price and appreciation, while
            Bingham and Fremont ground remains the value end of the market. Development economics below
            model a representative {MODEL_ACRES}-acre parcel in each county using adopted local street
            standards and 2026 ISPWC-based infrastructure costs.
          </p>
        </section>

        {/* Values by county */}
        <section className="mb-7">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-900 mb-2 pb-1 border-b">
            Land Values by County
          </h2>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1.5 font-semibold">County</th>
                <th className="py-1.5 font-semibold text-right">Avg $/Acre</th>
                <th className="py-1.5 font-semibold">Range</th>
                <th className="py-1.5 font-semibold text-right">Markets</th>
              </tr>
            </thead>
            <tbody>
              {byCounty.map((c) => (
                <tr key={c.county} className="border-t">
                  <td className="py-1.5 font-medium">{c.county}</td>
                  <td className="py-1.5 text-right font-semibold">{money(c.avgPerAcre)}</td>
                  <td className="py-1.5 text-gray-600">
                    {c.low.market} {money(c.low.perAcre)} — {c.high.market} {money(c.high.perAcre)}
                  </td>
                  <td className="py-1.5 text-right text-gray-600">{c.markets.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        {/* Market detail */}
        <section className="mb-7">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-900 mb-2 pb-1 border-b">
            Market Detail
          </h2>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1.5 font-semibold">Market</th>
                <th className="py-1.5 font-semibold">County</th>
                <th className="py-1.5 font-semibold text-right">$/Acre</th>
                <th className="py-1.5 font-semibold text-right">YoY</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((v) => (
                <tr key={v.market} className="border-t">
                  <td className="py-1.5 font-medium">{v.market}</td>
                  <td className="py-1.5 text-gray-600">{v.county}</td>
                  <td className="py-1.5 text-right font-semibold">{money(v.perAcre)}</td>
                  <td className="py-1.5 text-right">
                    {v.yoyPct != null ? (
                      <span className="text-emerald-700 font-medium">+{v.yoyPct}%</span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="sf-page-break" />

        {/* Development economics */}
        <section className="mb-7">
          <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-900 mb-2 pb-1 border-b">
            Development Economics — {MODEL_ACRES}-Acre Model Parcel
          </h2>
          <p className="text-[11px] text-gray-600 mb-3 leading-relaxed">
            Lot yield net of right-of-way, infrastructure at ISPWC planning ranges, and the maximum
            supportable land offer after commission, financing carry, G&amp;A, and a 20% target margin.
            Max offer is what the parcel can pay for the dirt — not an appraisal.
          </p>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1.5 font-semibold">County</th>
                <th className="py-1.5 font-semibold text-right">Lots</th>
                <th className="py-1.5 font-semibold text-right">Lot Price</th>
                <th className="py-1.5 font-semibold text-right">Dev Cost</th>
                <th className="py-1.5 font-semibold text-right">Gross Rev</th>
                <th className="py-1.5 font-semibold text-right">Max Offer</th>
                <th className="py-1.5 font-semibold text-right">Sellout</th>
              </tr>
            </thead>
            <tbody>
              {economics.map((e) => (
                <tr key={e.county} className="border-t">
                  <td className="py-1.5 font-medium">{e.county}</td>
                  <td className="py-1.5 text-right">{e.lots}</td>
                  <td className="py-1.5 text-right">{money(e.lotPrice)}</td>
                  <td className="py-1.5 text-right text-gray-600">{money(e.devCost)}</td>
                  <td className="py-1.5 text-right">{money(e.grossRevenue)}</td>
                  <td className="py-1.5 text-right font-semibold" style={{ color: 'var(--primary)' }}>
                    {money(e.maxOffer)}
                  </td>
                  <td className="py-1.5 text-right text-gray-600">{e.months} mo</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-gray-500 mt-2">
            Model parcel: {MODEL_ACRES} gross acres. Lot size, road factor, finished-lot price, and
            absorption per county preset. Sellout = lots ÷ monthly absorption.
          </p>
        </section>

        {/* Forecast */}
        {forecast.length > 0 && (
          <section className="mb-7">
            <h2 className="text-[13px] font-bold uppercase tracking-wider text-gray-900 mb-2 pb-1 border-b">
              Six-Month Outlook
            </h2>
            <table className="w-full text-[12px] border-collapse">
              <thead>
                <tr className="text-left text-gray-500">
                  <th className="py-1.5 font-semibold">Period</th>
                  <th className="py-1.5 font-semibold text-right">$/Sq Ft</th>
                  <th className="py-1.5 font-semibold text-right">Days on Market</th>
                  <th className="py-1.5 font-semibold text-right">Absorption</th>
                  <th className="py-1.5 font-semibold text-right">Confidence</th>
                </tr>
              </thead>
              <tbody>
                {forecast.map((f: any, i: number) => (
                  <tr key={i} className="border-t">
                    <td className="py-1.5 font-medium">{f.period}</td>
                    <td className="py-1.5 text-right">${f.predictedPricePerSqFt}</td>
                    <td className="py-1.5 text-right">{f.predictedDOM}</td>
                    <td className="py-1.5 text-right">{f.predictedAbsorption}%</td>
                    <td className="py-1.5 text-right text-gray-600">{f.confidence}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Methodology + disclaimer */}
        <section className="mt-8 pt-4 border-t">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-700 mb-2">
            Methodology &amp; Disclaimer
          </h2>
          <p className="text-[10px] leading-relaxed text-gray-600">
            Lot yield is computed net of a county-specific right-of-way factor and adopted local street
            standards. Infrastructure costs use 2026 ISPWC-based planning ranges for roadway, water,
            sewer or septic, power, and storm. Feasibility applies a 6% disposition commission, 70%
            financing at 11%, monthly G&amp;A, and a 20% target developer margin. Per-acre values are
            planning figures for the markets shown and are not an appraisal, a broker price opinion,
            or a substitute for site-specific due diligence on zoning, water rights, access, wetlands,
            or utility capacity. Figures are estimates and subject to change with market conditions.
          </p>
          <p className="text-[10px] leading-relaxed text-gray-600 mt-2">
            Prepared by Archibald-Bagley Real Estate · Rigby, Idaho · Generated {generatedAt || 'on request'} by SummitForge RE OS.
          </p>
        </section>
      </article>
    </div>
  );
}
