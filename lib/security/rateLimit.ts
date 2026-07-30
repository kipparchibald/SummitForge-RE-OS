// lib/security/rateLimit.ts
// Lightweight in-memory sliding-window rate limiter for App Router handlers.
// Suitable for single-instance / demo and as a first line on Vercel (per-instance).
// Production multi-region: pair with edge/WAF limits; this still stops burst abuse.

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Max requests in the window */
  limit: number;
  /** Window length in milliseconds */
  windowMs: number;
  /** Optional key suffix (e.g. route name) */
  key?: string;
}

export interface RateLimitResult {
  ok: boolean;
  remaining: number;
  retryAfterSec: number;
}

function clientKey(request: Request, suffix?: string): string {
  const xf = request.headers.get('x-forwarded-for');
  const ip =
    (xf && xf.split(',')[0]?.trim()) ||
    request.headers.get('x-real-ip') ||
    request.headers.get('cf-connecting-ip') ||
    'unknown';
  return suffix ? `${ip}:${suffix}` : ip;
}

/** Prune stale keys occasionally so the map does not grow unboundedly. */
function maybeGc(now: number, windowMs: number) {
  if (buckets.size < 500) return;
  for (const [k, b] of buckets) {
    b.timestamps = b.timestamps.filter((t) => now - t < windowMs);
    if (b.timestamps.length === 0) buckets.delete(k);
  }
}

/**
 * Returns whether the request is within the rate limit.
 * Call early in route handlers; on failure respond 429 with Retry-After.
 */
export function rateLimit(request: Request, opts: RateLimitOptions): RateLimitResult {
  const { limit, windowMs, key } = opts;
  const now = Date.now();
  const id = clientKey(request, key);
  maybeGc(now, windowMs);

  let bucket = buckets.get(id);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(id, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => now - t < windowMs);

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now;
    const retryAfterSec = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000));
    return { ok: false, remaining: 0, retryAfterSec };
  }

  bucket.timestamps.push(now);
  return {
    ok: true,
    remaining: Math.max(0, limit - bucket.timestamps.length),
    retryAfterSec: 0,
  };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return new Response(JSON.stringify({ error: 'Too many requests. Slow down and retry.' }), {
    status: 429,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'retry-after': String(result.retryAfterSec || 30),
      'cache-control': 'no-store',
    },
  });
}
