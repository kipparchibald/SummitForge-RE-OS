'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { loadPlatParcel, clearPlatParcel } from '@/lib/development/plat-handoff';

const money = (n: number) => '$' + Math.round(n).toLocaleString();

type InfraLine = {
  key: string;
  label: string;
  unit: string;
  unitCost: number;
  qty: number;
  total: number;
};

type InfraBreakdown = {
  profile: string;
  profileLabel: string;
  roadLF: number;
  lots: number;
  construction: number;
  mobilization: number;
  engineering: number;
  permitsFees: number;
  contingency: number;
  total: number;
  perLot: number;
  perRoadLF: number;
  lineItems: InfraLine[];
  notes: string[];
};

type Feasibility = {
  verdict: string;
  maxOffer: number;
  asking: number;
  lots: number;
  acres: number;
  devCost: number;
  profitAtList: number;
  marginAtList: number;
  county: string;
  preset: string;
  spread: number;
  scenario?: string;
  urban?: boolean;
  infra?: InfraBreakdown;
  roadLF?: number;
};

type PlatResult = {
  metrics: {
    acres: number;
    lots: number;
    roadLF: number;
    avgLotAcres: number;
    density: number;
    doubleLoadedPct?: number;
    roadPerLot?: number;
    coveragePct?: number;
    roadAcres?: number;
    lotAcresTotal?: number;
  };
  design: {
    source: string;
    lotWidthFt: number;
    lotDepthFt: number;
    rowFt: number;
    pavementFt?: number;
    medianLotAcres?: number;
    axis?: string;
    roadCount?: number;
    crossStreetCount?: number;
    zoningCode?: string;
    zoningLabel?: string;
  };
  svg: string;
  geometrySource?: string;
  county?: string;
  aiInsights?: string | null;
  pin?: string | null;
  layoutNotes?: string[];
  zoning?: {
    code: string;
    label: string;
    minLotAcres: number;
    minFrontageFt: number;
    minDepthFt?: number;
    rowFt: number;
    pavementFt: number;
    maxDensityPerAcre: number | null;
    source: string;
    notes: string[];
    jurisdiction?: string;
    urban?: boolean;
    waterSewer?: boolean;
    curbGutter?: boolean;
  };
  scenario?: string;
  annexation?: {
    active: boolean;
    city?: string;
    zone?: string;
    services?: string[];
    minLotSqFt?: number;
    minFrontageFt?: number;
  };
  infra?: InfraBreakdown;
  feasibility?: Feasibility | null;
  neighborhood?: {
    sampleSize: number;
    medianLotAcres: number;
    medianFrontageFt: number;
    preferredAxis: string;
    maxBlockFt: number;
    notes: string[];
  } | null;
};

const PRESETS = [
  {
    label: '40 ac Terreton concept',
    address: 'Sample 40 acres near Terreton, ID',
    acres: 40,
    price: 620000,
    lat: 43.85,
    lng: -112.43,
    county: 'Jefferson',
  },
  {
    label: '12.5 ac Rigby',
    address: '12.5 acres near Rigby, ID',
    acres: 12.5,
    price: 650000,
    lat: 43.672,
    lng: -111.915,
    county: 'Jefferson',
  },
  {
    label: '47 ac Idaho Falls',
    address: '4500 E Sunnyside, Idaho Falls, ID',
    acres: 47.3,
    price: 2350000,
    lat: 43.466,
    lng: -111.95,
    county: 'Bonneville',
  },
];

export default function AiPlatStudioPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[50vh] flex items-center justify-center text-sm text-neutral-500">
          Loading AI Plat Studio…
        </div>
      }
    >
      <AiPlatStudioInner />
    </Suspense>
  );
}

function AiPlatStudioInner() {
  const searchParams = useSearchParams();
  const [address, setAddress] = useState(PRESETS[0].address);
  const [acres, setAcres] = useState(String(PRESETS[0].acres));
  const [price, setPrice] = useState(String(PRESETS[0].price));
  const [lat, setLat] = useState(String(PRESETS[0].lat));
  const [lng, setLng] = useState(String(PRESETS[0].lng));
  const [county, setCounty] = useState(PRESETS[0].county);
  const [conceptOnly, setConceptOnly] = useState(true);
  const [withAi, setWithAi] = useState(true);
  /** Project plat as if annexed into City of Rigby R-1 (city density + utilities) */
  const [annexRigbyR1, setAnnexRigbyR1] = useState(false);
  const [busy, setBusy] = useState<'analyze' | 'plat' | 'both' | ''>('');
  const [err, setErr] = useState('');
  const [feas, setFeas] = useState<Feasibility | null>(null);
  const [plat, setPlat] = useState<PlatResult | null>(null);
  const [gisPin, setGisPin] = useState('');
  /** Real GIS boundary [lng,lat][] — always preferred over concept square */
  const [gisRing, setGisRing] = useState<[number, number][] | null>(null);
  const [boundaryNote, setBoundaryNote] = useState('');

  // Hydrate from GIS explorer deep-link + session ring handoff
  useEffect(() => {
    const pLat = searchParams.get('lat');
    const pLng = searchParams.get('lng');
    const pAcres = searchParams.get('acres');
    const pCounty = searchParams.get('county');
    const pAddr = searchParams.get('address');
    const pPin = searchParams.get('pin');
    const fromGis = searchParams.get('from') === 'gis';

    const handoff = loadPlatParcel();
    if (handoff && Array.isArray(handoff.ring) && handoff.ring.length >= 3) {
      const ring = handoff.ring;
      setGisRing(ring);
      setConceptOnly(false);
      setBoundaryNote(
        `Using real GIS boundary (${ring.length} vertices)${
          handoff.pin ? ` · PIN ${handoff.pin}` : ''
        } — full-coverage plat (no leftover land).`
      );
      if (handoff.lat != null) setLat(String(handoff.lat));
      if (handoff.lng != null) setLng(String(handoff.lng));
      if (handoff.acres != null) setAcres(String(handoff.acres));
      if (handoff.county) setCounty(handoff.county);
      if (handoff.address) setAddress(handoff.address);
      if (handoff.pin) setGisPin(handoff.pin);
      if (handoff.askPrice) setPrice(String(handoff.askPrice));
      return;
    }

    if (!pLat && !pLng && !pPin && !pAcres) return;
    if (pLat) setLat(pLat);
    if (pLng) setLng(pLng);
    if (pAcres) setAcres(pAcres);
    if (pCounty) setCounty(pCounty);
    if (pAddr) setAddress(pAddr);
    if (pPin) {
      setGisPin(pPin);
      setAddress((a) => (a && a !== PRESETS[0].address ? a : `PIN ${pPin}`));
    }
    // Real GIS coords/pin — never use concept square
    if (pLat && pLng) {
      setConceptOnly(false);
      setBoundaryNote(
        fromGis
          ? 'Loading boundary from PIN/coords (re-open from GIS if the outline is not the curved lot you selected).'
          : 'Live GIS match by coordinates/PIN (concept square off).'
      );
    }
  }, [searchParams]);

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setAddress(p.address);
    setAcres(String(p.acres));
    setPrice(String(p.price));
    setLat(String(p.lat));
    setLng(String(p.lng));
    setCounty(p.county);
    setGisPin('');
    setGisRing(null);
    setBoundaryNote('');
    clearPlatParcel();
    setConceptOnly(true);
    setFeas(null);
    setPlat(null);
    setErr('');
  };

  const runAnalyze = async () => {
    setBusy('analyze');
    setErr('');
    try {
      const r = await fetch('/api/development/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listing: {
            address,
            acres: Number(acres),
            price: Number(price),
          },
          assumptions: {
            county,
            scenario: annexRigbyR1 ? 'rigby_r1_annexed' : 'county',
          },
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Analysis failed');
      setFeas(j);
      return j as Feasibility;
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Analysis failed');
      return null;
    } finally {
      setBusy('');
    }
  };

  const runPlat = async (f?: Feasibility | null) => {
    setBusy('plat');
    setErr('');
    try {
      const hasRing = Array.isArray(gisRing) && gisRing.length >= 3;
      // Never concept-square when we have a real ring or GIS pin/coords
      const useConcept = conceptOnly && !hasRing && !gisPin;
      const r = await fetch('/api/development/plat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address,
          acres: Number(acres),
          price: Number(price),
          lat: lat ? Number(lat) : undefined,
          lng: lng ? Number(lng) : undefined,
          apn: gisPin || undefined,
          pin: gisPin || undefined,
          county: county || f?.county,
          ring: hasRing ? gisRing : undefined,
          concept: useConcept,
          withAi,
          scenario: annexRigbyR1 ? 'rigby_r1_annexed' : 'county',
          annexRigbyR1,
        }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error || 'Plat failed');
      setPlat(j);
      // Prefer feasibility built from actual plat yield + city/county infra
      if (j.feasibility) setFeas(j.feasibility as Feasibility);
      if (j.geometrySource === 'concept') {
        setBoundaryNote(
          'Concept square used — select a parcel on GIS and Open in AI Plat Studio for the real curved boundary.'
        );
      } else if (j.geometrySource === 'provided-ring' || j.geometrySource === 'gis') {
        setBoundaryNote(
          `Platted on real ${j.geometrySource === 'provided-ring' ? 'selected' : 'matched'} parcel boundary · coverage ${j.metrics?.coveragePct ?? '—'}%` +
            (j.scenario === 'rigby_r1_annexed' ? ' · Rigby R-1 annexation density' : '')
        );
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Plat failed');
    } finally {
      setBusy('');
    }
  };

  const runBoth = async () => {
    setBusy('both');
    setErr('');
    setPlat(null);
    const f = await runAnalyze();
    setBusy('both');
    await runPlat(f);
    setBusy('');
  };

  return (
    <div className="min-h-[calc(100vh-60px)] bg-gradient-to-b from-slate-950 via-slate-900 to-zinc-950 text-white">
      <div className="mx-auto max-w-6xl p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-8">
          <div>
            <p className="text-emerald-400 text-sm font-medium mb-1">Flagship · AI + GIS</p>
            <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">AI Plat Studio</h1>
            <p className="text-zinc-400 mt-2 max-w-xl">
              Zoning-aware layout that maximizes lots, minimizes roads, double-loads every street,
              and learns lot modules from nearby subdivisions on GIS.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/development/land-deals"
              className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm hover:bg-zinc-700"
            >
              Land pipeline
            </Link>
            <Link
              href="/monitoring"
              className="px-4 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm hover:bg-zinc-700"
            >
              GIS map
            </Link>
            <Link
              href="/cma"
              className="px-4 py-2 rounded-xl bg-emerald-600 text-sm font-medium hover:bg-emerald-500"
            >
              CMA Builder
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => applyPreset(p)}
              className="px-3 py-1.5 rounded-full text-xs border border-zinc-700 bg-zinc-900 hover:border-emerald-700 hover:text-emerald-300"
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
              <div className="text-sm font-semibold">Parcel inputs</div>
              <label className="block text-xs text-zinc-500">
                Address
                <input
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="block text-xs text-zinc-500">
                  Acres
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    value={acres}
                    onChange={(e) => setAcres(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Asking $
                  <input
                    type="number"
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Lat
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                  />
                </label>
                <label className="block text-xs text-zinc-500">
                  Lng
                  <input
                    className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                  />
                </label>
              </div>
              <label className="block text-xs text-zinc-500">
                County
                <select
                  className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white"
                  value={county}
                  onChange={(e) => setCounty(e.target.value)}
                >
                  {['Jefferson', 'Bonneville', 'Madison', 'Bingham', 'Bannock', 'Fremont', 'Teton'].map(
                    (c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    )
                  )}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={conceptOnly}
                  onChange={(e) => {
                    setConceptOnly(e.target.checked);
                    if (e.target.checked) {
                      setGisRing(null);
                      clearPlatParcel();
                      setBoundaryNote('');
                    }
                  }}
                  disabled={!!gisRing}
                />
                Concept geometry (square demo only — disabled when a real GIS ring is loaded)
              </label>

              {/* Annexation density toggle */}
              <div
                className={`rounded-2xl border p-3 space-y-2 transition ${
                  annexRigbyR1
                    ? 'border-sky-500/60 bg-sky-950/40'
                    : 'border-zinc-700 bg-zinc-950/50'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-zinc-100">
                      City of Rigby annexation
                    </div>
                    <p className="text-[11px] text-zinc-400 mt-0.5 leading-snug">
                      Project plat as if annexed into{' '}
                      <span className="text-sky-300">Rigby R-1</span> — higher city density with
                      municipal water &amp; sewer, curb &amp; gutter.
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={annexRigbyR1}
                    onClick={() => {
                      setAnnexRigbyR1((v) => !v);
                      setPlat(null);
                      setFeas(null);
                    }}
                    className={`relative shrink-0 w-12 h-7 rounded-full transition ${
                      annexRigbyR1 ? 'bg-sky-500' : 'bg-zinc-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                        annexRigbyR1 ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
                {annexRigbyR1 ? (
                  <ul className="text-[11px] text-sky-100/90 space-y-0.5 leading-snug">
                    <li>· Zoning: City of Rigby R-1 (min 8,000 sq ft · 80′ frontage)</li>
                    <li>· Utilities: city water + sewer (not septic/well)</li>
                    <li>· Streets: city section with curb &amp; gutter (wider pavement)</li>
                    <li>· Yield: maximize lots under city density vs county rural</li>
                    <li className="text-sky-300/80">
                      Planning projection only — annexation + city council required
                    </li>
                  </ul>
                ) : (
                  <p className="text-[11px] text-zinc-500">
                    Off = county / current jurisdiction density (Jefferson rural often ~1 ac).
                  </p>
                )}
              </div>

              {gisRing && (
                <p className="text-[11px] text-emerald-400/90 leading-snug">
                  ✓ Real parcel ring loaded ({gisRing.length} vertices). Plat will follow the curved
                  boundary and assign all land to lots or roads.
                </p>
              )}
              {boundaryNote && !gisRing && (
                <p className="text-[11px] text-amber-300/90 leading-snug">{boundaryNote}</p>
              )}
              <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={withAi}
                  onChange={(e) => setWithAi(e.target.checked)}
                />
                Include AI entitlements commentary
              </label>

              <div className="flex flex-col gap-2 pt-2">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={runBoth}
                  className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-semibold text-sm disabled:opacity-50"
                >
                  {busy === 'both' ? 'Running feasibility + plat…' : '▶ Run AI feasibility + plat'}
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={runAnalyze}
                    className="py-2 rounded-xl border border-zinc-700 text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Feasibility only
                  </button>
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => runPlat(feas)}
                    className="py-2 rounded-xl border border-zinc-700 text-sm hover:bg-zinc-800 disabled:opacity-50"
                  >
                    Plat only
                  </button>
                </div>
              </div>
            </div>

            {err && (
              <div className="rounded-2xl border border-rose-900 bg-rose-950/40 text-rose-300 text-sm px-4 py-3">
                {err}
              </div>
            )}

            {feas && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
                <div
                  className={`rounded-2xl px-4 py-3 text-center font-bold text-white ${
                    feas.verdict === 'OFFER' ? 'bg-emerald-700' : 'bg-rose-700'
                  }`}
                >
                  {feas.verdict === 'OFFER' ? '✅ Pencils — OFFER' : '⛔ PASS at list'}
                  <div className="text-xs font-normal mt-1 opacity-90">
                    Max offer {money(feas.maxOffer)} · list {money(feas.asking)} · spread{' '}
                    {money(feas.spread)}
                  </div>
                </div>
                <ul className="text-sm space-y-1.5 text-zinc-300">
                  <Row label="County / preset" value={`${feas.county} · ${feas.preset}`} />
                  <Row
                    label="Scenario"
                    value={
                      feas.scenario === 'rigby_r1_annexed' || feas.urban
                        ? 'City infra (water/sewer/curb)'
                        : 'County rural infra'
                    }
                  />
                  <Row label="Lots / road LF" value={`${feas.lots} · ${(feas.roadLF ?? 0).toLocaleString()} LF`} />
                  <Row label="Infra cost (all-in)" value={money(feas.devCost)} />
                  {feas.infra && (
                    <Row
                      label="Infra $/lot"
                      value={`${money(feas.infra.perLot)} · ${money(feas.infra.perRoadLF)}/LF`}
                    />
                  )}
                  <Row
                    label="Profit at list"
                    value={`${money(feas.profitAtList)} (${(feas.marginAtList * 100).toFixed(1)}%)`}
                  />
                </ul>
              </div>
            )}
          </div>

          <div className="lg:col-span-3 space-y-4">
            {!plat && !busy && (
              <div className="rounded-3xl border border-dashed border-zinc-700 bg-zinc-900/30 p-12 text-center text-zinc-500">
                <div className="text-4xl mb-3">🗺</div>
                <div className="font-medium text-zinc-300">Plat canvas</div>
                <p className="text-sm mt-2 max-w-md mx-auto">
                  Run analysis to generate a preliminary lot/road layout with county ROW standards
                  (e.g. Jefferson 60′ ROW / 30′ pavement).
                </p>
              </div>
            )}
            {busy && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 p-12 text-center text-zinc-400 animate-pulse">
                Designing plat with land engine…
              </div>
            )}
            {plat && (
              <div className="rounded-3xl border border-zinc-800 bg-white text-slate-900 overflow-hidden shadow-2xl">
                <div className="px-5 py-4 border-b flex flex-wrap items-center justify-between gap-2 bg-slate-50">
                  <div>
                    <div className="font-semibold">Preliminary plat</div>
                    <div className="text-xs text-slate-500">
                      {plat.geometrySource === 'concept'
                        ? 'Concept square (demo)'
                        : plat.geometrySource === 'provided-ring'
                          ? 'Selected GIS boundary (curved lot)'
                          : 'Live GIS boundary'}{' '}
                      · {plat.county || county}
                      {plat.design?.source ? ` · design: ${plat.design.source}` : ''}
                      {plat.pin ? ` · PIN ${plat.pin}` : ''}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs font-medium tabular-nums">
                    <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800">
                      {plat.metrics.lots} lots
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700">
                      {plat.metrics.roadLF.toLocaleString()} LF road
                    </span>
                    {plat.metrics.coveragePct != null && (
                      <span className="px-2 py-1 rounded-lg bg-violet-100 text-violet-900">
                        {plat.metrics.coveragePct}% coverage
                      </span>
                    )}
                    {plat.metrics.doubleLoadedPct != null && (
                      <span className="px-2 py-1 rounded-lg bg-sky-100 text-sky-900">
                        {plat.metrics.doubleLoadedPct}% double-loaded
                      </span>
                    )}
                    <span className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700">
                      {plat.metrics.acres} ac
                    </span>
                    <span className="px-2 py-1 rounded-lg bg-slate-200 text-slate-700">
                      {plat.metrics.density}/ac dens.
                    </span>
                  </div>
                </div>
                {boundaryNote && (
                  <div className="px-5 py-2 text-xs bg-emerald-50 text-emerald-900 border-b border-emerald-100">
                    {boundaryNote}
                  </div>
                )}
                <div
                  className="p-4 bg-white"
                  dangerouslySetInnerHTML={{ __html: plat.svg }}
                />
                <div className="px-5 py-3 border-t text-xs text-slate-500 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <span>
                    Lot {plat.design.lotWidthFt}′ × {plat.design.lotDepthFt}′
                  </span>
                  <span>
                    ROW {plat.design.rowFt}′ · pav {plat.design.pavementFt || '—'}′
                  </span>
                  <span>
                    Roads: {plat.design.roadCount ?? '—'} primary
                    {plat.design.crossStreetCount != null
                      ? ` · ${plat.design.crossStreetCount} cross`
                      : ''}
                  </span>
                  <span>
                    Axis {plat.design.axis?.toUpperCase() || '—'} · avg{' '}
                    {plat.metrics.avgLotAcres} ac
                    {plat.metrics.roadPerLot != null
                      ? ` · ${plat.metrics.roadPerLot} LF/lot`
                      : ''}
                  </span>
                </div>
              </div>
            )}

            {(plat?.infra || feas?.infra) && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-300 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-violet-400">
                      Infrastructure cost model
                    </div>
                    <div className="font-medium text-white text-sm mt-0.5">
                      {(plat?.infra || feas?.infra)?.profileLabel}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-white tabular-nums">
                      {money((plat?.infra || feas?.infra)!.total)}
                    </div>
                    <div className="text-[11px] text-zinc-500">
                      {money((plat?.infra || feas?.infra)!.perLot)}/lot ·{' '}
                      {money((plat?.infra || feas?.infra)!.perRoadLF)}/LF
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                  <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 px-2 py-1.5">
                    <div className="text-zinc-500">Construction</div>
                    <div className="font-semibold tabular-nums">
                      {money((plat?.infra || feas?.infra)!.construction)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 px-2 py-1.5">
                    <div className="text-zinc-500">Engineering</div>
                    <div className="font-semibold tabular-nums">
                      {money((plat?.infra || feas?.infra)!.engineering)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 px-2 py-1.5">
                    <div className="text-zinc-500">Permits / fees</div>
                    <div className="font-semibold tabular-nums">
                      {money((plat?.infra || feas?.infra)!.permitsFees)}
                    </div>
                  </div>
                  <div className="rounded-lg bg-zinc-950/80 border border-zinc-800 px-2 py-1.5">
                    <div className="text-zinc-500">Contingency</div>
                    <div className="font-semibold tabular-nums">
                      {money((plat?.infra || feas?.infra)!.contingency)}
                    </div>
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-zinc-800">
                  <table className="w-full text-[11px]">
                    <thead className="bg-zinc-950 text-zinc-500 sticky top-0">
                      <tr>
                        <th className="text-left px-2 py-1.5 font-medium">Item</th>
                        <th className="text-right px-2 py-1.5 font-medium">Qty</th>
                        <th className="text-right px-2 py-1.5 font-medium">$/unit</th>
                        <th className="text-right px-2 py-1.5 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(plat?.infra || feas?.infra)!.lineItems
                        .slice()
                        .sort((a, b) => b.total - a.total)
                        .map((row) => (
                          <tr key={row.key} className="border-t border-zinc-800/80">
                            <td className="px-2 py-1 text-zinc-300">{row.label}</td>
                            <td className="px-2 py-1 text-right tabular-nums text-zinc-500">
                              {row.qty.toLocaleString()} {row.unit}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums text-zinc-500">
                              {money(row.unitCost)}
                            </td>
                            <td className="px-2 py-1 text-right tabular-nums font-medium text-zinc-200">
                              {money(row.total)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
                <ul className="text-[10px] text-zinc-500 space-y-0.5">
                  {(plat?.infra || feas?.infra)!.notes.map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
              </div>
            )}

            {plat?.annexation?.active && (
              <div className="rounded-3xl border border-sky-700/50 bg-sky-950/40 p-5 text-sm text-sky-50 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">
                  Annexation scenario · City of {plat.annexation.city} {plat.annexation.zone}
                </div>
                <p className="text-xs text-sky-100/90">
                  Projecting higher city density with full urban services (not current county rural
                  standards).
                </p>
                {plat.annexation.services && (
                  <div className="flex flex-wrap gap-1.5">
                    {plat.annexation.services.map((s) => (
                      <span
                        key={s}
                        className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-sky-800/60 text-sky-100 border border-sky-600/40"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}
                <ul className="text-xs space-y-1 text-sky-100/80">
                  <li>
                    Min lot {plat.annexation.minLotSqFt?.toLocaleString()} sq ft · min frontage{' '}
                    {plat.annexation.minFrontageFt}′
                  </li>
                  <li>
                    Indicated yield <b className="text-white">{plat.metrics.lots} lots</b> (
                    {plat.metrics.density}/ac) · {plat.metrics.roadLF.toLocaleString()} LF road
                  </li>
                </ul>
              </div>
            )}

            {plat?.zoning && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-300 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-400">
                  Zoning applied
                </div>
                <div className="font-medium text-white">
                  {plat.zoning.code} · {plat.zoning.label}
                </div>
                <ul className="text-xs space-y-1 text-zinc-400">
                  <li>
                    Min lot {Number(plat.zoning.minLotAcres).toFixed(3)} ac (
                    {Math.round(Number(plat.zoning.minLotAcres) * 43560).toLocaleString()} sq ft) ·
                    min frontage {plat.zoning.minFrontageFt}′
                    {plat.zoning.minDepthFt ? ` · depth ${plat.zoning.minDepthFt}′` : ''}
                  </li>
                  <li>
                    ROW {plat.zoning.rowFt}′ / pavement {plat.zoning.pavementFt}′
                    {plat.zoning.curbGutter ? ' · curb & gutter' : ''}
                    {plat.zoning.waterSewer ? ' · city water/sewer' : ''}
                    {plat.zoning.maxDensityPerAcre != null
                      ? ` · guide ≤ ${plat.zoning.maxDensityPerAcre}/ac`
                      : ''}
                  </li>
                  {plat.zoning.jurisdiction && (
                    <li>Jurisdiction: {plat.zoning.jurisdiction}</li>
                  )}
                  <li className="text-zinc-500">{plat.zoning.source}</li>
                  {plat.zoning.notes?.map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
              </div>
            )}

            {plat?.neighborhood && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5 text-sm text-zinc-300 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-sky-400">
                  Nearby subdivision pattern (GIS)
                </div>
                <ul className="text-xs space-y-1 text-zinc-400">
                  {plat.neighborhood.notes?.map((n, i) => (
                    <li key={i}>· {n}</li>
                  ))}
                </ul>
              </div>
            )}

            {plat?.layoutNotes && plat.layoutNotes.length > 0 && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-5 text-xs text-zinc-400 space-y-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">
                  Layout intelligence
                </div>
                {plat.layoutNotes.map((n, i) => (
                  <p key={i}>· {n}</p>
                ))}
              </div>
            )}

            {plat?.aiInsights && (
              <div className="rounded-3xl border border-emerald-900/50 bg-emerald-950/30 p-5 text-sm text-emerald-100 whitespace-pre-wrap">
                <div className="text-xs font-semibold uppercase tracking-wide text-emerald-400 mb-2">
                  AI entitlements notes
                </div>
                {plat.aiInsights}
              </div>
            )}

            <p className="text-xs text-zinc-600">
              Concept plats are not surveys. Verify with licensed PLS/PE and county P&amp;Z before
              offering. Live GIS uses Idaho statewide parcels when APN/coords resolve.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex justify-between gap-3 border-b border-zinc-800/80 pb-1">
      <span className="text-zinc-500">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </li>
  );
}
