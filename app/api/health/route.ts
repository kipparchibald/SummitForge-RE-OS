import { NextResponse } from 'next/server';
import { verifyListingsSchema, isSupabaseLive, getSupabaseAdmin } from '@/lib/supabase/client';
import { isDemoMode, validateEnv } from '@/lib/env';
import { aiStatus } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

async function verifyCrmSchema(): Promise<{
  ok: boolean;
  tables: Record<string, boolean>;
  message: string;
}> {
  if (!isSupabaseLive()) {
    return {
      ok: true,
      tables: {},
      message: 'Supabase not configured — CRM schema check skipped',
    };
  }

  const client = getSupabaseAdmin();
  const needed = ['crm_contacts', 'showing_requests', 'nurture_enrollments', 'alerts'] as const;
  const tables: Record<string, boolean> = {};

  for (const t of needed) {
    try {
      const { error } = await client.from(t).select('id').limit(1);
      // missing table → 42P01 / relation does not exist
      const missing =
        !!error &&
        (/relation|does not exist|42P01|schema cache/i.test(error.message || '') ||
          (error as { code?: string }).code === '42P01');
      tables[t] = !missing;
    } catch {
      tables[t] = false;
    }
  }

  const missingList = needed.filter((t) => !tables[t]);
  return {
    ok: missingList.length === 0,
    tables,
    message:
      missingList.length === 0
        ? 'CRM / alerts tables present'
        : `Missing tables: ${missingList.join(', ')}. Apply schema-crm.sql + Sprint 2 migration.`,
  };
}

/**
 * Lightweight health / readiness endpoint for Voxli.dev RE OS.
 * GET /api/health
 */
export async function GET() {
  const env = validateEnv();
  const schema = await verifyListingsSchema();
  const crm = await verifyCrmSchema();

  const navicaConfigured = !!(process.env.NAVICA_IDX_URL && process.env.NAVICA_API_KEY);
  const cronSecretSet = !!process.env.CRON_SECRET;
  const supabaseLive = isSupabaseLive();
  const ai = aiStatus();
  const isDemo = isDemoMode();

  const twilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );

  const brandConfigured = !!(
    process.env.NEXT_PUBLIC_COMPANY_NAME || process.env.NEXT_PUBLIC_BRAND_DOMAIN
  );

  // Schema failure is a hard fail. Missing Navica is not (Sprint 1).
  // CRM tables are soft in demo; required readiness signal in prod.
  const hardOk =
    schema.ok && (isDemo || (supabaseLive && env.errors.length === 0 && crm.ok));

  const gates = {
    demoOff: !isDemo,
    supabaseConfigured: supabaseLive,
    schemaOk: schema.ok,
    visibilityColumn: schema.hasVisibility,
    crmSchemaOk: crm.ok,
    mapbox: !!(
      process.env.NEXT_PUBLIC_MAPBOX_TOKEN &&
      !process.env.NEXT_PUBLIC_MAPBOX_TOKEN.includes('your')
    ),
    ai: ai.live,
    cronSecret: cronSecretSet,
    brand: brandConfigured,
    navica: navicaConfigured,
    twilio: twilioConfigured,
  };

  const grade =
    env.readinessScore >= 85 && crm.ok
      ? 'production'
      : env.readinessScore >= 55
        ? 'sprint0-partial'
        : isDemo
          ? 'demo'
          : 'not-ready';

  const status = {
    ok: hardOk,
    timestamp: new Date().toISOString(),
    product: 'Voxli.dev',
    mode: isDemo ? 'demo' : 'production',
    readiness: {
      score: env.readinessScore,
      grade,
      gates,
      blockingErrors: env.errors,
      nextDocs: isDemo
        ? ['docs/SPRINT_0_RUNBOOK.md', 'docs/SPRINT_PRODUCTION.md']
        : !schema.ok
          ? ['supabase/APPLY_ORDER.md', 'supabase/migrations/2026-07-17-add-visibility.sql']
          : !crm.ok
            ? [
                'supabase/schema-crm.sql',
                'supabase/migrations/2026-07-30-sprint2-tenant-rls.sql',
              ]
            : !navicaConfigured
              ? ['docs/NAVICA-GO-LIVE.md']
              : ['docs/SPRINT_PRODUCTION.md'],
    },
    ai: {
      live: ai.live,
      provider: ai.provider,
      model: ai.model,
      hasXai: ai.hasXai,
      hasOpenAI: ai.hasOpenAI,
      note: ai.live
        ? `Real synthesis via ${ai.provider} (${ai.model})`
        : 'Demo mode — set XAI_API_KEY or OPENAI_API_KEY',
    },
    supabase: {
      configured: supabaseLive,
      schemaOk: schema.ok,
      hasVisibilityColumn: schema.hasVisibility,
      message: schema.message,
      crm,
    },
    navica: {
      configured: navicaConfigured,
      note: navicaConfigured
        ? 'Live credentials present — fetchArchibaldNavicaListings will hit the real feed'
        : 'No credentials — using high-quality Eastern Idaho demo MLS board (Sprint 1)',
    },
    twilio: {
      configured: twilioConfigured,
      note: twilioConfigured
        ? 'Live SMS via /api/nurture/send-sms'
        : 'Simulated SMS — set TWILIO_* for Sprint 3',
    },
    cron: {
      secretConfigured: cronSecretSet,
      schedule: 'hourly /api/cron/sync-navica; daily land-digest (see vercel.json)',
    },
    brand: {
      companyName: process.env.NEXT_PUBLIC_COMPANY_NAME || null,
      domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN || null,
      configured: brandConfigured,
    },
    envWarnings: env.warnings,
    envErrors: env.errors,
  };

  return NextResponse.json(status, {
    status: hardOk ? 200 : 503,
  });
}
