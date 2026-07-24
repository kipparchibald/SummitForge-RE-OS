// lib/development/land-engine.ts
// Accurate raw-land development engine for SummitForge.
// Upgrades the rough plat-creator / pro-forma math with calibrated Idaho comps,
// ISPWC-based infrastructure costs, and a maximum-offer / Offer-Pass verdict.
// Pure functions (no deps) so it runs in scans, API routes, and the client.

import { mapCityToLocation, countyForLocation } from '@/lib/geo/counties';

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
  // Bannock: Pocatello/Chubbuck are the region's second urban core — city lot
  // sizes and absorption closer to Bonneville, but softer finished-lot pricing.
  Bannock:      { key: 'Bannock',      label: 'Bannock Co. R-1 (~0.28 ac)',       lotAcres: 0.28, roadFactor: 0.19, frontageFtPerLot: 95,  urban: true,  lotPrice: 92000,  absorption: 3, rowFt: 60, pavementFt: 32 },
  // Teton: resort market (Driggs/Victor/Tetonia). Finished lots clear far above
  // the rest of the region and absorb slowly — using a Default preset here would
  // badly understate both lot value and carry time.
  Teton:        { key: 'Teton',        label: 'Teton Co. R-1 (~1 ac resort)',     lotAcres: 1.0,  roadFactor: 0.15, frontageFtPerLot: 156, urban: false, lotPrice: 215000, absorption: 1.5, rowFt: 60, pavementFt: 28 },
  Default:      { key: 'Default',      label: 'Generic R-1 (1 ac)',               lotAcres: 1.0,  roadFactor: 0.14, frontageFtPerLot: 156, urban: false, lotPrice: 110000, absorption: 3, rowFt: 60, pavementFt: 30 },
};

export function inferCounty(cityOrAddress?: string, explicitCounty?: string): string {
  if (explicitCounty) {
    const k = Object.keys(COUNTY_PRESETS).find(k => explicitCounty.toLowerCase().startsWith(k.toLowerCase()));
    if (k) return k;
  }
  // Derives from the canonical geography registry rather than a private city
  // map, so a market added in lib/geo/counties.ts is priced correctly here too.
  const county = countyForLocation(mapCityToLocation(cityOrAddress || ''));
  return county && COUNTY_PRESETS[county] ? county : 'Default';
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

/**
 * City of Rigby R-1 annexation yield preset (8,000 sq ft lots, ~22% ROW).
 * Finished city lots typically clear lower per lot than rural acreage lots.
 */
export const RIGBY_CITY_PRESET: CountyPreset = {
  key: 'RigbyCityR1',
  label: 'City of Rigby R-1 (annexed · city utilities)',
  lotAcres: 8000 / 43560,
  roadFactor: 0.22,
  frontageFtPerLot: 80,
  urban: true,
  lotPrice: 95000, // city SF lot planning average E. Idaho
  absorption: 5,
  rowFt: 60,
  pavementFt: 36,
};

// ─── Infrastructure unit costs (2025–26 Eastern Idaho / ISPWC-style planning) ───
// City figures reflect full urban section: curb & gutter, sidewalks, storm,
// water + sewer mains, street lights. County = rural road + septic/well path.
// Sources: ISPWC unit ranges, Idaho city CIP/impact fee digests, local street
// reconstruction bids (planning-grade — not a bid).

export type InfraProfile = 'county' | 'city';

export type InfraLineItem = {
  key: string;
  label: string;
  unit: 'LF' | 'lot' | 'LS';
  unitCost: number;
  qty: number;
  total: number;
};

export type InfraBreakdown = {
  profile: InfraProfile;
  profileLabel: string;
  roadLF: number;
  lots: number;
  /** Construction subtotal before softs */
  construction: number;
  mobilization: number;
  engineering: number;
  permitsFees: number;
  contingency: number;
  /** All-in developer infrastructure cost */
  total: number;
  perLot: number;
  perRoadLF: number;
  lineItems: InfraLineItem[];
  notes: string[];
};

/** Per-LF street section components */
const ROAD_LF_COUNTY = {
  earthwork: 18,
  aggregateBase: 22,
  asphalt: 38,
  drainageDitch: 12,
  gravelShoulder: 22,
  // no curb/sidewalk/water/sewer in rural section
};

const ROAD_LF_CITY = {
  earthwork: 28,
  aggregateBase: 32,
  asphalt: 58, // wider city section
  curbGutterBoth: 42, // both sides
  sidewalkBoth: 36,
  stormDrain: 52,
  waterMain: 72, // 8" PVC + valves/hydrants prorated
  sewerMain: 78, // 8" SDR + manholes prorated
  dryUtilities: 12, // conduit / trench for power/telecom
  streetLights: 18, // poles + feed prorated per LF
};

/** Per-lot service connections & fees */
const PER_LOT_COUNTY = {
  septic: 12000,
  wellOrSharedWater: 14000,
  powerTelecom: 3500,
};

const PER_LOT_CITY = {
  waterLateralMeter: 3200,
  sewerLateral: 3800,
  waterConnectionFee: 4500, // typical small-city impact/connection band
  sewerConnectionFee: 4200,
  drivewayCurbCut: 1800,
  streetTreeSidewalk: 900,
};

const LUMP_COUNTY = { stormBasinGrading: 25000, entranceSignage: 8000, surveyingBonds: 10000 };
const LUMP_CITY = {
  liftStationOrOutfall: 85000, // if needed — averaged contingency lump
  parkOpenSpace: 25000,
  cityEntrance: 15000,
  surveyingBonds: 18000,
  stormPond: 45000,
};

function line(
  key: string,
  label: string,
  unit: InfraLineItem['unit'],
  unitCost: number,
  qty: number
): InfraLineItem {
  return { key, label, unit, unitCost, qty, total: Math.round(unitCost * qty) };
}

/**
 * Detailed infrastructure cost model — county rural vs city (curb/gutter/water/sewer).
 */
export function infraCostBreakdown(
  roadLF: number,
  lots: number,
  profile: InfraProfile | boolean = false
): InfraBreakdown {
  const urban = profile === true || profile === 'city';
  const p: InfraProfile = urban ? 'city' : 'county';
  const lf = Math.max(0, roadLF);
  const n = Math.max(0, lots);
  const items: InfraLineItem[] = [];

  if (urban) {
    const r = ROAD_LF_CITY;
    items.push(line('earthwork', 'Earthwork / subgrade', 'LF', r.earthwork, lf));
    items.push(line('base', 'Aggregate base', 'LF', r.aggregateBase, lf));
    items.push(line('asphalt', 'Asphalt pavement (city width)', 'LF', r.asphalt, lf));
    items.push(line('curb', 'Curb & gutter (both sides)', 'LF', r.curbGutterBoth, lf));
    items.push(line('sidewalk', 'Sidewalks (both sides)', 'LF', r.sidewalkBoth, lf));
    items.push(line('storm', 'Storm drain (pipe + inlets)', 'LF', r.stormDrain, lf));
    items.push(line('waterMain', 'Water main (8″ + appurtenances)', 'LF', r.waterMain, lf));
    items.push(line('sewerMain', 'Sewer main (8″ + manholes)', 'LF', r.sewerMain, lf));
    items.push(line('dryUtil', 'Dry utilities trench/conduit', 'LF', r.dryUtilities, lf));
    items.push(line('lights', 'Street lights (prorated)', 'LF', r.streetLights, lf));

    const pl = PER_LOT_CITY;
    items.push(line('wLat', 'Water service lateral + meter', 'lot', pl.waterLateralMeter, n));
    items.push(line('sLat', 'Sewer service lateral', 'lot', pl.sewerLateral, n));
    items.push(line('wFee', 'City water connection / impact fee', 'lot', pl.waterConnectionFee, n));
    items.push(line('sFee', 'City sewer connection / impact fee', 'lot', pl.sewerConnectionFee, n));
    items.push(line('drive', 'Driveway apron / curb cut', 'lot', pl.drivewayCurbCut, n));
    items.push(line('tree', 'Park strip / street tree allowance', 'lot', pl.streetTreeSidewalk, n));

    const L = LUMP_CITY;
    items.push(line('lift', 'Lift station / outfall allowance', 'LS', L.liftStationOrOutfall, 1));
    items.push(line('pond', 'Storm detention pond', 'LS', L.stormPond, 1));
    items.push(line('park', 'Open space / park fee allowance', 'LS', L.parkOpenSpace, 1));
    items.push(line('entry', 'Entry / monument allowance', 'LS', L.cityEntrance, 1));
    items.push(line('survey', 'Survey, staking, bonds (city)', 'LS', L.surveyingBonds, 1));
  } else {
    const r = ROAD_LF_COUNTY;
    items.push(line('earthwork', 'Earthwork / subgrade', 'LF', r.earthwork, lf));
    items.push(line('base', 'Aggregate base', 'LF', r.aggregateBase, lf));
    items.push(line('asphalt', 'Asphalt pavement (rural width)', 'LF', r.asphalt, lf));
    items.push(line('ditch', 'Roadside drainage ditch', 'LF', r.drainageDitch, lf));
    items.push(line('shoulder', 'Gravel shoulder', 'LF', r.gravelShoulder, lf));

    const pl = PER_LOT_COUNTY;
    items.push(line('septic', 'Septic system (per lot)', 'lot', pl.septic, n));
    items.push(line('well', 'Well or shared water system', 'lot', pl.wellOrSharedWater, n));
    items.push(line('power', 'Power / telecom drop', 'lot', pl.powerTelecom, n));

    const L = LUMP_COUNTY;
    items.push(line('basin', 'Storm / retention grading', 'LS', L.stormBasinGrading, 1));
    items.push(line('entry', 'Entrance / signage', 'LS', L.entranceSignage, 1));
    items.push(line('survey', 'Survey, staking, bonds (county)', 'LS', L.surveyingBonds, 1));
  }

  const construction = items.reduce((s, i) => s + i.total, 0);
  const mobilization = Math.round(0.05 * construction);
  const afterMob = construction + mobilization;
  const engineering = Math.round(0.12 * afterMob);
  const permitsFees = Math.round((urban ? 0.07 : 0.03) * afterMob); // city plan review / impact admin
  const contingency = Math.round(0.15 * afterMob);
  const total = construction + mobilization + engineering + permitsFees + contingency;

  const notes = urban
    ? [
        'City profile: full urban street (curb & gutter, sidewalks, storm, water & sewer mains, lights).',
        'Per-lot city water/sewer laterals + typical small-city connection/impact fees included.',
        'Unit costs are 2025–26 Eastern Idaho planning averages (ISPWC-style) — not a contractor bid.',
        'Lift station / outfall is a site-contingent allowance; may be $0 if gravity to city main.',
      ]
    : [
        'County/rural profile: paved local road without curb/gutter or city utilities.',
        'Per-lot septic + well (or shared well) dominate rural infrastructure cost.',
        'Unit costs are 2025–26 Eastern Idaho planning averages — not a contractor bid.',
      ];

  return {
    profile: p,
    profileLabel: urban
      ? 'City infrastructure (water, sewer, curb & gutter)'
      : 'County / rural infrastructure (septic, well, rural road)',
    roadLF: lf,
    lots: n,
    construction,
    mobilization,
    engineering,
    permitsFees,
    contingency,
    total,
    perLot: n > 0 ? Math.round(total / n) : total,
    perRoadLF: lf > 0 ? Math.round(total / lf) : 0,
    lineItems: items,
    notes,
  };
}

/** All-in infra $ (backward compatible). */
export function infraCost(
  roadLF: number,
  lots: number,
  urban: boolean | InfraProfile = false
): number {
  return infraCostBreakdown(roadLF, lots, urban).total;
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
  scenario?: string;
  urban?: boolean;
  infra?: InfraBreakdown;
}

export type AnalyzeOpts = {
  lotPrice?: number;
  county?: string;
  /** 'county' | 'rigby_r1_annexed' */
  scenario?: string;
  /** Override yield/road from a real plat engine run */
  lots?: number;
  roadLF?: number;
};

/** One-call analysis for a Navica/NormalizedListing (needs acres + price). */
export function analyzeListing(listing: ListingLike, opts: AnalyzeOpts = {}): LandAnalysis | null {
  const acres = Number(listing.acres) || 0;
  const asking = Number(listing.price) || 0;
  if (acres <= 0 || asking <= 0) return null;
  const city = listing.rawData?.City || listing.rawData?.city || listing.address || '';
  const county = opts.county || inferCounty(city);
  const annexed =
    opts.scenario === 'rigby_r1_annexed' ||
    opts.scenario === 'rigby' ||
    opts.scenario === 'annex_rigby';

  const p = annexed ? RIGBY_CITY_PRESET : presetFor(county);
  const y =
    opts.lots != null && opts.roadLF != null
      ? {
          lots: opts.lots,
          roadLF: opts.roadLF,
          frontLF: opts.lots * p.frontageFtPerLot,
          netAcres: acres * (1 - p.roadFactor),
        }
      : estimateYield(acres, p);

  const infra = infraCostBreakdown(y.roadLF, y.lots, p.urban || annexed);
  const devCost = infra.total;
  const lotPrice = opts.lotPrice ?? p.lotPrice;
  const f = feasibility(y.lots, devCost, { lotPrice, absorption: p.absorption, asking });
  return {
    county: annexed ? 'Jefferson (Rigby city scenario)' : county,
    preset: p.label,
    acres: +acres.toFixed(2),
    lots: y.lots,
    roadLF: y.roadLF,
    devCost,
    lotPrice,
    scenario: annexed ? 'rigby_r1_annexed' : 'county',
    urban: p.urban || annexed,
    infra,
    ...f,
  };
}
