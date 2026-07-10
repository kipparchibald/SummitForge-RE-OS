'use client';
import { useState } from 'react';

const money = (n: number) => '$' + Math.round(n).toLocaleString();

type Listing = { acres?: number; price?: number; address?: string; lat?: number; lng?: number; apn?: string; rawData?: any };

/**
 * Drop-in widget for a land-listing detail page.
 * Shows the buy/pass verdict (fast, acres+price) and can generate an on-parcel
 * intelligent plat from the real GIS parcel geometry.
 */
export default function DevelopmentPotential({ listing }: { listing: Listing }) {
  const [a, setA] = useState<any>(null);
  const [plat, setPlat] = useState<any>(null);
  const [busy, setBusy] = useState<'' | 'analyze' | 'plat'>('');
  const [err, setErr] = useState('');

  async function analyze() {
    setBusy('analyze'); setErr('');
    try {
      const r = await fetch('/api/development/analyze', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setA(j);
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  }

  async function generatePlat() {
    setBusy('plat'); setErr('');
    try {
      const r = await fetch('/api/development/plat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: listing.lat ?? listing.rawData?.Latitude, lng: listing.lng ?? listing.rawData?.Longitude,
          apn: listing.apn ?? listing.rawData?.ParcelNumber, county: a?.county,
        }),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setPlat(j);
    } catch (e: any) { setErr(e.message); } finally { setBusy(''); }
  }

  return (
    <div className="rounded-xl border border-slate-200 p-4 max-w-md">
      <h3 className="text-lg font-semibold text-slate-800">Development Potential</h3>
      <p className="text-sm text-slate-500 mb-2">Concept subdivision analysis — not a survey.</p>

      {!a && (
        <button onClick={analyze} disabled={busy === 'analyze'}
          className="rounded bg-amber-600 px-3 py-2 font-semibold text-white hover:bg-amber-700 disabled:opacity-60">
          {busy === 'analyze' ? 'Analyzing…' : '▶ Run analysis'}
        </button>
      )}
      {err && <p className="text-red-600 text-sm mt-2">{err}</p>}

      {a && (
        <>
          <div className={`text-center rounded p-2 text-white font-bold ${a.verdict === 'OFFER' ? 'bg-green-700' : 'bg-red-600'}`}>
            {a.verdict === 'OFFER' ? '✅ Pencils at list price' : '⛔ Above development value at list'}
            <div className="text-xs font-normal mt-0.5">
              Max offer {money(a.maxOffer)} · list {money(a.asking)}
            </div>
          </div>
          <ul className="text-sm mt-2 space-y-1">
            <li className="flex justify-between border-b border-dotted"><span>Concept lots ({a.preset})</span><b>{a.lots}</b></li>
            <li className="flex justify-between border-b border-dotted"><span>Infrastructure cost</span><b>{money(a.devCost)}</b></li>
            <li className="flex justify-between border-b border-dotted"><span>Profit at list</span><b>{money(a.profitAtList)} ({(a.marginAtList * 100).toFixed(1)}%)</b></li>
          </ul>
          <button onClick={generatePlat} disabled={busy === 'plat'}
            className="mt-3 rounded bg-slate-800 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-60">
            {busy === 'plat' ? 'Generating plat…' : '🗺 Generate on-parcel plat'}
          </button>
        </>
      )}

      {plat?.svg && (
        <div className="mt-3">
          <div className="text-sm text-slate-600 mb-1">
            {plat.metrics.lots} lots · {plat.metrics.roadLF.toLocaleString()} LF road · {plat.metrics.acres} ac (from GIS geometry)
          </div>
          <div className="rounded border" dangerouslySetInnerHTML={{ __html: plat.svg }} />
        </div>
      )}
    </div>
  );
}
