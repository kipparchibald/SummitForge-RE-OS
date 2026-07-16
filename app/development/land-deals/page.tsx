'use client';
import { useEffect, useState } from 'react';

const money = (n: number) => '$' + Math.round(n).toLocaleString();

export default function LandDealsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [minAcres, setMinAcres] = useState(5);

  async function load(min = minAcres) {
    setLoading(true); setErr('');
    try {
      const r = await fetch(`/api/development/land-scan?minAcres=${min}`);
      const j = await r.json();
      if (j.error) throw new Error(j.error);
      setData(j);
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const deals = data?.all ?? [];
  return (
    <div className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-bold text-slate-800">Land Deals — Development Pipeline</h1>
      <p className="mt-1 text-sm text-slate-500">
        Raw-land listings scored for subdivision upside (Snake River MLS / Archibald-Bagley).
        {data && <> Source: {data.source} · scanned {data.listingsScanned} · analyzed {data.analyzed} · <b>{data.dealsPenciling} pencil</b>.</>}
      </p>

      <div className="my-4 flex items-center gap-3 text-sm">
        <label>Min acres:</label>
        <select className="rounded border px-2 py-1" value={minAcres}
          onChange={e => { const m = +e.target.value; setMinAcres(m); load(m); }}>
          <option value={3}>3</option><option value={5}>5</option><option value={10}>10</option><option value={20}>20</option>
        </select>
        <button className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700"
          onClick={() => load()}>Refresh</button>
      </div>

      {loading && <p className="text-slate-500">Scanning listings…</p>}
      {err && <p className="text-red-600">Error: {err}</p>}
      {!loading && !err && (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-slate-800 text-white">
              <tr>
                {['Listing', 'County', 'Acres', 'Lots', 'List', 'Infra cost', 'Max offer', 'Spread', 'Verdict'].map((h, i) => (
                  <th key={h} className={`px-3 py-2 ${i >= 2 && i <= 7 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deals.map((d: any, i: number) => (
                <tr key={d.id ?? i} className={i % 2 ? 'bg-slate-50' : 'bg-white'}>
                  <td className="px-3 py-2">
                    {d.url ? <a className="text-sky-700 hover:underline" href={d.url} target="_blank" rel="noreferrer">{d.address}</a> : d.address}
                  </td>
                  <td className="px-3 py-2">{d.county}</td>
                  <td className="px-3 py-2 text-right">{d.acres}</td>
                  <td className="px-3 py-2 text-right">{d.lots}</td>
                  <td className="px-3 py-2 text-right">{money(d.price)}</td>
                  <td className="px-3 py-2 text-right">{money(d.devCost)}</td>
                  <td className="px-3 py-2 text-right">{money(d.maxOffer)}</td>
                  <td className={`px-3 py-2 text-right font-bold ${d.spread >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                    {d.spread >= 0 ? '+' : '-'}{money(Math.abs(d.spread))}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`rounded px-2 py-0.5 text-xs font-bold text-white ${d.verdict === 'OFFER' ? 'bg-green-700' : 'bg-red-600'}`}>
                      {d.verdict}
                    </span>
                  </td>
                </tr>
              ))}
              {deals.length === 0 && <tr><td className="px-3 py-3 text-slate-500" colSpan={9}>No land listings in this window.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-xs text-slate-400">
        Planning-grade estimates using calibrated Idaho comps &amp; ISPWC costs. Max offer = most payable at a 20% target
        return with financing carry &amp; absorption. Verify with a licensed PLS/PE and county P&amp;Z before offering.
      </p>
    </div>
  );
}
