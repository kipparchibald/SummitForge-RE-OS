import { parse as parseCSV } from 'papaparse'; // Assume we'll add papaparse for robust CSV

export interface NormalizedListing {
  source: string;
  externalId?: string;
  address: string;
  price: number;
  acres?: number;
  propertyType: string;
  description?: string;
  url?: string;
  geometry?: any; // GeoJSON if available
  rawData: any;
}

export async function importListings(input: File | string | any[], source: 'mls' | 'zillow' | 'landwatch' | 'landsofamerica' | 'other' = 'mls'): Promise<{ imported: number; listings: NormalizedListing[] }> {
  let rawData: any[] = [];

  if (Array.isArray(input)) {
    rawData = input;
  } else if (typeof input === 'string') {
    // URL or raw text/JSON
    if (input.startsWith('http')) {
      // For URLs: In production, integrate Apify or scraper. For MVP, placeholder enrichment
      console.log(`Fetching/enriching from URL: ${input}`);
      // Simulate or call enrichment service
      rawData = [{ url: input, address: 'Parsed from URL', price: 0 }]; // Replace with real fetch
    } else {
      try {
        rawData = JSON.parse(input);
      } catch {
        // Assume CSV text
        rawData = parseCSVText(input);
      }
    }
  } else if (input instanceof File) {
    const text = await input.text();
    if (text.trim().startsWith('{') || text.trim().startsWith('[')) {
      rawData = JSON.parse(text);
    } else {
      rawData = parseCSVText(text);
    }
  }

  const normalized: NormalizedListing[] = rawData
    .map(row => normalizeRow(row, source))
    .filter(Boolean) as NormalizedListing[];

  const landListings = normalized.filter(l => 
    l.propertyType.toLowerCase().includes('land') || 
    l.propertyType.toLowerCase().includes('vacant') ||
    (l.acres && l.acres > 0.5)
  );

  for (const listing of landListings) {
    // Trigger raw land projection (call your existing module)
    await triggerRawLandProjection(listing);
    // TODO: Save to Supabase listings table with geometry if available
  }

  return { imported: landListings.length, listings: landListings };
}

function parseCSVText(csvText: string): any[] {
  // Robust CSV parsing with papaparse or simple split (add papaparse to package.json)
  const results = parseCSV(csvText, { header: true, skipEmptyLines: true });
  return results.data || [];
}

function normalizeRow(row: any, source: string): NormalizedListing | null {
  try {
    const address = row.address || row['Street Address'] || row['Property Address'] || row.location || '';
    const price = parseFloat(row.price || row['List Price'] || row['Asking Price'] || row.price || 0);
    const acres = parseFloat(row.acres || row['Acres'] || row['Lot Size'] || row['Total Acres'] || 0);
    const propertyType = row['Property Type'] || row.type || row['Home Type'] || 'Land';
    const description = row.description || row['Public Remarks'] || '';

    if (!address || price <= 0) return null;

    return {
      source,
      externalId: row.id || row.zpid || row.pid || row['MLS #'],
      address,
      price,
      acres: acres || undefined,
      propertyType,
      description,
      url: row.url || row['Listing URL'] || row.link,
      rawData: row
    };
  } catch (e) {
    console.error('Normalization error for row:', row, e);
    return null;
  }
}

async function triggerRawLandProjection(listing: NormalizedListing) {
  console.log(`Triggering raw land projection for: ${listing.address}`);
  // Integrate with your lib/analysis/raw-land.ts
  // Example: await runRawLandProjection({ ...listing, zoning: 'R-1' /* from GIS */ });
  // This will calculate lot yield, infra estimates, IRR etc.
}