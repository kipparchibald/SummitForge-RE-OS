import { NextResponse } from 'next/server';
import { verifyListingsSchema, isSupabaseLive } from '@/lib/supabase/client';
import { isDemoMode, validateEnv } from '@/lib/env';
import { aiStatus } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

/**
 * Lightweight health / readiness endpoint for SummitForge.
 * GET /api/health
 */
export async function GET() {
  const env = validateEnv();
  const schema = await verifyListingsSchema();

  const navicaConfigured = !!(process.env.NAVICA_IDX_URL && process.env.NAVICA_API_KEY);
  const cronSecretSet = !!process.env.CRON_SECRET;
  const supabaseLive = isSupabaseLive();
  const ai = aiStatus();

  const twilioConfigured = !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_FROM_NUMBER
  );

  const status = {
    ok: schema.ok,
    timestamp: new Date().toISOString(),
    mode: isDemoMode() ? 'demo' : 'production',
    ai: {
      live: ai.live,
      provider: ai.provider,
      model: ai.model,
      hasXai: ai.hasXai,
      hasOpenAI: ai.hasOpenAI,
      note: ai.live
        ? `Real synthesis via ${ai.provider} (${ai.model})`
        : 'Demo mode — set XAI_API_KEY or OPENAI_API_KEY in .env.local',
    },
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
        : 'No credentials — using high-quality Eastern Idaho demo MLS board',
    },
    twilio: {
      configured: twilioConfigured,
      note: twilioConfigured
        ? 'Live SMS via /api/nurture/send-sms'
        : 'Simulated SMS — set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER',
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
