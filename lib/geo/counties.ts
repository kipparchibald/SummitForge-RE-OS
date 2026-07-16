// lib/geo/counties.ts
// Canonical Eastern Idaho geography. Single source of truth for which counties
// and markets SummitForge covers — alerts, imports, filters, and analytics all
// derive from here rather than hardcoding city lists.
//
// To add coverage: add the county + its cities here. The alerts UI, import
// filters, and city->location mapping pick it up automatically.

import type { Location } from '@/types/alerts';

export type County =
  | 'Jefferson'
  | 'Madison'
  | 'Bonneville'
  | 'Bingham'
  | 'Bannock'
  | 'Fremont'
  | 'Teton';

export interface CountyInfo {
  county: County;
  seat: string;
  /** Markets we surface as alert/filter targets, most active first. */
  locations: Location[];
  /** Extra city spellings seen in MLS feeds that map to a location above. */
  aliases?: Record<string, Location>;
}

export const COUNTIES: CountyInfo[] = [
  {
    county: 'Jefferson',
    seat: 'Rigby',
    locations: ['Rigby', 'Ririe', 'Roberts', 'Menan', 'Lewisville', 'Hamer', 'Terreton'],
    aliases: { 'mud lake': 'Terreton', 'annis': 'Menan' },
  },
  {
    county: 'Madison',
    seat: 'Rexburg',
    locations: ['Rexburg', 'Sugar City'],
  },
  {
    county: 'Bonneville',
    seat: 'Idaho Falls',
    locations: ['Idaho Falls', 'Ammon', 'Iona', 'Ucon', 'Swan Valley', 'Irwin'],
    aliases: { 'idaho falls area': 'Idaho Falls' },
  },
  {
    county: 'Bingham',
    seat: 'Blackfoot',
    locations: ['Blackfoot', 'Shelley', 'Firth', 'Basalt', 'Aberdeen'],
  },
  {
    county: 'Bannock',
    seat: 'Pocatello',
    locations: ['Pocatello', 'Chubbuck', 'Inkom', 'McCammon', 'Lava Hot Springs', 'Downey'],
  },
  {
    county: 'Fremont',
    seat: 'St. Anthony',
    locations: ['St. Anthony', 'Ashton', 'Island Park', 'Parker'],
    aliases: { 'saint anthony': 'St. Anthony', 'st anthony': 'St. Anthony' },
  },
  {
    county: 'Teton',
    seat: 'Driggs',
    locations: ['Driggs', 'Victor', 'Tetonia'],
  },
];

/** Every selectable market, grouped order preserved. */
export const ALL_LOCATIONS: Location[] = COUNTIES.flatMap((c) => c.locations);

/** Location -> County lookup. */
const LOCATION_TO_COUNTY: Record<string, County> = COUNTIES.reduce((acc, c) => {
  c.locations.forEach((loc) => {
    acc[loc] = c.county;
  });
  return acc;
}, {} as Record<string, County>);

export function countyForLocation(location: Location): County | undefined {
  return LOCATION_TO_COUNTY[location];
}

/** Lowercased city/alias -> Location, built once from COUNTIES. */
const CITY_LOOKUP: Record<string, Location> = COUNTIES.reduce((acc, c) => {
  c.locations.forEach((loc) => {
    acc[loc.toLowerCase()] = loc;
  });
  Object.entries(c.aliases || {}).forEach(([alias, loc]) => {
    acc[alias.toLowerCase()] = loc;
  });
  return acc;
}, {} as Record<string, Location>);

/**
 * Map a raw MLS city (or a full address containing one) to a known market.
 * Exact match first, then substring — so "119 Ac 3900 E, Rigby, ID" resolves.
 * Longest names are tried first so "St. Anthony" wins over any shorter overlap.
 */
const SUBSTRING_KEYS = Object.keys(CITY_LOOKUP).sort((a, b) => b.length - a.length);

export function mapCityToLocation(cityOrAddress: string): Location {
  const raw = (cityOrAddress || '').toLowerCase().trim();
  if (!raw) return 'Other';

  const exact = CITY_LOOKUP[raw];
  if (exact) return exact;

  const hit = SUBSTRING_KEYS.find((key) => raw.includes(key));
  return hit ? CITY_LOOKUP[hit] : 'Other';
}

/**
 * Alerts saved before the multi-county expansion used 'Idaho Falls Area'.
 * Normalize so those alerts keep matching instead of silently going dead.
 */
const LEGACY_LOCATIONS: Record<string, Location> = {
  'Idaho Falls Area': 'Idaho Falls',
};

export function normalizeLocation(value: string): Location {
  return (LEGACY_LOCATIONS[value] || value) as Location;
}

/** Human label for headers/marketing copy. */
export const COVERAGE_LABEL = 'Eastern Idaho';
export const COVERAGE_COUNTIES_LABEL = COUNTIES.map((c) => c.county).join(' • ');
