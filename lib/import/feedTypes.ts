// lib/import/feedTypes.ts
// Visibility gating for the Navica combined IDX + BBO feed.
//
// Per Tom Massey (SEI/Navica, 2026-07-17): our single API feed will contain
// both the IDX dataset (publicly displayable under IDX rules) and the BBO
// (Broker Back Office) dataset, with a `FeedTypes` field marking what "can be
// made public and what cannot." Showing a BBO-only record on a public surface
// would violate the data license — so visibility is decided HERE, once, and
// every consumer asks this module rather than re-interpreting the raw field.
//
// Fail-closed: a record whose FeedTypes we cannot read or recognize is treated
// as internal-only. Losing a listing from the public demo is recoverable; a
// license violation is not.
//
// The exact value format arrives with the credentials. RESO feeds commonly use
// a CSV/array like "IDX", "BBO", "IDX,VOW". The parser below accepts the
// obvious shapes; tighten it against real payloads when the feed is live.

export type FeedVisibility = 'public' | 'internal';

const PUBLIC_TOKENS = new Set(['idx', 'public']);

function tokens(raw: unknown): string[] {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map((t) => String(t).trim().toLowerCase()).filter(Boolean);
  return String(raw)
    .split(/[,;|]/)
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * Decide visibility from a raw feed record. Checks the common field spellings;
 * anything unreadable or unrecognized is internal (fail-closed).
 */
export function feedVisibility(row: any): FeedVisibility {
  const raw =
    row?.FeedTypes ?? row?.feedTypes ?? row?.FeedType ?? row?.feed_types ?? row?.feed_type;

  // Records from sources that predate the Navica feed (CSV upload, idx-site
  // import of our own public website) carry no FeedTypes. Those sources are
  // public by construction — the site import literally reads the public site —
  // so absence of the field on a non-Navica record means public.
  if (raw == null && !looksLikeNavicaRecord(row)) return 'public';

  return tokens(raw).some((t) => PUBLIC_TOKENS.has(t)) ? 'public' : 'internal';
}

/** Heuristic: does this raw row come from the Navica API feed? */
function looksLikeNavicaRecord(row: any): boolean {
  if (!row || typeof row !== 'object') return false;
  return (
    'FeedTypes' in row || 'FeedType' in row || 'feed_types' in row ||
    row.source === 'navica' || row.__feed === 'navica'
  );
}

export interface VisibilitySplit<T> {
  publicListings: T[];
  internalListings: T[];
}

/** Split a normalized batch by the visibility recorded on each listing. */
export function splitByVisibility<T extends { visibility?: FeedVisibility }>(
  listings: T[]
): VisibilitySplit<T> {
  const publicListings: T[] = [];
  const internalListings: T[] = [];
  for (const l of listings) {
    (l.visibility === 'internal' ? internalListings : publicListings).push(l);
  }
  return { publicListings, internalListings };
}
