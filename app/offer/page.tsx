'use client';

import React, { useEffect, useMemo, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  DEMO_COMPS,
  DEMO_PROPERTIES,
  evaluateOffer,
  type OfferProperty,
  type OfferTerms,
} from '@/lib/offer/engine';
import StatusBadge from '@/components/ui/StatusBadge';
import { toastSuccess } from '@/lib/toast/store';

function money(n: number) {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function winTone(p: number): 'success' | 'warning' | 'danger' | 'info' {
  if (p >= 70) return 'success';
  if (p >= 45) return 'warning';
  return 'danger';
}

function propertyFromParams(sp: URLSearchParams | null): OfferProperty | null {
  if (!sp) return null;
  const address = sp.get('address');
  const price = Number(sp.get('price') || 0);
  if (!address || !price) return null;
  return {
    address,
    listPrice: price,
    sqft: Number(sp.get('sqft') || 0) || undefined,
    acres: Number(sp.get('acres') || 0) || undefined,
    isLand: sp.get('land') === '1',
    daysOnMarket: Number(sp.get('dom') || 0) || 14,
    city: /ririe/i.test(address) ? 'Ririe' : 'Rigby',
    propertyType: sp.get('land') === '1' ? 'Land' : 'Single Family',
  };
}

function OfferDecisionInner() {
  const searchParams = useSearchParams();
  const [property, setProperty] = useState<OfferProperty>(DEMO_PROPERTIES[0]);
  const [offerPrice, setOfferPrice] = useState(String(DEMO_PROPERTIES[0].listPrice));
  const [earnest, setEarnest] = useState(String(Math.round(DEMO_PROPERTIES[0].listPrice * 0.02)));
  const [closingDays, setClosingDays] = useState('30');
  const [cash, setCash] = useState(false);
  const [inspection, setInspection] = useState(true);
  const [financing, setFinancing] = useState(true);
  const [appraisal, setAppraisal] = useState(true);
  const [useEscalation, setUseEscalation] = useState(false);
  const [escalationMax, setEscalationMax] = useState(
    String(Math.round(DEMO_PROPERTIES[0].listPrice * 1.03))
  );
  const [fromLink, setFromLink] = useState(false);

  useEffect(() => {
    const fromQ = propertyFromParams(searchParams);
    if (fromQ) {
      setProperty(fromQ);
      setOfferPrice(String(fromQ.listPrice));
      setEarnest(String(Math.round(fromQ.listPrice * 0.02)));
      setEscalationMax(String(Math.round(fromQ.listPrice * 1.03)));
      setFromLink(true);
    }
  }, [searchParams]);

  const terms: OfferTerms = useMemo(
    () => ({
      offerPrice: Number(offerPrice) || 0,
      earnestMoney: Number(earnest) || 0,
      closingDays: Number(closingDays) || 30,
      cash,
      inspectionContingency: inspection,
      financingContingency: cash ? false : financing,
      appraisalContingency: cash ? false : appraisal,
      escalationMax: useEscalation ? Number(escalationMax) || undefined : undefined,
      escalationOver: useEscalation ? 1000 : undefined,
    }),
    [offerPrice, earnest, closingDays, cash, inspection, financing, appraisal, useEscalation, escalationMax]
  );

  const decision = useMemo(() => evaluateOffer(property, terms, DEMO_COMPS), [property, terms]);

  const selectDemo = (p: OfferProperty) => {
    setProperty(p);
    setOfferPrice(String(p.listPrice));
    setEarnest(String(Math.round(p.listPrice * 0.02)));
    setEscalationMax(String(Math.round(p.listPrice * 1.03)));
    setFromLink(false);
  };

  const applyRecommended = () => {
    setOfferPrice(String(decision.recommendedPrice));
    setEarnest(String(decision.suggestedEarnest));
    setClosingDays(String(decision.suggestedClosingDays));
    toastSuccess('Applied data-backed recommendation');
  };

  const copyBrief = async () => {
    const text = [
      `OFFER DECISION BRIEF — ${property.address}`,
      `List: ${money(property.listPrice)} · Offer: ${money(terms.offerPrice)} (${Math.round(decision.pctOfList * 100)}% of list)`,
      `Win probability: ${decision.winProbability}% (${decision.confidence} confidence)`,
      ``,
      decision.narrative,
      ``,
      `Strengths:`,
      ...decision.strengths.map((s) => `• ${s}`),
      `Risks:`,
      ...decision.risks.map((r) => `• ${r}`),
      decision.escalationAdvice ? `\n${decision.escalationAdvice}` : '',
      ``,
      `Suggested band: ${money(decision.recommendedPriceLow)} – ${money(decision.recommendedPriceHigh)}`,
      `— SummitForge Offer Decision Engine · Archibald-Bagley`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await navigator.clipboard.writeText(text);
      toastSuccess('Brief copied — paste into email or text');
    } catch {
      toastSuccess('Brief ready (clipboard blocked — select from screen)');
    }
  };

  return (
    <div className="min-h-[calc(100vh-60px)] bg-zinc-950 text-white">
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div>
            <p className="text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-1">
              Game-changer · Demo data
            </p>
            <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">Offer Decision Engine</h1>
            <p className="text-zinc-400 mt-1 text-sm sm:text-base max-w-2xl">
              Know your odds before you write. Win probability from comps, days on market, and terms —
              then copy a client-ready brief. Works fully offline until Navica is live.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/cma" className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm">
              Open CMA →
            </Link>
            <Link href="/transactions" className="px-3 py-2 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm">
              Transactions
            </Link>
          </div>
        </div>

        {fromLink && (
          <div className="rounded-xl border border-emerald-900 bg-emerald-950/40 px-4 py-2.5 text-sm text-emerald-200">
            Loaded from match / listing / CMA link — tune terms below and copy the brief for your client.
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {DEMO_PROPERTIES.map((p) => (
            <button
              key={p.address}
              type="button"
              onClick={() => selectDemo(p)}
              className={`px-3 py-2 rounded-xl text-xs sm:text-sm border transition ${
                !fromLink && property.address === p.address
                  ? 'border-emerald-500 bg-emerald-950/50 text-emerald-300'
                  : 'border-zinc-700 bg-zinc-900 text-zinc-400 hover:border-zinc-500'
              }`}
            >
              {p.address.split(',')[0]}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
              <div className="text-sm font-semibold text-zinc-200">Property</div>
              <div className="text-lg font-medium">{property.address}</div>
              <div className="text-sm text-zinc-400">
                List {money(property.listPrice)}
                {property.sqft ? ` · ${property.sqft.toLocaleString()} sqft` : ''}
                {property.acres ? ` · ${property.acres} ac` : ''}
                {property.daysOnMarket != null ? ` · ${property.daysOnMarket} DOM` : ''}
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-4 space-y-3">
              <div className="text-sm font-semibold text-zinc-200">Your offer</div>
              <label className="block text-xs text-zinc-500">Offer price</label>
              <input className="w-full border border-zinc-700 bg-zinc-950 rounded-xl px-3 py-2 text-sm" value={offerPrice} onChange={(e) => setOfferPrice(e.target.value)} />
              <label className="block text-xs text-zinc-500">Earnest money</label>
              <input className="w-full border border-zinc-700 bg-zinc-950 rounded-xl px-3 py-2 text-sm" value={earnest} onChange={(e) => setEarnest(e.target.value)} />
              <label className="block text-xs text-zinc-500">Closing days</label>
              <input className="w-full border border-zinc-700 bg-zinc-950 rounded-xl px-3 py-2 text-sm" value={closingDays} onChange={(e) => setClosingDays(e.target.value)} />

              <div className="space-y-2 pt-1 text-sm text-zinc-300">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={cash} onChange={(e) => setCash(e.target.checked)} />
                  Cash offer
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={inspection} onChange={(e) => setInspection(e.target.checked)} />
                  Inspection contingency
                </label>
                {!cash && (
                  <>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={financing} onChange={(e) => setFinancing(e.target.checked)} />
                      Financing contingency
                    </label>
                    <label className="flex items-center gap-2">
                      <input type="checkbox" checked={appraisal} onChange={(e) => setAppraisal(e.target.checked)} />
                      Appraisal contingency
                    </label>
                  </>
                )}
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={useEscalation} onChange={(e) => setUseEscalation(e.target.checked)} />
                  Escalation clause
                </label>
                {useEscalation && (
                  <>
                    <label className="block text-xs text-zinc-500">Escalation max</label>
                    <input className="w-full border border-zinc-700 bg-zinc-950 rounded-xl px-3 py-2 text-sm" value={escalationMax} onChange={(e) => setEscalationMax(e.target.value)} />
                  </>
                )}
              </div>

              <button type="button" onClick={applyRecommended} className="w-full py-2.5 rounded-xl border border-emerald-800 bg-emerald-950/40 text-emerald-300 text-sm hover:bg-emerald-950/70">
                Apply recommended terms
              </button>
            </div>
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-30 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-600/30 via-transparent to-transparent" />
              <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <div className="text-sm text-zinc-400 mb-1">Win probability</div>
                  <div className="text-5xl font-bold tracking-tight tabular-nums">
                    {decision.winProbability}
                    <span className="text-2xl text-zinc-500">%</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <StatusBadge
                      label={winTone(decision.winProbability) === 'success' ? 'Strong' : winTone(decision.winProbability) === 'warning' ? 'Competitive' : 'Uphill'}
                      tone={winTone(decision.winProbability)}
                    />
                    <StatusBadge label={`${decision.confidence} confidence`} tone="info" showDot={false} />
                  </div>
                </div>
                <div className="text-sm text-zinc-400 space-y-1 sm:text-right">
                  <div>Price score · {decision.priceScore}</div>
                  <div>Terms score · {decision.termsScore}</div>
                  <div>Market score · {decision.marketScore}</div>
                  <div className="text-zinc-300 pt-1">{Math.round(decision.pctOfList * 100)}% of list</div>
                </div>
              </div>
              <p className="relative mt-5 text-sm text-zinc-300 leading-relaxed">{decision.narrative}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Target band</div>
                <div className="text-sm font-semibold mt-1">
                  {money(decision.recommendedPriceLow)} – {money(decision.recommendedPriceHigh)}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Suggested earnest</div>
                <div className="text-sm font-semibold mt-1">{money(decision.suggestedEarnest)}</div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4">
                <div className="text-[11px] uppercase tracking-wide text-zinc-500">Suggested close</div>
                <div className="text-sm font-semibold mt-1">{decision.suggestedClosingDays} days</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-sm font-semibold text-emerald-400 mb-2">Strengths</div>
                <ul className="text-sm text-zinc-300 space-y-1.5">
                  {decision.strengths.length === 0 && <li className="text-zinc-500">Tune price or terms to build strengths</li>}
                  {decision.strengths.map((s) => (
                    <li key={s} className="flex gap-2"><span className="text-emerald-500">✓</span><span>{s}</span></li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
                <div className="text-sm font-semibold text-amber-400 mb-2">Risks</div>
                <ul className="text-sm text-zinc-300 space-y-1.5">
                  {decision.risks.length === 0 && <li className="text-zinc-500">No major risks flagged</li>}
                  {decision.risks.map((r) => (
                    <li key={r} className="flex gap-2"><span className="text-amber-500">!</span><span>{r}</span></li>
                  ))}
                </ul>
              </div>
            </div>

            {decision.escalationAdvice && (
              <div className="rounded-2xl border border-sky-900 bg-sky-950/30 p-4 text-sm text-sky-100">
                {decision.escalationAdvice}
              </div>
            )}

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
              <div className="text-sm font-semibold mb-2">Comps used</div>
              <ul className="text-xs sm:text-sm text-zinc-400 space-y-1">
                {decision.compsUsed.map((c) => (
                  <li key={c.address} className="flex justify-between gap-2">
                    <span className="truncate">{c.address}</span>
                    <span className="shrink-0 tabular-nums">
                      {money(c.soldPrice)}
                      {c.saleToList ? ` · ${Math.round(c.saleToList * 100)}%` : ''}
                      {` · ${c.daysOnMarket}d`}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={copyBrief} className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">
                Copy decision brief
              </button>
              <Link href="/transactions" className="px-5 py-2.5 rounded-xl border border-zinc-700 bg-zinc-900 hover:bg-zinc-800 text-sm">
                Open transaction file
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OfferDecisionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center bg-zinc-950 text-zinc-500 text-sm">
          Loading offer engine…
        </div>
      }
    >
      <OfferDecisionInner />
    </Suspense>
  );
}
