#!/usr/bin/env node
/**
 * Sprint 0 production gate checklist for Voxli.dev RE OS.
 * Prints what is configured in the current environment and the ops steps
 * that still require a human (Supabase SQL, Vercel dashboard, users).
 *
 * Usage: npm run prod:checklist
 * Exit 0 always — this is guidance, not a hard gate.
 */

function truthy(v) {
  return !!(v && String(v).trim() && !/your[_-]|placeholder|xxx|demo\.supabase|your-project/i.test(String(v)));
}

function isDemo() {
  const v = process.env.NEXT_PUBLIC_DEMO_MODE;
  if (v === 'false') return false;
  if (v === 'true') return true;
  return false;
}

const demo = isDemo();
const checks = [
  {
    id: 'S0.demo_off',
    label: 'DEMO mode off (NEXT_PUBLIC_DEMO_MODE=false)',
    ok: !demo,
    how: 'Set NEXT_PUBLIC_DEMO_MODE=false on Vercel Production and redeploy',
  },
  {
    id: 'S0.mapbox',
    label: 'Mapbox token',
    ok: truthy(process.env.NEXT_PUBLIC_MAPBOX_TOKEN),
    how: 'NEXT_PUBLIC_MAPBOX_TOKEN=pk.…',
  },
  {
    id: 'S0.ai',
    label: 'AI key (XAI or OpenAI)',
    ok:
      truthy(process.env.XAI_API_KEY) ||
      truthy(process.env.GROK_API_KEY) ||
      truthy(process.env.OPENAI_API_KEY),
    how: 'Prefer XAI_API_KEY; OPENAI_API_KEY also accepted',
  },
  {
    id: 'S0.supabase_url',
    label: 'Supabase URL',
    ok: truthy(process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL),
    how: 'NEXT_PUBLIC_SUPABASE_URL=https://….supabase.co',
  },
  {
    id: 'S0.supabase_anon',
    label: 'Supabase anon key',
    ok: truthy(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    how: 'NEXT_PUBLIC_SUPABASE_ANON_KEY=…',
  },
  {
    id: 'S0.supabase_service',
    label: 'Supabase service role (server writes / cron)',
    ok: truthy(process.env.SUPABASE_SERVICE_ROLE_KEY),
    how: 'SUPABASE_SERVICE_ROLE_KEY=… (never NEXT_PUBLIC_)',
  },
  {
    id: 'S0.cron',
    label: 'CRON_SECRET for Vercel cron',
    ok: truthy(process.env.CRON_SECRET),
    how: 'openssl rand -base64 32 → CRON_SECRET',
  },
  {
    id: 'S0.brand',
    label: 'Deployment brand company name',
    ok: truthy(process.env.NEXT_PUBLIC_COMPANY_NAME),
    how: 'NEXT_PUBLIC_COMPANY_NAME=Archibald-Bagley Real Estate',
  },
  {
    id: 'S1.navica',
    label: 'Navica live credentials (Sprint 1)',
    ok: truthy(process.env.NAVICA_IDX_URL) && truthy(process.env.NAVICA_API_KEY),
    how: 'See docs/NAVICA-GO-LIVE.md — optional for Sprint 0',
  },
  {
    id: 'S3.twilio',
    label: 'Twilio SMS (Sprint 3)',
    ok:
      truthy(process.env.TWILIO_ACCOUNT_SID) &&
      truthy(process.env.TWILIO_AUTH_TOKEN) &&
      truthy(process.env.TWILIO_FROM_NUMBER),
    how: 'Optional until nurture go-live',
  },
];

const opsOnly = [
  'Apply supabase/schema.sql → schema-updates → land-deals → visibility migration',
  'Run supabase/seed-archibald-bagley.sql',
  'Create admin + agent in Supabase Auth; link profiles',
  'curl -sS https://YOUR-HOST/api/health | jq .  → ok:true, mode:production, schemaOk:true',
  'Confirm login gate (no demo banner) on production URL',
];

const passed = checks.filter((c) => c.ok).length;
const total = checks.length;

console.log('\n[Voxli] Sprint 0 / production checklist\n');
console.log(`  Mode: ${demo ? 'DEMO' : 'PRODUCTION'}`);
console.log(`  Env gates: ${passed}/${total} green\n`);

for (const c of checks) {
  const mark = c.ok ? '✅' : '⬜';
  console.log(`  ${mark} ${c.label}`);
  if (!c.ok) console.log(`       → ${c.how}`);
}

console.log('\n  Ops steps (cannot be automated from env alone):');
opsOnly.forEach((s, i) => console.log(`     ${i + 1}. ${s}`));

console.log('\n  Docs:');
console.log('     docs/SPRINT_0_RUNBOOK.md');
console.log('     docs/SPRINT_PRODUCTION.md');
console.log('     docs/NAVICA-GO-LIVE.md');
console.log('     supabase/APPLY_ORDER.md\n');

if (!demo && passed >= 7) {
  console.log('  → Env looks production-capable. Finish SQL + users, then verify /api/health.\n');
} else if (demo) {
  console.log('  → Still DEMO. Fine for previews; set DEMO_MODE=false for real go-live.\n');
} else {
  console.log('  → Fill remaining env vars before calling production ready.\n');
}

process.exit(0);
