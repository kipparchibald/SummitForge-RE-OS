// lib/net/safeFetch.ts
// SSRF guard for user-supplied import URLs. Rejects non-http(s) schemes and
// hosts that resolve to loopback, private, or link-local ranges so an attacker
// cannot make the server fetch internal services or cloud metadata endpoints.

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  '0.0.0.0',
  '169.254.169.254', // cloud instance metadata (AWS/GCP/Azure)
  'metadata.google.internal',
]);

function isPrivateIPv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [parseInt(m[1], 10), parseInt(m[2], 10)];
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 127) return true; // loopback
  if (a === 169 && b === 254) return true; // link-local
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  return false;
}

export function assertPublicUrl(rawUrl: string): URL {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('Invalid URL');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Blocked URL scheme: ${url.protocol}`);
  }
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTNAMES.has(host) || host.endsWith('.local') || host.endsWith('.internal')) {
    throw new Error('Blocked host');
  }
  if (isPrivateIPv4(host) || host.startsWith('[')) {
    // Bare IPv6 literals (in brackets) are refused outright — no allowlisted use case.
    throw new Error('Blocked host');
  }
  return url;
}

const MAX_REDIRECTS = 5;

/**
 * fetch() that first validates the URL is public. Note: this checks the literal
 * hostname, not post-DNS resolution, so it does not defend against DNS-rebinding
 * — sufficient for blocking the obvious metadata/localhost/private-range targets.
 *
 * Redirects are followed manually and every hop is re-validated. Handing
 * `redirect: 'follow'` to fetch would let a public URL bounce the request to an
 * internal address with no further checks; refusing redirects outright (the
 * previous behaviour) instead broke ordinary sites, since most apex domains
 * 301 to www. Following hop-by-hop keeps the guard on each destination.
 */
export async function safeFetch(rawUrl: string, init?: RequestInit): Promise<Response> {
  let url = assertPublicUrl(rawUrl);

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.toString(), { ...init, redirect: 'manual' });

    const isRedirect = res.status >= 300 && res.status < 400 && res.headers.has('location');
    if (!isRedirect) return res;

    const location = res.headers.get('location')!;
    // Relative Locations resolve against the current hop.
    url = assertPublicUrl(new URL(location, url).toString());
  }

  throw new Error(`Too many redirects (>${MAX_REDIRECTS})`);
}
