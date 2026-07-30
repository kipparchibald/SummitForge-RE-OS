// lib/env.ts
// Centralized environment configuration, DEMO mode detection, and validation.
// Use this everywhere to keep demo/live behavior consistent and production-safe.

export interface EnvValidationResult {
  isDemo: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
  /** 0–100 rough readiness for production ops (not a marketing score). */
  readinessScore: number;
}

/**
 * Returns true if running in DEMO mode.
 * Controlled by NEXT_PUBLIC_DEMO_MODE=true (string).
 * Defaults to false for production (lock down features, require real branding/config).
 */
export function isDemoMode(): boolean {
  // NEXT_PUBLIC_* are inlined at build time. Safe on client and server.
  const val = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (val === 'false') return false;
  if (val === 'true') return true;
  // Default to false for production deployments (override in .env.example / Vercel for previews)
  return false;
}

/**
 * Sync helper for places that just need the flag (avoids repeated calls).
 */
export const DEMO_MODE = isDemoMode();

function isPlaceholder(value: string | undefined, patterns: RegExp[] = []): boolean {
  if (!value || !value.trim()) return true;
  const v = value.trim();
  if (/your[_-]|placeholder|xxx|changeme/i.test(v)) return true;
  return patterns.some((re) => re.test(v));
}

/**
 * Required / recommended env vars with notes.
 * Used by validation and deploy docs.
 */
export const ENV_REQUIREMENTS = {
  requiredForLive: [
    'NEXT_PUBLIC_MAPBOX_TOKEN',
    // Prefer XAI_API_KEY (Grok); OPENAI_API_KEY also accepted
    'XAI_API_KEY or OPENAI_API_KEY',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CRON_SECRET',
  ],
  recommendedForProd: [
    'NAVICA_IDX_URL',
    'NAVICA_API_KEY',
    'NEXT_PUBLIC_COMPANY_NAME',
    'NEXT_PUBLIC_BRAND_PHONE',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'TWILIO_ACCOUNT_SID',
  ],
  demoSafeFallbacks: [
    'Uses built-in Eastern Idaho demo data when Navica keys absent',
    'AI falls back to simulated responses',
    'Supabase uses demo placeholders',
  ],
} as const;

/**
 * Validates environment at runtime / build.
 * - In DEMO: mostly warnings (graceful)
 * - In PROD (!demo): missing auth/DB/cron become errors; Navica/Stripe/Twilio stay warnings until those sprints.
 */
export function validateEnv(): EnvValidationResult {
  const isDemo = isDemoMode();
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  const push = (msg: string, level: 'warn' | 'error' = 'warn') => {
    if (level === 'error' && !isDemo) errors.push(msg);
    else warnings.push(msg);
  };

  // Core public (maps + AI)
  if (
    isPlaceholder(process.env.NEXT_PUBLIC_MAPBOX_TOKEN, [/pk\.your/i])
  ) {
    push(
      'NEXT_PUBLIC_MAPBOX_TOKEN missing or placeholder — maps use demo fallback',
      isDemo ? 'warn' : 'error',
    );
    if (!isDemo) missing.push('NEXT_PUBLIC_MAPBOX_TOKEN');
  }

  const hasXai =
    !isPlaceholder(process.env.XAI_API_KEY) || !isPlaceholder(process.env.GROK_API_KEY);
  const hasOpenAI =
    !isPlaceholder(process.env.OPENAI_API_KEY) &&
    (process.env.OPENAI_API_KEY?.length || 0) > 20;
  if (!hasXai && !hasOpenAI) {
    push(
      'XAI_API_KEY / OPENAI_API_KEY missing — AI Assistants use demo/simulated responses',
      isDemo ? 'warn' : 'error',
    );
    if (!isDemo) missing.push('XAI_API_KEY or OPENAI_API_KEY');
  }

  // Supabase (data persistence) — required in production
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (
    isPlaceholder(supabaseUrl) ||
    supabaseUrl?.includes('demo.supabase.co') ||
    supabaseUrl?.includes('your-project')
  ) {
    push(
      'Supabase not configured with real project (using demo fallback)',
      isDemo ? 'warn' : 'error',
    );
    if (!isDemo) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  }
  if (isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, [/your-anon/i])) {
    push(
      'NEXT_PUBLIC_SUPABASE_ANON_KEY missing or placeholder',
      isDemo ? 'warn' : 'error',
    );
    if (!isDemo) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    push(
      'SUPABASE_SERVICE_ROLE_KEY missing — cron/import writes will fail in production',
      isDemo ? 'warn' : 'error',
    );
    if (!isDemo) missing.push('SUPABASE_SERVICE_ROLE_KEY');
  }

  // Navica / real data — Sprint 1; warn only until credentials land
  if (isPlaceholder(process.env.NAVICA_IDX_URL) || isPlaceholder(process.env.NAVICA_API_KEY)) {
    push(
      'NAVICA_IDX_URL / NAVICA_API_KEY not set — using high-quality Eastern Idaho demo listings',
      'warn',
    );
  }

  // Stripe (monetization) — Sprint 5
  if (
    isPlaceholder(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('pk_test_placeholder')
  ) {
    push('NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY placeholder — Stripe flows are simulated', 'warn');
  }

  // CRON for background sync — required in production so schedules are secured
  if (isPlaceholder(process.env.CRON_SECRET)) {
    push(
      'CRON_SECRET not set — Vercel scheduled Navica syncs are unsecured or disabled',
      isDemo ? 'warn' : 'error',
    );
    if (!isDemo) missing.push('CRON_SECRET');
  }

  // Production branding
  if (!isDemo) {
    if (
      isPlaceholder(process.env.NEXT_PUBLIC_COMPANY_NAME) &&
      isPlaceholder(process.env.NEXT_PUBLIC_BRAND_DOMAIN)
    ) {
      warnings.push(
        'Production: set NEXT_PUBLIC_COMPANY_NAME (and brand colors/phone) for Archibald-Bagley first paint',
      );
    }
    if (isPlaceholder(process.env.NAVICA_IDX_URL)) {
      warnings.push(
        'PRODUCTION: Real Navica IDX recommended before client go-live (Sprint 1) — demo board still active',
      );
    }
  }

  // Readiness score: foundations vs later sprints
  let readinessScore = 0;
  if (!isDemo) readinessScore += 15;
  if (!isPlaceholder(process.env.NEXT_PUBLIC_MAPBOX_TOKEN, [/pk\.your/i])) readinessScore += 10;
  if (hasXai || hasOpenAI) readinessScore += 10;
  if (
    supabaseUrl &&
    !supabaseUrl.includes('demo.supabase.co') &&
    !isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
  ) {
    readinessScore += 20;
  }
  if (!isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)) readinessScore += 10;
  if (!isPlaceholder(process.env.CRON_SECRET)) readinessScore += 10;
  if (!isPlaceholder(process.env.NEXT_PUBLIC_COMPANY_NAME)) readinessScore += 5;
  if (!isPlaceholder(process.env.NAVICA_IDX_URL) && !isPlaceholder(process.env.NAVICA_API_KEY)) {
    readinessScore += 10;
  }
  if (
    !isPlaceholder(process.env.TWILIO_ACCOUNT_SID) &&
    !isPlaceholder(process.env.TWILIO_AUTH_TOKEN)
  ) {
    readinessScore += 5;
  }
  if (!isPlaceholder(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) &&
      !process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('placeholder')) {
    readinessScore += 5;
  }
  readinessScore = Math.min(100, readinessScore);

  return { isDemo, missing, warnings, errors, readinessScore };
}

/**
 * Get a human-friendly status string for UI.
 */
export function getEnvStatusMessage(): string {
  const result = validateEnv();
  if (result.isDemo) {
    return 'DEMO MODE: All features unlocked. Using fallbacks where keys missing.';
  }
  if (result.errors.length > 0) {
    return `Production mode — ${result.errors.length} blocking config issue(s). See /api/health.`;
  }
  if (result.warnings.length === 0) {
    return 'Production ready.';
  }
  return `Production mode. Readiness ~${result.readinessScore}%. Warnings: ${result.warnings.length}`;
}

const envApi = {
  isDemoMode,
  DEMO_MODE,
  validateEnv,
  ENV_REQUIREMENTS,
};

export default envApi;
