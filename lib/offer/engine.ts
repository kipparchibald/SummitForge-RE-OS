/**
 * Offer Decision Engine — revolutionary buyer/agent tool.
 * Scores win probability of an offer price + terms against market signals.
 * Fully functional offline with demo Jefferson County comps.
 */

export type OfferProperty = {
  address: string;
  listPrice: number;
  sqft?: number;
  beds?: number;
  baths?: number;
  acres?: number;
  propertyType?: string;
  daysOnMarket?: number;
  city?: string;
  isLand?: boolean;
  isNewConstruction?: boolean;
};

export type OfferTerms = {
  offerPrice: number;
  earnestMoney?: number;
  closingDays?: number;
  inspectionContingency?: boolean;
  financingContingency?: boolean;
  appraisalContingency?: boolean;
  escalationMax?: number;
  escalationOver?: number;
  cash?: boolean;
};

export type CompSignal = {
  address: string;
  soldPrice: number;
  listPrice?: number;
  sqft?: number;
  daysOnMarket: number;
  soldDate?: string;
  saleToList?: number;
};

export type OfferDecision = {
  winProbability: number; // 0–100
  confidence: 'low' | 'medium' | 'high';
  priceScore: number;
  termsScore: number;
  marketScore: number;
  recommendedPrice: number;
  recommendedPriceLow: number;
  recommendedPriceHigh: number;
  saleToListEstimate: number;
  suggestedEarnest: number;
  suggestedClosingDays: number;
  narrative: string;
  risks: string[];
  strengths: string[];
  escalationAdvice?: string;
  compsUsed: CompSignal[];
  listPrice: number;
  offerPrice: number;
  pctOfList: number;
};

/** Demo sold comps — Rigby / Jefferson County style (no live MLS needed). */
export const DEMO_COMPS: CompSignal[] = [
  { address: '412 Birch St, Rigby', soldPrice: 465000, listPrice: 475000, sqft: 1720, daysOnMarket: 18, soldDate: '2026-05-12', saleToList: 0.979 },
  { address: '88 Cottonwood Ln, Rigby', soldPrice: 492000, listPrice: 489000, sqft: 1850, daysOnMarket: 9, soldDate: '2026-06-02', saleToList: 1.006 },
  { address: '201 Falcon Dr, Rigby', soldPrice: 438000, listPrice: 449000, sqft: 1620, daysOnMarket: 41, soldDate: '2026-04-20', saleToList: 0.976 },
  { address: '55 Annis Hwy, Ririe', soldPrice: 389000, listPrice: 399000, sqft: 1540, daysOnMarket: 52, soldDate: '2026-03-15', saleToList: 0.975 },
  { address: '1200 Teton Ave, Rigby', soldPrice: 525000, listPrice: 515000, sqft: 1980, daysOnMarket: 6, soldDate: '2026-06-28', saleToList: 1.019 },
  { address: 'Teton Heights Lot 9', soldPrice: 95000, listPrice: 99500, daysOnMarket: 28, soldDate: '2026-05-01', saleToList: 0.955 },
  { address: 'Teton Heights Lot 14', soldPrice: 102000, listPrice: 99500, daysOnMarket: 14, soldDate: '2026-06-10', saleToList: 1.025 },
];

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}

function avg(nums: number[]) {
  if (!nums.length) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pickComps(property: OfferProperty, comps: CompSignal[]): CompSignal[] {
  if (property.isLand) {
    return comps.filter((c) => /lot|land|teton heights/i.test(c.address)).slice(0, 4);
  }
  const withSqft = comps.filter((c) => c.sqft && c.sqft > 0);
  if (property.sqft && withSqft.length) {
    return [...withSqft]
      .sort((a, b) => Math.abs((a.sqft || 0) - property.sqft!) - Math.abs((b.sqft || 0) - property.sqft!))
      .slice(0, 5);
  }
  return comps.filter((c) => c.sqft).slice(0, 5);
}

/**
 * Core decision model — transparent, explainable scores.
 */
export function evaluateOffer(
  property: OfferProperty,
  terms: OfferTerms,
  comps: CompSignal[] = DEMO_COMPS
): OfferDecision {
  const list = property.listPrice;
  const offer = terms.offerPrice;
  const pctOfList = list > 0 ? offer / list : 1;
  const used = pickComps(property, comps);

  const saleToLists = used.map((c) => c.saleToList ?? (c.listPrice ? c.soldPrice / c.listPrice : 1));
  const avgStl = avg(saleToLists) || 0.98;
  const avgDom = avg(used.map((c) => c.daysOnMarket)) || 25;
  const dom = property.daysOnMarket ?? Math.round(avgDom);

  // Price score: how close offer is to expected clearing price
  const expectedClear = list * avgStl;
  const priceDelta = (offer - expectedClear) / expectedClear;
  let priceScore = 50 + priceDelta * 200; // ±10% → ±20 pts roughly scaled
  priceScore = clamp(priceScore, 5, 95);

  // Market score: DOM pressure (stale listings favor buyers)
  let marketScore = 50;
  if (dom > avgDom * 1.5) marketScore = 72; // stale — buyer leverage
  else if (dom > avgDom) marketScore = 60;
  else if (dom < avgDom * 0.4) marketScore = 28; // hot — seller leverage
  else if (dom < avgDom * 0.7) marketScore = 38;

  // Terms score
  let termsScore = 55;
  const strengths: string[] = [];
  const risks: string[] = [];

  if (terms.cash) {
    termsScore += 18;
    strengths.push('Cash removes financing risk — strong signal to seller');
  } else if (terms.financingContingency === false) {
    termsScore += 8;
    strengths.push('No financing contingency improves acceptance odds');
  } else {
    termsScore -= 4;
    risks.push('Financing contingency is standard but slightly weaker than cash');
  }

  if (terms.inspectionContingency === false) {
    termsScore += 10;
    strengths.push('Waived inspection is aggressive — use only when risk is understood');
    risks.push('Waiving inspection increases buyer risk');
  }

  if (terms.appraisalContingency === false && !terms.cash) {
    termsScore += 6;
    strengths.push('Appraisal gap coverage / waived appraisal strengthens offer');
  }

  const earnest = terms.earnestMoney ?? Math.round(offer * 0.02);
  const earnestPct = earnest / offer;
  if (earnestPct >= 0.03) {
    termsScore += 8;
    strengths.push(`Strong earnest (${Math.round(earnestPct * 100)}% of offer)`);
  } else if (earnestPct < 0.01) {
    termsScore -= 8;
    risks.push('Low earnest money may signal weak commitment');
  }

  const close = terms.closingDays ?? 30;
  if (close <= 21) {
    termsScore += 6;
    strengths.push('Fast close is attractive to many sellers');
  } else if (close > 45) {
    termsScore -= 5;
    risks.push('Long close can be a friction point');
  }

  if (terms.escalationMax && terms.escalationMax > offer) {
    termsScore += 7;
    strengths.push(
      `Escalation up to $${terms.escalationMax.toLocaleString()} competes without overpaying day one`
    );
  }

  termsScore = clamp(termsScore, 10, 95);

  // Blend → win probability
  // Price dominates, then terms, then market
  const winProbability = Math.round(
    clamp(priceScore * 0.5 + termsScore * 0.3 + marketScore * 0.2, 3, 97)
  );

  const recommendedPrice = Math.round(expectedClear / 1000) * 1000;
  const recommendedPriceLow = Math.round((expectedClear * 0.97) / 1000) * 1000;
  const recommendedPriceHigh = Math.round((expectedClear * 1.02) / 1000) * 1000;

  let confidence: OfferDecision['confidence'] = 'medium';
  if (used.length >= 4 && Math.abs(priceDelta) < 0.05) confidence = 'high';
  if (used.length < 2) confidence = 'low';

  if (pctOfList >= 1.0) strengths.push('At or above list — competitive posture');
  if (pctOfList < 0.95) risks.push('Offer is >5% under list — expect counter or pass in this market');
  if (dom < 10 && pctOfList < 0.98) risks.push('Fresh listing + under-list offer faces stiff competition');

  let escalationAdvice: string | undefined;
  if (dom < 14 && pctOfList < 1.0) {
    escalationAdvice = `Consider escalation: start at $${offer.toLocaleString()}, beat competing offers by $${(terms.escalationOver || 1000).toLocaleString()} up to $${(terms.escalationMax || Math.round(list * 1.03)).toLocaleString()}.`;
  }

  const narrative = buildNarrative({
    winProbability,
    pctOfList,
    avgStl,
    dom,
    avgDom,
    recommendedPrice,
    list,
    offer,
    property,
  });

  return {
    winProbability,
    confidence,
    priceScore: Math.round(priceScore),
    termsScore: Math.round(termsScore),
    marketScore: Math.round(marketScore),
    recommendedPrice,
    recommendedPriceLow,
    recommendedPriceHigh,
    saleToListEstimate: Math.round(avgStl * 1000) / 1000,
    suggestedEarnest: Math.round(recommendedPrice * 0.02),
    suggestedClosingDays: dom < 14 ? 21 : 30,
    narrative,
    risks,
    strengths,
    escalationAdvice,
    compsUsed: used,
    listPrice: list,
    offerPrice: offer,
    pctOfList: Math.round(pctOfList * 1000) / 1000,
  };
}

function buildNarrative(p: {
  winProbability: number;
  pctOfList: number;
  avgStl: number;
  dom: number;
  avgDom: number;
  recommendedPrice: number;
  list: number;
  offer: number;
  property: OfferProperty;
}): string {
  const city = p.property.city || 'Jefferson County';
  const tone =
    p.winProbability >= 70
      ? 'This offer is well-positioned to win'
      : p.winProbability >= 45
        ? 'This offer is competitive but not a lock'
        : 'This offer is likely to face resistance';

  return (
    `${tone} in the current ${city} market. ` +
    `Comparable sales are clearing around ${Math.round(p.avgStl * 100)}% of list. ` +
    `This property has been on market ~${p.dom} days (area avg ~${Math.round(p.avgDom)}). ` +
    `Your offer of $${p.offer.toLocaleString()} is ${Math.round(p.pctOfList * 100)}% of the $${p.list.toLocaleString()} list price. ` +
    `Data-backed target band: $${p.recommendedPrice.toLocaleString()} (± a few thousand depending on terms).`
  );
}

export const DEMO_PROPERTIES: OfferProperty[] = [
  {
    address: '789 Lindy Lane, Rigby',
    listPrice: 489000,
    sqft: 1680,
    beds: 3,
    baths: 2,
    daysOnMarket: 12,
    city: 'Rigby',
    propertyType: 'Single Family',
  },
  {
    address: '172 Kiana Dr, Rigby',
    listPrice: 512000,
    sqft: 1850,
    beds: 4,
    baths: 2.5,
    daysOnMarket: 5,
    city: 'Rigby',
    propertyType: 'Single Family',
    isNewConstruction: true,
  },
  {
    address: 'Teton Heights Lot 14',
    listPrice: 99500,
    acres: 0.28,
    daysOnMarket: 22,
    city: 'Rigby',
    propertyType: 'Land',
    isLand: true,
  },
];
