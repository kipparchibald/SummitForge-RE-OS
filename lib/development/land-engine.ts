// lib/development/land-engine.ts
// Accurate raw-land development engine for SummitForge.
// Upgrades the rough plat-creator / pro-forma math with calibrated Idaho comps,
// ISPWC-based infrastructure costs, and a maximum-offer / Offer-Pass verdict.
// Pure functions (no deps) so it runs in scans, API routes, and the client.

export interface CountyPreset {
  key: string; label: string;
  lotAcres: number; roadFactor: number; frontageFtPerLot: number;
  urban: boolean; lotPrice: number; absorption: number; // lots/month
  rowFt: number;        // right-of-way width (local street standard)
  pavementFt: number;   // paved driving surface width
}

// Calibrated to 2026 eastern-Idaho comps (balanced-to-buyer market). See Market_Analysis.
// ROW/pavement are the adopted local-street standards (Jefferson Co. confirmed 60' ROW / 30' road).
export const COUNTY_PRESETS: Record<string, CountyPreset> = {
  Jefferson:    { key: 'Jefferson',    label: 'Jefferson Co. R-1 (1 ac rural)',   lotAcres: 1.0,  roadFactor: 0.14, frontageFtPerLot: 156, urban: false, lotPrice: 125000, absorption: 3, rowFt: 60, pavementFt: 30 },
  Bonneville:   { key: 'Bonneville',   label: 'Bonneville Co. R-1 (~0.33 ac)',    lotAcres: 0.33, roadFactor: 0.19, frontageFtPerLot: 100, urban: true,  lotPrice: 110000, absorption: 4, rowFt: 60, pavementFt: 32 },
  Madison:      { key: 'Madison',      label: 'Madison Co. R-1 (~0.33 ac)',       lotAcres: 0.33, roadFactor: 0.19, frontageFtPerLot: 100, urban: true,  lotPrice: 100000, absorption: 4, rowFt: 60, pavementFt: 32 },
  Bingham:      { key: 'Bingham',      label: 'Bingham Co. R-1 (~1 ac)',          lotAcres: 1.0,  roadFactor: 0.14, frontageFtPerLot: 156, urban: false, lotPrice: 100000, absorption: 2, rowFt: 60, pavementFt: 30 },
  Fremont:      { key: 'Fremont',      label: 'Fremont Co. R-1 (~1 ac)',          lotAcres: 1.0,  roadFactor: 0.14, frontageFtPerLot: 156, urban: false, lotPrice: 95000,  absorption: 2, rowFt: 60, pavementFt: 30 },
  Default:      { key: 'Default',      label: 'Generic R-1 (1 ac)',               lotAcres: 1.0,  roadFactor: 0.14, frontageFtPerLot: 156, urban: false, lotPrice: 110000, absorption: 3, rowFt: 60, pavementFt: 30 },
};

// Eastern-Idaho city -> county (unincorporated default). Extend as needed.
const CITY_COUNTY: Record<string, string> = {
  rigby: 'Jefferson', menan: 'Jefferson', ririe: 'Jefferson', lewisville: 'Jefferson',
  roberts: 'Jefferson', terreton: 'Jefferson', hamer: 'Jefferson', 'mud lake': 'Jefferson',
  'idaho falls': 'Bonneville', ammon: 'Bonneville', iona: 'Bonneville', ucon: 'Bonneville', 'swan valley': 'Bonneville',
  shelley: 'Bingham', blackfoot: 'Bingham', firth: 'Bingham', basalt: 'Bingham',
  rexburg: 'Madison', 'sugar city': 'Madison',
  'st. anthony': 'Fremont', 'saint anthony': 'Fremont', 'st anthony': 'Fremont', ashton: 'Fremont',
};

export function inferCounty(cityOrAddress?: string, explicitCounty?: string): string {
  if (explicitCounty) {
    const k = Object.keys(COUNTY_PRESETS).find(k => explicitCounty.toLowerCase().startsWith(k.toLowerCase()));
    if (k) return k;
  }
  const s = (cityOrAddress || '').toLowerCase();
  for (const city of Object.keys(CITY_COUNTY)) if (s.includes(city)) return CITY_COUNTY[city];
  return 'Default';
}

export function presetFor(county: string): CountyPreset {
  return COUNTY_PRESETS[county] || COUNTY_PRESETS.Default;
}

export function estimateYield(grossAcres: number, p: CountyPreset) {
  const net = Math.max(0, grossAcres * (1 - p.roadFactor));
  const lots = Math.floor(net / p.lotAcres);
  const frontLF = Math.round(lots * p.frontageFtPerLot);
  const roadLF = Math.round((frontLF / 2) * 1.1);
  return { lots, roadLF, frontLF, netAcres: +net.toFixed(2) };
}

// 2025-26 Idaho/ISPWC planning ranges (per LF of road, per lot, lump).
const ROAD_UNIT = { county: 18 + 22 + 38 + 12 + 22, city: 28 + 30 + 55 + 34 + 30 + 8 + 48 + 60 + 30 };
export function infraCost(roadLF: number, lots: number, urban: boolean): number {
  const road = (urban ? ROAD_UNIT.city : ROAD_UNIT.county) * roadLF;
  const perLot = (urban ? 2800 + 2500 + 2500 + 4500 : 12000 + 14000 + 3500) * lots;
  const misc = urban ? 100000 : 43000;
  const constr = road + perLot + misc;
  const mob = 0.05 * constr, cm = constr + mob;
  const eng = 0.12 * cm, permits = (urban ? 0.06 : 0.03) * cm, cont = 0.15 * cm;
  return Math.round(constr + mob + eng + permits + cont);
}

export interface FeasibilityInputs {
  lotPrice: number; absorption: number; asking: number;
  commission?: number; targetMargin?: number; finRate?: number; finPct?: number; gaMonthly?: number;
}
export function feasibility(lots: number, devCost: number, m: FeasibilityInputs) {
  const commission = m.commission ?? 0.06, targetMargin = m.targetMargin ?? 0.20;
  const finRate = m.finRate ?? 0.11, finPct = m.finPct ?? 0.70, ga = m.gaMonthly ?? 6000;
  const grossRev = lots * m.lotPrice, netRev = grossRev * (1 - commission);
  const months = m.absorption > 0 ? lots / m.absorption : 0;
  const financing = devCost * finPct * finRate * (months / 12);
  const carry = ga * months, profitReq = grossRev * targetMargin;
  const maxOffer = Math.round(netRev - devCost - financing - carry - profitReq);
  const profitAtList = Math.round(netRev - devCost - financing - carry - m.asking);
  return {
    grossRevenue: Math.round(grossRev), maxOffer, asking: m.asking,
    spread: maxOffer - m.asking, verdict: maxOffer >= m.asking ? 'OFFER' : 'PASS',
    months: Math.round(months), profitAtList,
    marginAtList: grossRev > 0 ? +(profitAtList / grossRev).toFixed(3) : 0,
    profitPerLot: lots > 0 ? Math.round(profitAtList / lots) : 0,
  };
}

export interface ListingLike { acres?: number; price?: number; address?: string; rawData?: any; }
export interface LandAnalysis {
  county: string; preset: string; acres: number; lots: number; roadLF: number;
  devCost: number; lotPrice: number; grossRevenue: number; maxOffer: number; asking: number;
  spread: number; verdict: string; months: number; profitAtList: number; marginAtList: number; profitPerLot: number;
}

/** One-call analysis for a Navica/NormalizedListing (needs acres + price). */
export function analyzeListing(listing: ListingLike, opts: { lotPrice?: number; county?: string } = {}): LandAnalysis | null {
  const acres = Number(listing.acres) || 0;
  const asking = Number(listing.price) || 0;
  if (acres <= 0 || asking <= 0) return null;
  const city = listing.rawData?.City || listing.rawData?.city || listing.address || '';
  const county = opts.county || inferCounty(city);
  const p = presetFor(county);
  const y = estimateYield(acres, p);
  const devCost = infraCost(y.roadLF, y.lots, p.urban);
  const lotPrice = opts.lotPrice ?? p.lotPrice;
  const f = feasibility(y.lots, devCost, { lotPrice, absorption: p.absorption, asking });
  return {
    county, preset: p.label, acres: +acres.toFixed(2), lots: y.lots, roadLF: y.roadLF,
    devCost, lotPrice, ...f,
  };
}
