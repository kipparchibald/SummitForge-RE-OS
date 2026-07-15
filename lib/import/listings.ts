import { parse as parseCSV } from 'papaparse';
import { findMatchesForListing } from '@/lib/alerts/matching';
import { processMatchesForNotification } from '@/lib/alerts/notifications';
import type { Alert, Listing as AlertListing } from '@/types/alerts';

export interface NormalizedListing {
  source: string;
  externalId?: string;
  address: string;
  price: number;
  acres?: number;
  propertyType: string;
  description?: string;
  url?: string;
  geometry?: any;
  rawData: any;
  city?: string;
  isNewConstruction?: boolean;
}

export async function importListings(
  input: File | string | any[],
  source: 'mls' | 'zillow' | 'landwatch' | 'landsofamerica' | 'other' = 'mls',
  options?: {
    alerts?: Alert[];
    runMatching?: boolean;
  }
): Promise<{
  imported: number;
  listings: NormalizedListing[];
  matches?: any[];
  notifications?: any[];
}> {
  let rawData: any[] = [];

  if (Array.isArray(input)) {
    rawData = input;
  } else if (typeof input === 'string') {
    if (input.startsWith('http')) {
      console.log(`Fetching/enriching from URL: ${input}`);
      rawData = [{ url: input, address: 'Parsed from URL', price: 0 }];
    } else {
      try {
        rawData = JSON.parse(input);
      } catch {
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

  let matches: any[] = [];
  let notifications: any[] = [];

  if (options?.runMatching && options.alerts && options.alerts.length > 0) {
    const alertListings: AlertListing[] = normalized.map((n, idx) => ({
      id: n.externalId || `imported_${idx}`,
      mlsNumber: n.externalId || `imported_${idx}`,
      address: n.address,
      city: n.city || 'Unknown',
      location: mapCityToLocation(n.city || n.address),
      price: n.price,
      acres: n.acres,
      propertyType: mapPropertyType(n.propertyType),
      isNewConstruction: n.isNewConstruction ?? false,
      description: n.description,
      url: n.url,
      importedAt: new Date().toISOString(),
    }));

    for (const listing of alertListings) {
      const listingMatches = findMatchesForListing(listing, options.alerts);
      // Prefer SMS channel on match when alert wants SMS
      for (const m of listingMatches) {
        const alert = options.alerts.find(a => a.id === m.alertId);
        if (alert?.notifyBy.includes('sms')) {
          m.notificationMethod = 'sms';
        } else if (alert?.notifyBy.includes('in-app')) {
          m.notificationMethod = 'in-app';
        }
      }
      matches.push(...listingMatches);
    }

    if (matches.length > 0) {
      notifications = await processMatchesForNotification(
        matches,
        options.alerts,
        alertListings,
        {
          sendSms: true,
          phoneLookup: (alert) => alert.phone,
        }
      );
      console.log(
        `[Import] Generated ${matches.length} matches and ${notifications.length} notification payloads`
      );
    }
  }

  const landListings = normalized.filter(
    l =>
      l.propertyType.toLowerCase().includes('land') ||
      l.propertyType.toLowerCase().includes('vacant') ||
      (l.acres && l.acres > 0.5)
  );

  for (const listing of landListings) {
    await triggerRawLandProjection(listing);
  }

  return {
    imported: normalized.length,
    listings: normalized,
    matches,
    notifications,
  };
}

function parseCSVText(csvText: string): any[] {
  const results = parseCSV(csvText, { header: true, skipEmptyLines: true });
  return results.data || [];
}

function normalizeRow(row: any, source: string): NormalizedListing | null {
  try {
    const address =
      row.address || row['Street Address'] || row['Property Address'] || row.location || '';
    const price = parseFloat(
      row.price || row['List Price'] || row['Asking Price'] || row.price || 0
    );
    const acres = parseFloat(
      row.acres || row['Acres'] || row['Lot Size'] || row['Total Acres'] || 0
    );
    const propertyType =
      row['Property Type'] || row.type || row['Home Type'] || 'Land';
    const description = row.description || row['Public Remarks'] || '';
    const city = row.city || row.City || row['City'] || '';

    if (!address || price <= 0) return null;

    return {
      source,
      externalId: row.id || row.zpid || row.pid || row['MLS #'] || row['MLS Number'],
      address,
      city,
      price,
      acres: acres || undefined,
      propertyType,
      description,
      url: row.url || row['Listing URL'] || row.link,
      isNewConstruction: /new construction|new build|spec/i.test(
        propertyType + ' ' + description
      ),
      rawData: row,
    };
  } catch (e) {
    console.error('Normalization error for row:', row, e);
    return null;
  }
}

function mapCityToLocation(city: string): any {
  const normalized = (city || '').toLowerCase().trim();
  if (normalized.includes('rigby')) return 'Rigby';
  if (normalized.includes('ririe')) return 'Ririe';
  if (normalized.includes('roberts')) return 'Roberts';
  if (normalized.includes('hamer')) return 'Hamer';
  if (normalized.includes('terreton') || normalized.includes('mud lake')) return 'Terreton';
  if (normalized.includes('idaho falls')) return 'Idaho Falls Area';
  return 'Other';
}

function mapPropertyType(type: string): any {
  const t = (type || '').toLowerCase();
  if (t.includes('single')) return 'Single Family';
  if (t.includes('new') || t.includes('construction')) return 'New Construction';
  if (t.includes('land') || t.includes('vacant')) return 'Land';
  if (t.includes('farm') || t.includes('ranch')) return 'Farm/Ranch';
  if (t.includes('multi')) return 'Multi-Family';
  if (t.includes('commercial')) return 'Commercial';
  return 'Single Family';
}

async function triggerRawLandProjection(listing: NormalizedListing) {
  console.log(`Triggering raw land projection for: ${listing.address}`);
}
