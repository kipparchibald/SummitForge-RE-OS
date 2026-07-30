#!/usr/bin/env node
/**
 * .env / build-time validation script for Voxli.dev RE OS.
 * Run manually: npm run validate:env
 * Wired into "build" for deploy safety.
 *
 * Pure JS (no TS deps) so it runs in any Node during Vercel build / local.
 *
 * Behavior:
 * - Always prints status + guidance.
 * - DEMO_MODE (NEXT_PUBLIC_DEMO_MODE=true): warnings only; exit 0.
 * - PRODUCTION: prints errors for missing foundations; exit 0 still
 *   (so preview builds with partial env don't brick Vercel) unless
 *   VOXLI_STRICT_ENV=true.
 */

function isDemo() {
  const v = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (v === 'false') return false;
  if (v === 'true') return true;
  return false; // prod default
}

function isPlaceholder(value) {
  if (!value || !String(value).trim()) return true;
  return /your[_-]|placeholder|xxx|changeme|demo\.supabase|your-project|your-anon|pk\.your/i.test(
    String(value),
  );
}

function validate() {
  const demo = isDemo();
  const warnings = [];
  const errors = [];
  const missing = [];

  if (isPlaceholder(process.env.NEXT_PUBLIC_MAPBOX_TOKEN)) {
    const msg = 'NEXT_PUBLIC_MAPBOX_TOKEN missing/placeholder (maps demo fallback)';
    if (demo) warnings.push(msg);
    else {
      errors.push(msg);
      missing.push('NEXT_PUBLIC_MAPBOX_TOKEN');
    }
  }

  const hasAi =
    !isPlaceholder(process.env.XAI_API_KEY) ||
    !isPlaceholder(process.env.GROK_API_KEY) ||
    (!isPlaceholder(process.env.OPENAI_API_KEY) && (process.env.OPENAI_API_KEY || '').length > 20);
  if (!hasAi) {
    const msg = 'XAI_API_KEY / OPENAI_API_KEY missing (AI uses demo/simulated responses)';
    if (demo) warnings.push(msg);
    else {
      errors.push(msg);
      missing.push('XAI_API_KEY or OPENAI_API_KEY');
    }
  }

  const supa = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  if (isPlaceholder(supa)) {
    const msg = 'Supabase URL missing or demo placeholder (set real project for persistence)';
    if (demo) warnings.push(msg);
    else {
      errors.push(msg);
      missing.push('NEXT_PUBLIC_SUPABASE_URL');
    }
  }
  if (isPlaceholder(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)) {
    const msg = 'NEXT_PUBLIC_SUPABASE_ANON_KEY missing/placeholder';
    if (demo) warnings.push(msg);
    else {
      errors.push(msg);
      missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    }
  }
  if (isPlaceholder(process.env.SUPABASE_SERVICE_ROLE_KEY)) {
    const msg = 'SUPABASE_SERVICE_ROLE_KEY missing (cron/import server writes)';
    if (demo) warnings.push(msg);
    else {
      errors.push(msg);
      missing.push('SUPABASE_SERVICE_ROLE_KEY');
    }
  }

  if (isPlaceholder(process.env.NAVICA_IDX_URL) || isPlaceholder(process.env.NAVICA_API_KEY)) {
    warnings.push('Navica keys absent — live data uses built-in Jefferson demo listings (Sprint 1)');
  }

  if (
    isPlaceholder(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) ||
    (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '').includes('placeholder')
  ) {
    warnings.push('Stripe publishable key is placeholder (checkout simulated — Sprint 5)');
  }

  if (isPlaceholder(process.env.CRON_SECRET)) {
    const msg = 'CRON_SECRET absent — scheduled Vercel cron for Navica unsecured/disabled';
    if (demo) warnings.push(msg);
    else {
      errors.push(msg);
      missing.push('CRON_SECRET');
    }
  }

  if (!demo) {
    if (isPlaceholder(process.env.NEXT_PUBLIC_COMPANY_NAME)) {
      warnings.push(
        'Set NEXT_PUBLIC_COMPANY_NAME=Archibald-Bagley Real Estate for branded first paint',
      );
    }
    if (isPlaceholder(process.env.NAVICA_IDX_URL)) {
      warnings.push(
        'PRODUCTION: Real NAVICA_IDX_URL recommended before full client go-live (Sprint 1)',
      );
    }
  }

  return { demo, warnings, errors, missing };
}

console.log('\n[Voxli] Running env validation (deploy prep)...');

const res = validate();

console.log(
  `  Mode: ${res.demo ? 'DEMO (unlocked for preview, fallbacks OK)' : 'PRODUCTION (foundations required)'}`,
);
console.log(`  Errors: ${res.errors.length}  Warnings: ${res.warnings.length}`);

if (res.errors.length) {
  console.log('\n  ❌ Production foundation gaps:');
  res.errors.forEach((w, i) => console.log(`     ${i + 1}. ${w}`));
}

if (res.warnings.length) {
  console.log('\n  ⚠️  Warnings / notes:');
  res.warnings.forEach((w, i) => console.log(`     ${i + 1}. ${w}`));
}

console.log('\n  Required for Sprint 0 production:');
console.log('    - NEXT_PUBLIC_DEMO_MODE=false');
console.log('    - NEXT_PUBLIC_MAPBOX_TOKEN, XAI_API_KEY (or OPENAI_API_KEY)');
console.log('    - NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY');
console.log('    - CRON_SECRET, NEXT_PUBLIC_COMPANY_NAME');
console.log('  Later sprints: NAVICA_*, TWILIO_*, STRIPE_*');
console.log('\n  Docs: docs/SPRINT_0_RUNBOOK.md · npm run prod:checklist');

const strict = process.env.VOXLI_STRICT_ENV === 'true';
if (!res.demo && res.errors.length && strict) {
  console.log('\n[Voxli] VOXLI_STRICT_ENV=true — failing build due to foundation errors.\n');
  process.exit(1);
}

console.log('\n[Voxli] Env validation complete. Build will proceed.\n');
process.exit(0);
