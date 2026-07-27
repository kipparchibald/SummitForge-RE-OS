/**
 * Comparable Market Analysis engine for SummitForge.
 * Pure functions — residential + raw-land.
 *
 * Algorithm stack:
 *  1) Score + dollar adjustments (GLA / acre / beds / location)
 *  2) Market-derived $/sqft and $/acre from the candidate pool
 *  3) Time (market conditions) adjustment from soldDate
 *  4) Dual indicated values: score-weighted mean + median → reconciled
 */

export type CompProperty = {
  address: string;
  price: number;
  acres?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
  distanceMi?: number;
  soldDate?: string;
  status?: string;
};

export type SubjectProperty = {
  address: string;
  listPrice?: number;
  acres?: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  propertyType?: string;
  city?: string;
  yearBuilt?: number;
  assessedValue?: number;
  landValue?: number;
  improvementValue?: number;
  pin?: string;
  owner?: string;
  county?: string;
  lat?: number;
  lng?: number;
  legalDescription?: string;
  improvements?: string;
  situsAddress?: string;
};

export type AdjustedComp = CompProperty & {
  adjustments: { label: string; amount: number }[];
  netAdjustment: number;
  /** Price after feature + time adjustments */
  adjustedPrice: number;
  weight: number;
  score: number;
  /** Months since sale (if known) */
  monthsSinceSale?: number;
};

export type MarketFactors = {
  /** Median sold/list $/sqft from pool with sqft */
  dollarsPerSqFt: number;
  /** Median $/acre from pool with acres */
  dollarsPerAcre: number;
  /** Sample sizes used */
  sqftSample: number;
  acreSample: number;
  /** Monthly market drift used for time adj (e.g. 0.004 = +0.4%/mo) */
  monthlyDrift: number;
};

export type CmaResult = {
  subject: SubjectProperty;
  comps: AdjustedComp[];
  /** Reconciled indicated value (primary) */
  indicatedValue: number;
  /** Score-weighted mean of adjusted prices */
  weightedMean: number;
  /** Median of adjusted prices */
  medianValue: number;
  low: number;
  high: number;
  perAcre?: number;
  perSqFt?: number;
  confidence: number;
  method: string;
  notes: string[];
  marketFactors: MarketFactors;
};

/** Fallback when pool is too thin — Eastern Idaho planning bands */
const FALLBACK_PSF = 85;
const FALLBACK_PER_ACRE = 18000;
/** Default appreciation / market drift per month when sold dates exist */
const DEFAULT_MONTHLY_DRIFT = 0.004; // ~0.4%/mo ≈ ~5%/yr planning assumption
const MAX_TIME_ADJ_PCT = 0.12; // cap time adjustment at ±12% of price

function typeAffinity(a?: string, b?: string): number {
  const na = (a || '').toLowerCase();
  const nb = (b || '').toLowerCase();
  if (!na || !nb) return 0.5;
  if (na === nb) return 1;
  const landish = (t: string) => /land|vacant|farm|ranch|acreage/.test(t);
  if (landish(na) && landish(nb)) return 0.9;
  return 0.35;
}

function isLandish(subject: SubjectProperty, comp?: CompProperty): boolean {
  const t = `${subject.propertyType || ''} ${comp?.propertyType || ''}`;
  if (/land|vacant|farm|ranch/i.test(t)) return true;
  return (subject.acres || 0) >= 2 && !(subject.sqft && subject.sqft > 400);
}

function median(nums: number[]): number {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}

function monthsBetween(iso: string, asOf: Date = new Date()): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const months =
    (asOf.getFullYear() - d.getFullYear()) * 12 + (asOf.getMonth() - d.getMonth());
  const dayFrac = (asOf.getDate() - d.getDate()) / 30;
  return Math.max(0, months + dayFrac);
}

/**
 * Derive $/sqft and $/acre from the candidate pool (market-based, not fixed).
 */
export function deriveMarketFactors(candidates: CompProperty[]): MarketFactors {
  const psf: number[] = [];
  const pac: number[] = [];

  for (const c of candidates) {
    if (c.price > 0 && c.sqft && c.sqft >= 400) {
      psf.push(c.price / c.sqft);
    }
    if (c.price > 0 && c.acres && c.acres >= 0.1) {
      pac.push(c.price / c.acres);
    }
  }

  return {
    dollarsPerSqFt: psf.length >= 2 ? Math.round(median(psf)) : FALLBACK_PSF,
    dollarsPerAcre: pac.length >= 2 ? Math.round(median(pac)) : FALLBACK_PER_ACRE,
    sqftSample: psf.length,
    acreSample: pac.length,
    monthlyDrift: DEFAULT_MONTHLY_DRIFT,
  };
}

/** Score a candidate comp vs subject (0–1). */
export function scoreComp(subject: SubjectProperty, comp: CompProperty): number {
  let score = 0.4;
  score += 0.25 * typeAffinity(subject.propertyType, comp.propertyType);

  if (subject.acres && comp.acres && subject.acres > 0 && comp.acres > 0) {
    const ratio = Math.min(subject.acres, comp.acres) / Math.max(subject.acres, comp.acres);
    score += 0.25 * ratio;
  } else if (subject.sqft && comp.sqft && subject.sqft > 0 && comp.sqft > 0) {
    const ratio = Math.min(subject.sqft, comp.sqft) / Math.max(subject.sqft, comp.sqft);
    score += 0.25 * ratio;
  }

  if (comp.distanceMi != null) {
    score += comp.distanceMi < 2 ? 0.15 : comp.distanceMi < 8 ? 0.08 : 0.02;
  } else {
    score += 0.05;
  }

  if (subject.city && comp.address?.toLowerCase().includes(subject.city.toLowerCase())) {
    score += 0.1;
  }

  // Mild boost for recent sales
  if (comp.soldDate) {
    const mo = monthsBetween(comp.soldDate);
    if (mo != null) {
      if (mo <= 3) score += 0.08;
      else if (mo <= 6) score += 0.04;
      else if (mo > 18) score -= 0.06;
    }
  }

  return Math.max(0, Math.min(1, score));
}

/**
 * Dollar adjustments using market-derived factors + time adjustment.
 */
export function adjustComp(
  subject: SubjectProperty,
  comp: CompProperty,
  factors: MarketFactors = deriveMarketFactors([comp])
): AdjustedComp {
  const adjustments: { label: string; amount: number }[] = [];
  const land = isLandish(subject, comp);

  // --- Size ---
  if (land && subject.acres && comp.acres) {
    const deltaAc = subject.acres - comp.acres;
    if (Math.abs(deltaAc) >= 0.1) {
      // Prefer market median $/acre; blend with this comp's own $/acre
      const compPerAcre = comp.price / Math.max(comp.acres, 0.01);
      const unit = factors.acreSample >= 2 ? factors.dollarsPerAcre * 0.6 + compPerAcre * 0.4 : compPerAcre;
      const amount = Math.round(deltaAc * unit * 0.55);
      adjustments.push({
        label: `Acreage (${deltaAc >= 0 ? '+' : ''}${deltaAc.toFixed(1)} ac @ $${Math.round(unit).toLocaleString()}/ac×0.55)`,
        amount,
      });
    }
  } else if (subject.sqft && comp.sqft) {
    const delta = subject.sqft - comp.sqft;
    if (Math.abs(delta) >= 50) {
      const unit = factors.dollarsPerSqFt;
      const amount = Math.round(delta * unit);
      adjustments.push({
        label: `GLA (${delta >= 0 ? '+' : ''}${delta} sqft @ $${unit}/sf)`,
        amount,
      });
    }
  }

  // --- Beds ---
  if (subject.beds != null && comp.beds != null && subject.beds !== comp.beds) {
    const d = subject.beds - comp.beds;
    const amount = d * 8000;
    adjustments.push({ label: `Beds (${d >= 0 ? '+' : ''}${d})`, amount });
  }

  // --- Location ---
  if (comp.distanceMi != null && comp.distanceMi > 5) {
    adjustments.push({ label: 'Location / distance', amount: -Math.round(comp.price * 0.02) });
  }

  // --- Time / market conditions ---
  let monthsSinceSale: number | undefined;
  if (comp.soldDate) {
    const mo = monthsBetween(comp.soldDate);
    if (mo != null && mo >= 0.5) {
      monthsSinceSale = Math.round(mo * 10) / 10;
      // Bring historical sale forward to "today"
      let pct = factors.monthlyDrift * mo;
      pct = Math.max(-MAX_TIME_ADJ_PCT, Math.min(MAX_TIME_ADJ_PCT, pct));
      const amount = Math.round(comp.price * pct);
      if (Math.abs(amount) >= 500) {
        adjustments.push({
          label: `Time (${monthsSinceSale} mo × ${(factors.monthlyDrift * 100).toFixed(2)}%/mo)`,
          amount,
        });
      }
    }
  }

  const netAdjustment = adjustments.reduce((s, a) => s + a.amount, 0);
  const adjustedPrice = Math.max(0, Math.round(comp.price + netAdjustment));
  const score = scoreComp(subject, comp);
  const weight = Math.pow(score, 1.4);

  return {
    ...comp,
    adjustments,
    netAdjustment,
    adjustedPrice,
    weight,
    score,
    monthsSinceSale,
  };
}

/**
 * Reconcile weighted mean and median into a single indicated value.
 * When they diverge >8%, blend 60% mean / 40% median (appraiser-style).
 */
export function reconcileIndicated(weightedMean: number, medianValue: number): number {
  if (!weightedMean && !medianValue) return 0;
  if (!medianValue) return weightedMean;
  if (!weightedMean) return medianValue;
  const mid = (weightedMean + medianValue) / 2;
  const spread = Math.abs(weightedMean - medianValue) / Math.max(mid, 1);
  if (spread <= 0.08) {
    // Close enough — slight preference to weighted mean
    return Math.round(weightedMean * 0.7 + medianValue * 0.3);
  }
  // Wider spread — pull toward median to resist outliers
  return Math.round(weightedMean * 0.55 + medianValue * 0.45);
}

export function runCma(
  subject: SubjectProperty,
  candidates: CompProperty[],
  maxComps = 5
): CmaResult {
  const factors = deriveMarketFactors(candidates);

  const scored = candidates
    .filter((c) => c.price > 0 && c.address)
    .map((c) => adjustComp(subject, c, factors))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxComps);

  if (scored.length === 0) {
    return {
      subject,
      comps: [],
      indicatedValue: subject.listPrice || 0,
      weightedMean: subject.listPrice || 0,
      medianValue: subject.listPrice || 0,
      low: subject.listPrice || 0,
      high: subject.listPrice || 0,
      confidence: 0.2,
      method: 'insufficient-comps',
      notes: ['No usable comps — add listings or pull Navica data.'],
      marketFactors: factors,
    };
  }

  const totalW = scored.reduce((s, c) => s + c.weight, 0) || 1;
  const weightedMean = Math.round(
    scored.reduce((s, c) => s + c.adjustedPrice * c.weight, 0) / totalW
  );
  const prices = scored.map((c) => c.adjustedPrice).sort((a, b) => a - b);
  const medianValue = median(prices);
  const indicatedValue = reconcileIndicated(weightedMean, medianValue);
  const low = prices[0];
  const high = prices[prices.length - 1];
  const avgScore = scored.reduce((s, c) => s + c.score, 0) / scored.length;

  const notes: string[] = [
    `Reconciled indicated value from weighted mean (${weightedMean.toLocaleString()}) and median (${medianValue.toLocaleString()}) across ${scored.length} comps.`,
    `Market factors: $${factors.dollarsPerSqFt}/sqft (n=${factors.sqftSample}) · $${factors.dollarsPerAcre.toLocaleString()}/acre (n=${factors.acreSample}).`,
    `Time adjustment: ${(factors.monthlyDrift * 100).toFixed(2)}% per month since sale (capped ±${MAX_TIME_ADJ_PCT * 100}%).`,
    'Planning-grade analysis — refine with a licensed appraiser for lending.',
  ];

  const timed = scored.filter((c) => c.monthsSinceSale != null);
  if (timed.length) {
    notes.push(
      `Time-adjusted ${timed.length} sold comp(s); most recent ~${Math.min(...timed.map((c) => c.monthsSinceSale!))} mo ago.`
    );
  } else {
    notes.push('No sold dates on comps — time adjustment skipped (add closed sales for stronger trend).');
  }

  if ((subject.acres || 0) >= 5) {
    notes.push('Land subject: also run Land Deals / AI Plat for subdivision residual value.');
  }
  if (subject.yearBuilt != null && subject.yearBuilt >= 1800) {
    const age = new Date().getFullYear() - subject.yearBuilt;
    notes.push(
      `Assessor year built ${subject.yearBuilt} (~${age} yrs). Prefer comps of similar vintage when available.`
    );
  }
  if (subject.assessedValue != null && subject.assessedValue > 0) {
    const delta = indicatedValue - subject.assessedValue;
    const pct = Math.round((delta / subject.assessedValue) * 1000) / 10;
    notes.push(
      `Indicated market value is ${pct >= 0 ? '+' : ''}${pct}% vs county assessed ${subject.assessedValue.toLocaleString(
        'en-US',
        { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }
      )} (assessed is not market value).`
    );
  }
  if (subject.pin) {
    notes.push(
      `Subject sourced from GIS parcel PIN ${subject.pin}${subject.county ? ` (${subject.county} County)` : ''}.`
    );
  }

  // Confidence: score quality + sample + agreement of mean/median
  const agreement =
    1 -
    Math.min(
      1,
      Math.abs(weightedMean - medianValue) / Math.max((weightedMean + medianValue) / 2, 1)
    );
  const confidence =
    Math.round(
      Math.min(0.95, 0.4 + avgScore * 0.35 + scored.length * 0.04 + agreement * 0.12) * 100
    ) / 100;

  return {
    subject,
    comps: scored,
    indicatedValue,
    weightedMean,
    medianValue,
    low,
    high,
    perAcre: subject.acres && subject.acres > 0 ? Math.round(indicatedValue / subject.acres) : undefined,
    perSqFt: subject.sqft && subject.sqft > 0 ? Math.round(indicatedValue / subject.sqft) : undefined,
    confidence,
    method: 'adjusted-weighted-median-reconciled',
    notes,
    marketFactors: factors,
  };
}
