// lib/env.ts
// Centralized environment configuration, DEMO mode detection, and validation.
// Use this everywhere to keep demo/live behavior consistent and production-safe.

export interface EnvValidationResult {
  isDemo: boolean;
  missing: string[];
  warnings: string[];
  errors: string[];
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

/**
 * Required / recommended env vars with notes.
 * Used by validation and deploy docs.
 */
export const ENV_REQUIREMENTS = {
  requiredForLive: [
    'NEXT_PUBLIC_MAPBOX_TOKEN',
    'OPENAI_API_KEY',
  ],
  recommendedForProd: [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NAVICA_IDX_URL',
    'NAVICA_API_KEY',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'CRON_SECRET',
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
 * - In PROD (!demo): warnings become stronger; missing critical can surface.
 * Returns structured result for UI banners or console.
 */
export function validateEnv(): EnvValidationResult {
  const isDemo = isDemoMode();
  const missing: string[] = [];
  const warnings: string[] = [];
  const errors: string[] = [];

  // Core public (maps + AI)
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN || process.env.NEXT_PUBLIC_MAPBOX_TOKEN.includes('your_') || process.env.NEXT_PUBLIC_MAPBOX_TOKEN.includes('pk.your')) {
    const msg = 'NEXT_PUBLIC_MAPBOX_TOKEN missing or placeholder — maps use demo fallback';
    if (isDemo) warnings.push(msg); else warnings.push(msg);
  }
  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.includes('your-')) {
    const msg = 'OPENAI_API_KEY missing — AI Assistants use demo/simulated responses';
    if (isDemo) warnings.push(msg); else warnings.push(msg);
  }

  // Supabase (data persistence)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!supabaseUrl || supabaseUrl.includes('demo.supabase.co')) {
    const msg = 'Supabase not configured with real project (using demo fallback)';
    if (!isDemo) warnings.push(msg); else warnings.push(msg);
  }

  // Navica / real data
  if (!process.env.NAVICA_IDX_URL || !process.env.NAVICA_API_KEY) {
    const msg = 'NAVICA_IDX_URL / NAVICA_API_KEY not set — using high-quality Eastern Idaho demo listings';
    if (!isDemo) warnings.push(msg); else warnings.push(msg);
  }

  // Stripe (monetization)
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes('pk_test_placeholder')) {
    const msg = 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY placeholder — Stripe flows are simulated';
    if (!isDemo) warnings.push(msg); else warnings.push(msg);
  }

  // CRON for background sync
  if (!process.env.CRON_SECRET) {
    const msg = 'CRON_SECRET not set — Vercel scheduled Navica syncs disabled (manual still works in DEMO)';
    if (!isDemo) warnings.push(msg); else warnings.push(msg);
  }

  // Production branding / lock requirements
  if (!isDemo) {
    // In production we expect real branding (can be set via env or enforced in UI)
    if (!process.env.NEXT_PUBLIC_COMPANY_NAME && !process.env.NEXT_PUBLIC_BRAND_DOMAIN) {
      warnings.push('Production: consider setting real branding via env or /settings/branding before go-live');
    }
    // Stronger note on live data
    if (!process.env.NAVICA_IDX_URL) {
      warnings.push('PRODUCTION WARNING: Real Navica IDX recommended (demo data will be hidden in some UIs)');
    }
  }

  // In strict prod, could promote warnings to errors
  if (!isDemo && warnings.length > 0) {
    // Surface as warnings for now; can throw in future if desired
  }

  return { isDemo, missing, warnings, errors };
}

/**
 * Get a human-friendly status string for UI.
 */
export function getEnvStatusMessage(): string {
  const result = validateEnv();
  if (result.isDemo) {
    return 'DEMO MODE: All features unlocked. Using fallbacks where keys missing.';
  }
  if (result.warnings.length === 0) {
    return 'Production ready.';
  }
  return `Production mode. Warnings: ${result.warnings.length}`;
}

export default {
  isDemoMode,
  DEMO_MODE,
  validateEnv,
  ENV_REQUIREMENTS,
};
