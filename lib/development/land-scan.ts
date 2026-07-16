// lib/development/land-scan.ts
// Scores current Navica/Archibald-Bagley land listings for development upside.
// Works in DEMO mode (Navica fetch falls back to Jefferson County demo data).

import { fetchArchibaldNavicaListings } from '@/lib/import/navica';
import { analyzeListing, type LandAnalysis } from './land-engine';

export interface ScoredDeal extends LandAnalysis {
  id?: string; address: string; url?: string; price: number;
}
export interface LandScanResult {
  scannedAt: string; source: string;
  listingsScanned: number; analyzed: number;
  penciling: ScoredDeal[]; deals: ScoredDeal[];
}

export async function scanLandDeals(opts: { minAcres?: number; limit?: number } = {}): Promise<LandScanResult> {
  const minAcres = opts.minAcres ?? 5;
  const res = await fetchArchibaldNavicaListings(opts.limit ?? 100);
  const deals: ScoredDeal[] = [];
  for (const l of res.listings) {
    if (!l.acres || l.acres < minAcres || !l.price) continue;
    const a = analyzeListing(l as any);
    if (!a) continue;
    deals.push({ id: l.externalId, address: l.address, url: l.url, price: l.price, ...a });
  }
  deals.sort((x, y) => y.spread - x.spread);
  return {
    scannedAt: new Date().toISOString(), source: res.source,
    listingsScanned: res.listings.length, analyzed: deals.length,
    penciling: deals.filter(d => d.verdict === 'OFFER'), deals,
  };
}
