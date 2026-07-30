// lib/security/headers.ts
// Shared security / privacy headers for middleware + next.config.

import type { NextResponse } from 'next/server';

/** Apply baseline security headers to a NextResponse (middleware path). */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const h = response.headers;
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('X-Frame-Options', 'DENY');
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  h.set('X-DNS-Prefetch-Control', 'on');
  h.set('Permissions-Policy', 'camera=(), microphone=(self), geolocation=(), payment=()');
  // Do not force HSTS here — only production HTTPS (Vercel sets edge HSTS).
  // Cross-origin isolation not required for this app.
  h.set('Cross-Origin-Opener-Policy', 'same-origin');
  h.set('Cross-Origin-Resource-Policy', 'same-site');
  return response;
}

/** next.config headers() entries */
export const NEXT_SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(), payment=()',
  },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  { key: 'Cross-Origin-Resource-Policy', value: 'same-site' },
  // Soft CSP: report-friendly baseline without breaking Mapbox / Supabase / fonts
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://api.mapbox.com https://*.mapbox.com",
      "style-src 'self' 'unsafe-inline' https://api.mapbox.com https://*.mapbox.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss: blob:",
      "worker-src 'self' blob:",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join('; '),
  },
] as const;
