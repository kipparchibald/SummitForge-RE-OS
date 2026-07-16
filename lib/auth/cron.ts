// lib/auth/cron.ts
// Shared authorization for Vercel Cron endpoints.
//
// Fail-closed in production: when NEXT_PUBLIC_DEMO_MODE is not 'true', a request
// MUST present `Authorization: Bearer <CRON_SECRET>` and CRON_SECRET must be set.
// A missing CRON_SECRET in production is treated as "deny", not "allow" — otherwise
// forgetting to configure the secret silently leaves the endpoint world-open.
//
// In demo/local (NEXT_PUBLIC_DEMO_MODE=true), the endpoint is open so it can be
// exercised without a secret.

import { isDemoMode } from '@/lib/env';

export interface CronAuthResult {
  ok: boolean;
  reason?: string;
}

export function authorizeCron(request: Request): CronAuthResult {
  if (isDemoMode()) return { ok: true };

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    // Production with no secret configured — deny rather than expose the endpoint.
    return { ok: false, reason: 'CRON_SECRET not configured' };
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return { ok: false, reason: 'invalid or missing bearer token' };
  }

  return { ok: true };
}
