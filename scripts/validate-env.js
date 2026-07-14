#!/usr/bin/env node
/**
 * .env / build-time validation script for SummitForge RE OS.
 * Run manually: npm run validate:env
 * Wired into "build" for deploy safety.
 *
 * Pure JS (no TS deps) so it runs in any Node during Vercel build / local.
 * Checks process.env directly (Vercel injects; for local `npm run build` reads from shell/.env via next context but script is pre).
 *
 * Behavior:
 * - Always prints status + guidance.
 * - DEMO_MODE (NEXT_PUBLIC_DEMO_MODE=true): warnings only.
 * - PRODUCTION: surfaces stronger notes but does not block build (graceful).
 */

function isDemo() {
  const v = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (v === 'false') return false;
  if (v === 'true') return true;
  return false; // prod default
}

function validate() {
  const demo = isDemo();
  const warnings = [];
  const missing = [];

  // Core
  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN || /your_|pk\.your/.test(process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '')) {
    warnings.push('NEXT_PUBLIC_MAPBOX_TOKEN missing/placeholder (maps demo fallback)');
  }
  if (!process.env.OPENAI_API_KEY || /your-/.test(process.env.OPENAI_API_KEY || '')) {
    warnings.push('OPENAI_API_KEY missing (AI uses demo/simulated responses)');
  }

  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!supa || supa.includes('demo.supabase.co')) {
    warnings.push('Supabase URL using demo fallback (set real project for persistence)');
  }

  if (!process.env.NAVICA_IDX_URL || !process.env.NAVICA_API_KEY) {
    warnings.push('Navica keys absent — live data uses built-in Jefferson demo listings');
  }

  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY.includes('placeholder')) {
    warnings.push('Stripe publishable key is placeholder (checkout simulated)');
  }

  if (!process.env.CRON_SECRET) {
    warnings.push('CRON_SECRET absent — scheduled Vercel cron for Navica disabled');
  }

  if (!demo) {
    if (!process.env.NAVICA_IDX_URL) {
      warnings.push('PRODUCTION: Real NAVICA_IDX_URL recommended for live listings (demo data will be used as fallback)');
    }
    warnings.push('Production branding expected: customize via /settings/branding or env vars before launch');
  }

  return { demo, warnings, missing };
}

console.log('\n[SummitForge] Running env validation (deploy prep)...');

const res = validate();

console.log(`  Mode: ${res.demo ? 'DEMO (unlocked for preview, fallbacks OK)' : 'PRODUCTION (gated, real keys + branding recommended)'}`);
console.log(`  Warnings: ${res.warnings.length}`);

if (res.warnings.length) {
  console.log('\n  ⚠️  Warnings / notes:');
  res.warnings.forEach((w, i) => console.log(`     ${i+1}. ${w}`));
}

console.log('\n  Required / recommended (see .env.example):');
console.log('    - Always: NEXT_PUBLIC_MAPBOX_TOKEN, OPENAI_API_KEY');
console.log('    - Prod: SUPABASE_*, NAVICA_*, STRIPE_*, CRON_SECRET');
console.log('    - Toggle: NEXT_PUBLIC_DEMO_MODE=false in real prod deploys');
console.log('    - Branding lock applies automatically when DEMO_MODE=false');

console.log('\n  Next steps for deploy:');
console.log('    1. Vercel dashboard → Settings → Environment Variables (Production + Preview)');
console.log('    2. Set CRON_SECRET (random) to activate hourly background sync');
console.log('    3. Add real Navica + Supabase + Stripe for full live/prod');
console.log('    4. npm run validate:env (or auto on build)');

console.log('\n[SummitForge] Env validation complete. Build will proceed.\n');

process.exit(0);