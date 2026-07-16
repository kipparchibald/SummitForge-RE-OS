// lib/import/idxSite.ts
// Imports real listings from a brokerage's own IDX website.
//
// Why this exists: the Navica RESO feed needs MLS credentials that take weeks to
// provision. A brokerage's public IDX site already renders its MLS listings, and
// (on Contempo/ct-idx-pro and most modern IDX plugins) each detail page carries a
// schema.org RealEstateListing JSON-LD block — structured address, geo, price,
// size, MLS id, remarks. That is a far better source than scraping markup, and it
// gets real data flowing today.
//
// Compliance: MLS attribution from the page (e.g. "Snake River Regional MLS") is
// carried through to every listing rather than dropped. Confirm with your MLS
// that caching IDX data is permitted before relying on this in production.

import type { NormalizedListing } from './listings';
import { safeFetch } from '@/lib/net/safeFetch';

export interface SiteImportResult {
  listings: NormalizedListing[];
  attribution?: string;
  scanned: number;
  source: string;
}

const DETAIL_RE = /href="(https?:\/\/[^"]*\/property-search\/listings\/detail\/[^"]+)"/gi;

/** Detail-page URLs linked from an index page, de-duplicated. */
export function extractDetailUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const m of html.matchAll(DETAIL_RE)) {
    urls.add(m[1].split('#')[0]);
  }
  return [...urls];
}

function jsonLdListing(html: string): any | null {
  const blocks = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const block of blocks) {
    const body = block.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, '');
    try {
      const data = JSON.parse(body);
      const nodes = Array.isArray(data) ? data : data['@graph'] || [data];
      for (const n of nodes) {
        if (n && n['@type'] === 'RealEstateListing') return n;
      }
    } catch {
      // A malformed block on one page must not abort the whole import.
    }
  }
  return null;
}

/**
 * Acres and the human property type are not in the JSON-LD — they appear in the
 * page's summary line, e.g.
 *   "… is a 4 Bed, 4 Bath, 2,098 Sq Ft, 0.46 Acres, Single Family Home built in 1975."
 */
function acresFromHtml(html: string): number | undefined {
  // Anchor to the summary sentence first. Matching the first "Acres" anywhere on
  // a ~250KB page risks picking up a nearby-listings card or a filter control.
  const m =
    html.match(/is a[^<]{0,120}?([\d,]+(?:\.\d+)?)\s*Acres?\b/i) ||
    html.match(/([\d,]+(?:\.\d+)?)\s*Acres?\b/i);
  if (!m) return undefined;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function propertyTypeFromHtml(html: string, fallback: string): string {
  const m = html.match(/Acres?,\s*([A-Za-z /-]+?)\s+built in/i) || html.match(/Sq Ft,\s*([A-Za-z /-]+?)\s+built in/i);
  const t = m?.[1]?.trim();
  if (t) return t;
  // Vacant land pages say "Lot / Land" or similar rather than "built in".
  if (/\b(vacant land|lots?\s*\/\s*land|raw land|residential lots?)\b/i.test(html)) return 'Land';
  return fallback;
}

function attributionFrom(node: any): string | undefined {
  return (
    node?.sourceOrganization?.name ||
    node?.provider?.name ||
    undefined
  );
}

/** Map one detail page to a NormalizedListing. Returns null if it isn't usable. */
export function parseDetailPage(html: string, url: string): NormalizedListing | null {
  const node = jsonLdListing(html);
  if (!node) return null;

  const entity = node.mainEntity || {};
  const addr = entity.address || {};
  const price = Number(entity.offers?.price ?? 0);
  const street = addr.streetAddress || '';
  const city = addr.addressLocality || '';
  if (!street && !node.name) return null;

  const mls = node.identifier?.value ? String(node.identifier.value) : undefined;
  const geo = entity.geo;
  const propertyType = propertyTypeFromHtml(html, entity['@type'] === 'SingleFamilyResidence' ? 'Single Family' : 'Land');
  const description = node.description || entity.description || '';

  return {
    source: 'idx-site',
    externalId: mls,
    address: node.name || [street, city, addr.addressRegion].filter(Boolean).join(', '),
    city,
    price: Number.isFinite(price) ? price : 0,
    acres: acresFromHtml(html),
    propertyType,
    isNewConstruction: /new construction|to be built|under construction/i.test(
      `${propertyType} ${description}`
    ),
    description,
    url,
    geometry:
      geo?.latitude != null && geo?.longitude != null
        ? { type: 'Point', coordinates: [Number(geo.longitude), Number(geo.latitude)] }
        : undefined,
    rawData: {
      mls,
      sqft: entity.floorSize?.value,
      beds: entity.numberOfBedrooms,
      baths: entity.numberOfBathroomsTotal,
      yearBuilt: entity.yearBuilt,
      datePosted: node.datePosted,
      dateModified: node.dateModified,
      images: Array.isArray(node.image) ? node.image.slice(0, 8) : [],
      attribution: attributionFrom(node),
    },
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Pull listings from a brokerage IDX site.
 * Bounded by `limit` — each detail page is ~250KB, so an unbounded run would
 * hammer the site and blow the serverless time budget.
 */
export async function fetchSiteListings(
  baseUrl = 'https://www.archibaldbagley.com/',
  limit = 24,
  concurrency = 5
): Promise<SiteImportResult> {
  const indexRes = await safeFetch(baseUrl, {
    headers: { 'User-Agent': 'SummitForge-RE-OS/1.0 (listing-import)' },
  });
  const indexHtml = await indexRes.text();
  const urls = extractDetailUrls(indexHtml).slice(0, limit);

  const parsed = await mapWithConcurrency(urls, concurrency, async (u) => {
    try {
      const res = await safeFetch(u, {
        headers: { 'User-Agent': 'SummitForge-RE-OS/1.0 (listing-import)' },
      });
      if (!res.ok) return null;
      return parseDetailPage(await res.text(), u);
    } catch {
      return null; // one bad page shouldn't fail the batch
    }
  });

  const listings = parsed.filter(Boolean) as NormalizedListing[];
  return {
    listings,
    attribution: listings.find((l) => l.rawData?.attribution)?.rawData?.attribution,
    scanned: urls.length,
    source: `idx-site (${new URL(baseUrl).hostname})`,
  };
}
