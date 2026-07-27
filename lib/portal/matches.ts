/**
 * Client portal match feed — bridges alert matches → buyer portal.
 * Zillow-style: new MLS matches surface in the portal with schedule CTA.
 */

export type PortalMatch = {
  id: string;
  address: string;
  city?: string;
  price: number;
  acres?: number;
  beds?: number;
  baths?: number;
  sqft?: number;
  propertyType?: string;
  status?: string;
  matchScore: number;
  alertName?: string;
  mlsNumber?: string;
  matchedAt: string;
  isNew: boolean;
  listingId?: string;
};

const PORTAL_MATCHES_KEY = 'sf_portal_matches';
const PORTAL_SEEN_KEY = 'sf_portal_seen_matches';

export function loadPortalMatches(): PortalMatch[] {
  if (typeof window === 'undefined') return DEMO_PORTAL_MATCHES;
  try {
    const raw = localStorage.getItem(PORTAL_MATCHES_KEY);
    if (!raw) {
      localStorage.setItem(PORTAL_MATCHES_KEY, JSON.stringify(DEMO_PORTAL_MATCHES));
      return DEMO_PORTAL_MATCHES;
    }
    return JSON.parse(raw) as PortalMatch[];
  } catch {
    return DEMO_PORTAL_MATCHES;
  }
}

export function savePortalMatches(list: PortalMatch[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PORTAL_MATCHES_KEY, JSON.stringify(list));
}

export function getSeenMatchIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(PORTAL_SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function markMatchSeen(id: string) {
  if (typeof window === 'undefined') return;
  const seen = getSeenMatchIds();
  seen.add(id);
  localStorage.setItem(PORTAL_SEEN_KEY, JSON.stringify([...seen]));
}

/**
 * Ingest alert matches into the portal feed (called after Navica sync / rematch).
 */
export function ingestAlertMatches(
  matches: Array<{
    id: string;
    matchScore: number;
    matchedAt: string;
    alertName?: string;
    listingId?: string;
    listingSnapshot?: {
      address?: string;
      city?: string;
      price?: number;
      acres?: number;
      propertyType?: string;
      mlsNumber?: string;
      isNewConstruction?: boolean;
    };
  }>
): PortalMatch[] {
  const existing = loadPortalMatches();
  const byId = new Map(existing.map((m) => [m.id, m]));
  const seen = getSeenMatchIds();

  for (const m of matches) {
    const snap = m.listingSnapshot;
    if (!snap?.address || !snap.price) continue;
    const portal: PortalMatch = {
      id: m.id,
      address: snap.address,
      city: snap.city,
      price: snap.price,
      acres: snap.acres,
      propertyType: snap.propertyType,
      status: snap.isNewConstruction ? 'New Construction' : 'Active',
      matchScore: m.matchScore,
      alertName: m.alertName,
      mlsNumber: snap.mlsNumber,
      matchedAt: m.matchedAt,
      isNew: !seen.has(m.id),
      listingId: m.listingId,
    };
    byId.set(m.id, portal);
  }

  const merged = Array.from(byId.values()).sort(
    (a, b) => new Date(b.matchedAt).getTime() - new Date(a.matchedAt).getTime()
  );
  savePortalMatches(merged);
  return merged;
}

export const DEMO_PORTAL_MATCHES: PortalMatch[] = [
  {
    id: 'pm_1',
    address: '789 Lindy Lane, Rigby',
    city: 'Rigby',
    price: 489000,
    beds: 3,
    baths: 2,
    sqft: 1680,
    propertyType: 'Single Family',
    status: 'Pending Contingent',
    matchScore: 94,
    alertName: 'Rigby single-level under 525k',
    matchedAt: new Date().toISOString(),
    isNew: true,
  },
  {
    id: 'pm_2',
    address: '172 Kiana Dr, Rigby',
    city: 'Rigby',
    price: 512000,
    beds: 4,
    baths: 2.5,
    sqft: 1850,
    propertyType: 'Single Family',
    status: 'Coming Soon',
    matchScore: 91,
    alertName: 'Rigby single-level under 525k',
    matchedAt: new Date(Date.now() - 86400000).toISOString(),
    isNew: false,
  },
  {
    id: 'pm_3',
    address: 'Teton Heights Lot 14',
    city: 'Rigby',
    price: 99500,
    acres: 0.28,
    propertyType: 'Land',
    status: 'Active Land',
    matchScore: 88,
    alertName: 'Rigby lots',
    matchedAt: new Date(Date.now() - 172800000).toISOString(),
    isNew: false,
  },
];

export type ShowingRequest = {
  id: string;
  matchId: string;
  address: string;
  requestedAt: string;
  preferredTimes?: string;
  notes?: string;
  status: 'pending' | 'confirmed' | 'declined';
};

const SHOWING_KEY = 'sf_portal_showings';

export function loadShowingRequests(): ShowingRequest[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SHOWING_KEY);
    return raw ? (JSON.parse(raw) as ShowingRequest[]) : [];
  } catch {
    return [];
  }
}

export function requestShowing(
  match: PortalMatch,
  preferredTimes?: string,
  notes?: string
): ShowingRequest {
  const req: ShowingRequest = {
    id: `show_${Date.now()}`,
    matchId: match.id,
    address: match.address,
    requestedAt: new Date().toISOString(),
    preferredTimes,
    notes,
    status: 'pending',
  };
  const all = loadShowingRequests();
  all.unshift(req);
  if (typeof window !== 'undefined') {
    localStorage.setItem(SHOWING_KEY, JSON.stringify(all));
  }
  markMatchSeen(match.id);
  return req;
}
