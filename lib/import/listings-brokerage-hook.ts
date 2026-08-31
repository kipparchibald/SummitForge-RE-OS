// Thin wrapper so live-navica / CMA jobs hit the brokerage feed first.
import { fetchBrokerageLiveListings } from './brokerageLive';
import { fetchArchibaldNavicaListings, type NavicaFetchResult, type NavicaListFilters } from './navica';
import { isLandListing } from './navica';
import { setRecentListings } from './recentListings';
import { saveListings } from '../supabase/client';

export async function fetchPreferredMlsListings(
  limit = 100,
  filters?: NavicaListFilters,
): Promise<NavicaFetchResult> {
  const lastSync = new Date().toISOString();
  const brokerage = await fetchBrokerageLiveListings(limit, filters);
  if (brokerage?.length) {
    let listings = brokerage;
    if (filters?.landOnly) listings = listings.filter(isLandListing);
    setRecentListings(listings);
    await saveListings(listings);
    return {
      success: true,
      count: listings.length,
      landCount: listings.filter(isLandListing).length,
      byType: {},
      listings: listings.slice(0, limit),
      source: 'live (archibaldbagley.com /api/listings/live · public IDX)',
      lastSync,
    };
  }
  return fetchArchibaldNavicaListings(limit, filters);
}
