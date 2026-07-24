import { NextResponse } from 'next/server';
import { verifyListingsSchema, isSupabaseLive } from '@/lib/supabase/client';
import { isDemoMode, validateEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';

/**
 * Lightweight health / readiness endpoint for SummitForge.
 * Useful for smoke tests, Vercel monitoring, and diagnosing Navica/Supabase issues.
 *
 * GET /api/health
 */
export async function GET() {
  const env = validateEnv();
  const schema = await verifyListingsSchema();

  const navicaConfigured = !!(process.env.NAVICA_IDX_URL && process.env.NAVICA_API_KEY);
  const cronSecretSet = !!process.env.CRON_SECRET;
  const supabaseLive = isSupabaseLive();

  const status = {
    ok: schema.ok,
    timestamp: new Date().toISOString(),
    mode: isDemoMode() ? 'demo' : 'production',
    supabase: {
      configured: supabaseLive,
      schemaOk: schema.ok,
      hasVisibilityColumn: schema.hasVisibility,
      message: schema.message,
    },
    navica: {
      configured: navicaConfigured,
      note: navicaConfigured
        ? 'Live credentials present — fetchArchibaldNavicaListings will hit the real feed'
        : 'No credentials — using high-quality Eastern Idaho demo land data',
    },
    cron: {
      secretConfigured: cronSecretSet,
      schedule: 'hourly /api/cron/sync-navica (see vercel.json)',
    },
    envWarnings: env.warnings,
  };

  return NextResponse.json(status, {
    status: schema.ok ? 200 : 503,
  });
}
