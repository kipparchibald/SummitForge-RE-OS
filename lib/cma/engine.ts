/**
 * Comparable Market Analysis engine for SummitForge.
 * Pure functions — works for residential and raw-land subjects.
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
  /** Assessor / GIS (from parcel selection) */
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
  adjustedPrice: number;
  weight: number;
  score: number;
};

export type CmaResult = {
  subject: SubjectProperty;
  comps: AdjustedComp[];
  indicatedValue: number;
  low: number;
  high: number;
  perAcre?: number;
  perSqFt?: number;
  confidence: number;
  method: string;
  notes: string[];
};

function typeAffinity(a?: string, b?: string): number {
  const na = (a || '').toLowerCase();
  const nb = (b || '').toLowerCase();
  if (!na || !nb) return 0.5;
  if (na === nb) return 1;
  const landish = (t: string) => /land|vacant|farm|ranch|acreage/.test(t);
  if (landish(na) && landish(nb)) return 0.9;
  return 0.35;
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

  return Math.max(0, Math.min(1, score));
}

/** Dollar adjustments (simplified GLA / acre / bed model for Eastern Idaho). */
export function adjustComp(subject: SubjectProperty, comp: CompProperty): AdjustedComp {
  const adjustments: { label: string; amount: number }[] = [];
  const isLand =
    /land|vacant|farm|ranch/i.test(subject.propertyType || '') ||
    /land|vacant|farm|ranch/i.test(comp.propertyType || '') ||
    ((subject.acres || 0) >= 2 && !(subject.sqft && subject.sqft > 400));

  if (isLand && subject.acres && comp.acres) {
    const deltaAc = subject.acres - comp.acres;
    if (Math.abs(deltaAc) >= 0.1) {
      const perAcre = comp.price / Math.max(comp.acres, 0.01);
      // Partial acreage adjustment (not full per-acre — residual land utility)
      const amount = Math.round(deltaAc * perAcre * 0.55);
      adjustments.push({ label: `Acreage (${deltaAc >= 0 ? '+' : ''}${deltaAc.toFixed(1)} ac)`, amount });
    }
  } else if (subject.sqft && comp.sqft) {
    const delta = subject.sqft - comp.sqft;
    if (Math.abs(delta) >= 50) {
      const amount = Math.round(delta * 85); // ~$/sqft adjustment band for E. Idaho NC
      adjustments.push({ label: `GLA (${delta >= 0 ? '+' : ''}${delta} sqft)`, amount });
    }
  }

  if (subject.beds != null && comp.beds != null && subject.beds !== comp.beds) {
    const amount = (subject.beds - comp.beds) * 8000;
    adjustments.push({ label: `Beds (${subject.beds - comp.beds >= 0 ? '+' : ''}${subject.beds - comp.beds})`, amount });
  }

  if (comp.distanceMi != null && comp.distanceMi > 5) {
    adjustments.push({ label: 'Location / distance', amount: -Math.round(comp.price * 0.02) });
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
  };
}

export function runCma(subject: SubjectProperty, candidates: CompProperty[], maxComps = 5): CmaResult {
  const scored = candidates
    .filter((c) => c.price > 0 && c.address)
    .map((c) => adjustComp(subject, c))
    .sort((a, b) => b.score - a.score)
    .slice(0, maxComps);

  if (scored.length === 0) {
    return {
      subject,
      comps: [],
      indicatedValue: subject.listPrice || 0,
      low: subject.listPrice || 0,
      high: subject.listPrice || 0,
      confidence: 0.2,
      method: 'insufficient-comps',
      notes: ['No usable comps — add listings or pull Navica data.'],
    };
  }

  const totalW = scored.reduce((s, c) => s + c.weight, 0) || 1;
  const indicatedValue = Math.round(scored.reduce((s, c) => s + c.adjustedPrice * c.weight, 0) / totalW);
  const prices = scored.map((c) => c.adjustedPrice).sort((a, b) => a - b);
  const low = prices[0];
  const high = prices[prices.length - 1];
  const avgScore = scored.reduce((s, c) => s + c.score, 0) / scored.length;

  const notes: string[] = [
    `Weighted average of ${scored.length} comps (score-weighted).`,
    'Adjustments are planning-grade — refine with a licensed appraiser for lending.',
  ];
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
    notes.push(`Subject sourced from GIS parcel PIN ${subject.pin}${subject.county ? ` (${subject.county} County)` : ''}.`);
  }

  return {
    subject,
    comps: scored,
    indicatedValue,
    low,
    high,
    perAcre: subject.acres && subject.acres > 0 ? Math.round(indicatedValue / subject.acres) : undefined,
    perSqFt: subject.sqft && subject.sqft > 0 ? Math.round(indicatedValue / subject.sqft) : undefined,
    confidence: Math.round(Math.min(0.95, 0.45 + avgScore * 0.4 + scored.length * 0.05) * 100) / 100,
    method: 'adjusted-weighted-comps',
    notes,
  };
}
