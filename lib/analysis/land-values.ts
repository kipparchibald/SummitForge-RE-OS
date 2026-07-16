// lib/analysis/land-values.ts
// Representative raw-land values by market across the seven covered counties.
//
// Shared by the analytics panel and the printable land report so the two cannot
// drift apart. These are planning figures for the preview experience — once the
// Navica feed is live, derive them from imported comps instead (see
// deriveLandValuesFromListings below).

import type { County } from '@/lib/geo/counties';

export interface LandValue {
  market: string;
  county: County;
  perAcre: number;
  /** Year-over-year direction; undefined = flat/insufficient data. */
  yoyPct?: number;
}

export const LAND_VALUES: LandValue[] = [
  { market: 'Driggs', county: 'Teton', perAcre: 62500, yoyPct: 11.2 },
  { market: 'Victor', county: 'Teton', perAcre: 54800, yoyPct: 9.4 },
  { market: 'Rexburg', county: 'Madison', perAcre: 38900, yoyPct: 8.1 },
  { market: 'Idaho Falls', county: 'Bonneville', perAcre: 34200, yoyPct: 6.8 },
  { market: 'Ammon', county: 'Bonneville', perAcre: 31500, yoyPct: 6.2 },
  { market: 'Rigby', county: 'Jefferson', perAcre: 27800, yoyPct: 7.4 },
  { market: 'Sugar City', county: 'Madison', perAcre: 26400, yoyPct: 5.9 },
  { market: 'Pocatello', county: 'Bannock', perAcre: 24100, yoyPct: 2.1 },
  { market: 'Chubbuck', county: 'Bannock', perAcre: 22700, yoyPct: 1.8 },
  { market: 'Roberts', county: 'Jefferson', perAcre: 21600, yoyPct: 5.1 },
  { market: 'Shelley', county: 'Bingham', perAcre: 20800, yoyPct: 3.2 },
  { market: 'Blackfoot', county: 'Bingham', perAcre: 19300, yoyPct: 2.4 },
  { market: 'St. Anthony', county: 'Fremont', perAcre: 17500, yoyPct: 3.6 },
  { market: 'Ashton', county: 'Fremont', perAcre: 16200 },
  { market: 'Terreton', county: 'Jefferson', perAcre: 14200 },
  { market: 'Hamer', county: 'Jefferson', perAcre: 12900 },
];

/** Highest-value markets first. */
export function landValuesRanked(): LandValue[] {
  return [...LAND_VALUES].sort((a, b) => b.perAcre - a.perAcre);
}

/** Rolled up by county: average $/acre and the market range within it. */
export function landValuesByCounty(): {
  county: County;
  avgPerAcre: number;
  low: LandValue;
  high: LandValue;
  markets: LandValue[];
}[] {
  const groups = new Map<County, LandValue[]>();
  for (const v of LAND_VALUES) {
    const list = groups.get(v.county) || [];
    list.push(v);
    groups.set(v.county, list);
  }

  return Array.from(groups.entries())
    .map(([county, markets]) => {
      const sorted = [...markets].sort((a, b) => b.perAcre - a.perAcre);
      const avg = Math.round(markets.reduce((s, m) => s + m.perAcre, 0) / markets.length);
      return {
        county,
        avgPerAcre: avg,
        high: sorted[0],
        low: sorted[sorted.length - 1],
        markets: sorted,
      };
    })
    .sort((a, b) => b.avgPerAcre - a.avgPerAcre);
}
