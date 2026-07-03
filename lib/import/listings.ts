import { parseCSV } from '../utils/csv';
import { runRawLandProjection } from '../analysis/raw-land';

export async function importListings(file: File | string, source: 'mls' | 'zillow' | 'landwatch' | 'other') {
  let data;
  if (typeof file === 'string') {
    // URL or raw text
    data = await fetchOrParse(file);
  } else {
    data = await parseCSV(file);
  }

  const landListings = data.filter(l => l.propertyType?.toLowerCase().includes('land') || l.acres);

  for (const listing of landListings) {
    await runRawLandProjection(listing); // Auto-triggers raw land analysis
    // Save to DB
  }

  return { imported: landListings.length, source };
}

function fetchOrParse(input: string) {
  // Placeholder: for URLs, integrate scraper or API
  // For now, assume pasted JSON/CSV text or manual enrichment
  return JSON.parse(input); // or CSV parse
}