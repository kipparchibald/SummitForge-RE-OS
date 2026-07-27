#!/usr/bin/env node
/**
 * SummitForge smoke tests — pure Node, no Next.js runtime required.
 * Run: npm run test:smoke
 *
 * Optional live check (dev/prod server running):
 *   SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

let failed = 0;
let passed = 0;

function assert(condition, message) {
  if (condition) {
    passed += 1;
    console.log('  OK  ' + message);
  } else {
    failed += 1;
    console.error('  FAIL ' + message);
  }
}

console.log('\n[SummitForge] Running smoke tests...\n');

// ─── 1. FeedTypes visibility gating (mirrors lib/import/feedTypes.ts) ───
console.log('1. FeedTypes visibility gating');
const PUBLIC_TOKENS = new Set(['idx', 'public']);
function tokens(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw))
    return raw.map(function (t) {
      return String(t).trim().toLowerCase();
    }).filter(Boolean);
  return String(raw)
    .split(/[,;|]/)
    .map(function (t) {
      return t.trim().toLowerCase();
    })
    .filter(Boolean);
}
function looksLikeNavicaRecord(row) {
  if (!row || typeof row !== 'object') return false;
  return (
    'FeedTypes' in row ||
    'FeedType' in row ||
    'feed_types' in row ||
    row.source === 'navica' ||
    row.__feed === 'navica'
  );
}
function feedVisibility(row) {
  var raw =
    row &&
    (row.FeedTypes || row.feedTypes || row.FeedType || row.feed_types || row.feed_type);
  if (raw == null && !looksLikeNavicaRecord(row)) return 'public';
  return tokens(raw).some(function (t) {
    return PUBLIC_TOKENS.has(t);
  })
    ? 'public'
    : 'internal';
}
assert(feedVisibility({ 'Street Address': '123 Main', City: 'Rigby' }) === 'public', 'CSV-style row -> public');
assert(feedVisibility({ FeedTypes: 'IDX', ListingId: '1' }) === 'public', 'FeedTypes=IDX -> public');
assert(feedVisibility({ FeedTypes: 'BBO', ListingId: '3' }) === 'internal', 'FeedTypes=BBO -> internal');
assert(feedVisibility({ FeedTypes: 'BBO,IDX', ListingId: '4' }) === 'public', 'FeedTypes contains IDX -> public');
assert(feedVisibility({ FeedTypes: null, __feed: 'navica' }) === 'internal', 'Navica null FeedTypes -> internal');
assert(feedVisibility({ FeedTypes: 'VOW', ListingId: '5' }) === 'internal', 'FeedTypes=VOW only -> internal');

// ─── 2. Demo Navica land data ───
console.log('\n2. Demo Navica land data');
var DEMO_LAND = [
  {
    'MLS #': '2185506',
    'Street Address': '730 N Center Street',
    City: 'Blackfoot',
    'List Price': 16800000,
    Acres: 1177.68,
    'Property Type': 'Land',
  },
  {
    'MLS #': '2184829',
    'Street Address': 'L16B8 146 N',
    City: 'Rigby',
    'List Price': 488000,
    Acres: 2.46,
    'Property Type': 'Vacant Land',
  },
  {
    'MLS #': '2181391',
    'Street Address': '119 Ac 3900 E',
    City: 'Rigby',
    'List Price': 4165000,
    Acres: 119,
    'Property Type': 'Land',
  },
];
function normalizeDemo(row) {
  var address = row['Street Address'] || '';
  var city = row.City || '';
  var price = parseFloat(String(row['List Price'] || 0).replace(/[^0-9.\-]/g, ''));
  var acres = parseFloat(row.Acres || 0) || undefined;
  if (!address || !Number.isFinite(price) || price <= 0) return null;
  return {
    address: city ? address + ', ' + city + ', ID' : address,
    price: price,
    acres: acres,
    visibility: 'public',
  };
}
var normalized = DEMO_LAND.map(normalizeDemo).filter(Boolean);
assert(normalized.length === 3, 'All 3 demo rows normalize');
assert(
  normalized.every(function (l) {
    return l.price > 0;
  }),
  'All prices > 0'
);
assert(
  normalized.every(function (l) {
    return (l.acres || 0) > 0.5;
  }),
  'All acres > 0.5'
);
assert(
  normalized.some(function (l) {
    return l.address.indexOf('Rigby') !== -1;
  }),
  'Rigby parcel present'
);

// ─── 3. Fuzzy search ───
console.log('\n3. Fuzzy search');
function levenshtein(a, b) {
  var s = a.toLowerCase(),
    t = b.toLowerCase();
  if (s === t) return 0;
  var m = s.length,
    n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  var dp = [];
  for (var i = 0; i <= m; i++) {
    dp[i] = [];
    for (var j = 0; j <= n; j++) dp[i][j] = 0;
  }
  for (i = 0; i <= m; i++) dp[i][0] = i;
  for (j = 0; j <= n; j++) dp[0][j] = j;
  for (i = 1; i <= m; i++)
    for (j = 1; j <= n; j++) {
      var cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  return dp[m][n];
}
function fuzzyScore(query, target) {
  if (!query || !target) return 0;
  var q = query.trim().toLowerCase(),
    t = target.toLowerCase();
  if (!q) return 0;
  if (t.indexOf(q) !== -1) return 0.95;
  var dist = levenshtein(q, t),
    maxLen = Math.max(q.length, t.length);
  return maxLen === 0 ? 0 : Math.max(0, Math.min(1, 1 - dist / maxLen));
}
assert(fuzzyScore('rigby', '123 Main St, Rigby, ID') >= 0.9, 'Substring rigby scores high');
assert(fuzzyScore('xyzabc', 'completely different') < 0.4, 'Unrelated scores low');
assert(fuzzyScore('', 'anything') === 0, 'Empty query scores 0');

// ─── 4. Land pro-forma + engine-style yield ───
console.log('\n4. Land pro-forma sanity');
function roughLotYield(acres, minLot) {
  return Math.floor((acres * 0.75) / (minLot || 0.25));
}
var lots = roughLotYield(12.8, 0.5);
assert(lots >= 10 && lots <= 25, 'Lot yield sensible (' + lots + ')');
var coc = (28000 / 200000) * 100;
assert(coc > 10 && coc < 20, 'Cash-on-cash band (' + coc.toFixed(1) + '%)');

// County-aware yield (mirrors land-engine estimateYield)
function estimateYield(grossAcres, roadFactor, lotAcres) {
  var net = Math.max(0, grossAcres * (1 - roadFactor));
  return Math.floor(net / lotAcres);
}
var jeffLots = estimateYield(40, 0.14, 1.0);
assert(jeffLots === 34, 'Jefferson 40ac R-1 yields 34 lots (got ' + jeffLots + ')');
var bonnLots = estimateYield(47.3, 0.19, 0.33);
assert(bonnLots >= 100 && bonnLots <= 120, 'Bonneville ~47ac yields ~116 lots (got ' + bonnLots + ')');

// ─── 5. Repo integrity ───
console.log('\n5. Repo integrity');
var critical = [
  'app/page.tsx',
  'app/layout.tsx',
  'app/api/health/route.ts',
  'app/cma/page.tsx',
  'app/crm/page.tsx',
  'app/offer/page.tsx',
  'app/portal/page.tsx',
  'app/forms/page.tsx',
  'app/transactions/page.tsx',
  'app/development/plat/page.tsx',
  'app/analytics/page.tsx',
  'app/monitoring/page.tsx',
  'app/marketing/page.tsx',
  'app/alerts/page.tsx',
  'app/api/gis/parcel/route.ts',
  'app/api/realtime/stream/route.ts',
  'app/api/realtime/publish/route.ts',
  'app/api/nurture/send-sms/route.ts',
  'lib/import/feedTypes.ts',
  'lib/development/land-engine.ts',
  'lib/development/parcel.ts',
  'lib/cma/engine.ts',
  'lib/cma/from-gis.ts',
  'lib/cma/export.ts',
  'lib/offer/engine.ts',
  'lib/nurture/sequences.ts',
  'lib/nurture/sms.ts',
  'lib/realtime/bus.ts',
  'lib/realtime/client.ts',
  'lib/transaction/checklist.ts',
  'lib/transaction/store.ts',
  'lib/toast/store.ts',
  'components/cma/ParcelAerialMap.tsx',
  'components/cma/SubjectPresets.tsx',
  'components/cma/ExportCmaButton.tsx',
  'components/crm/NurturePanel.tsx',
  'components/offer/OfferCTA.tsx',
  'components/Providers.tsx',
  'components/GlobalToasts.tsx',
  'components/SystemHealthStrip.tsx',
  'lib/development/zoning.ts',
  'lib/development/plat-geometry.ts',
  'lib/crm/store.ts',
  'lib/marketing/campaign-engine.ts',
  'lib/marketing/agent.ts',
  'lib/env.ts',
  'components/RecentMatches.tsx',
  'components/AppNavLinks.tsx',
  'components/MobileNav.tsx',
  'components/development/DevelopmentPotential.tsx',
  'package.json',
  'next.config.mjs',
];
critical.forEach(function (rel) {
  assert(fs.existsSync(path.join(root, rel)), 'Exists: ' + rel);
});

// Parcel module must keep Jefferson TLS incomplete-chain allowlist (owner-of-record fix)
var parcelSrc = fs.readFileSync(path.join(root, 'lib/development/parcel.ts'), 'utf8');
assert(
  parcelSrc.indexOf('gisportal.co.jefferson.id.us') !== -1,
  'parcel.ts references Jefferson assessor host'
);
assert(
  parcelSrc.indexOf('TLS_INCOMPLETE_CHAIN_HOSTS') !== -1 ||
    parcelSrc.indexOf('rejectUnauthorized: false') !== -1,
  'parcel.ts has TLS incomplete-chain handling for Jefferson'
);
assert(parcelSrc.indexOf('enrichJefferson') !== -1, 'parcel.ts has enrichJefferson');
assert(parcelSrc.indexOf('OWNER') !== -1, 'parcel.ts maps OWNER field');

var pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert(pkg.scripts && pkg.scripts['test:smoke'], 'package.json has test:smoke');
assert(pkg.dependencies && pkg.dependencies.next, 'package.json depends on next');

// ─── 6. Greeting / time helpers (dashboard polish) ───
console.log('\n6. Dashboard helpers');
function greetingForHour(hour) {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}
assert(greetingForHour(8) === 'Good morning', 'Morning greeting');
assert(greetingForHour(14) === 'Good afternoon', 'Afternoon greeting');
assert(greetingForHour(20) === 'Good evening', 'Evening greeting');

// ─── 7. CMA engine (mirrors lib/cma/engine.ts core math) ───
console.log('\n7. CMA engine');
function scoreComp(subject, comp) {
  var score = 0.4;
  var na = (subject.propertyType || '').toLowerCase();
  var nb = (comp.propertyType || '').toLowerCase();
  if (na && nb && na === nb) score += 0.25;
  else if (/land/.test(na) && /land/.test(nb)) score += 0.2;
  if (subject.acres && comp.acres) {
    var ratio = Math.min(subject.acres, comp.acres) / Math.max(subject.acres, comp.acres);
    score += 0.25 * ratio;
  }
  return Math.max(0, Math.min(1, score));
}
function runCmaMini(subject, candidates) {
  var adjusted = candidates
    .filter(function (c) {
      return c.price > 0;
    })
    .map(function (c) {
      var s = scoreComp(subject, c);
      return { price: c.price, score: s, weight: Math.pow(s, 1.4) };
    })
    .sort(function (a, b) {
      return b.score - a.score;
    })
    .slice(0, 5);
  var tw =
    adjusted.reduce(function (s, c) {
      return s + c.weight;
    }, 0) || 1;
  var value = Math.round(
    adjusted.reduce(function (s, c) {
      return s + c.price * c.weight;
    }, 0) / tw
  );
  return { value: value, n: adjusted.length };
}
var cma = runCmaMini(
  { acres: 12.5, propertyType: 'Land' },
  [
    { price: 620000, acres: 40, propertyType: 'Land' },
    { price: 575000, acres: 5.8, propertyType: 'Land' },
    { price: 1450000, acres: 28.5, propertyType: 'Land' },
  ]
);
assert(cma.n === 3, 'CMA uses 3 comps');
assert(cma.value > 400000 && cma.value < 2000000, 'CMA indicated value in band (' + cma.value + ')');

// ─── 7b. GIS → CMA residential handoff (year built + assessed) ───
console.log('\n7b. GIS → CMA residential mapping');
function inferPropertyTypeFromGisMini(h) {
  var impVal = h.improvementValue;
  var impKnown = impVal != null;
  var impPositive = (impVal || 0) >= 5000;
  var hasYear = h.yearBuilt != null && h.yearBuilt >= 1800 && h.yearBuilt <= 2100;
  var text = ((h.improvements || '') + ' ' + (h.landUse || '')).toLowerCase();
  var strongResidential = /dwell|resid|single\s*fam|home|house/.test(text);
  var landHints = /vacant|ag\b|farm|range|bare/.test(text);
  if (strongResidential || (hasYear && impPositive) || (impPositive && !landHints)) {
    if (h.yearBuilt != null && h.yearBuilt >= new Date().getFullYear() - 3) return 'New Construction';
    return 'Single Family';
  }
  if (landHints) return 'Vacant Land';
  if (hasYear && !impKnown && h.situsAddress) return 'Single Family';
  return 'Land';
}
function handoffToSubjectMini(h) {
  var propertyType = inferPropertyTypeFromGisMini(h);
  var address = h.situsAddress || ('PIN ' + (h.pin || 'GIS') + ', ID');
  return {
    address: address,
    city: h.situsCity || undefined,
    listPrice: h.assessedValue > 0 ? h.assessedValue : undefined,
    acres: h.acres || undefined,
    propertyType: propertyType,
    yearBuilt: h.yearBuilt || undefined,
    assessedValue: h.assessedValue || undefined,
    pin: h.pin || undefined,
  };
}
var gisHouse = handoffToSubjectMini({
  pin: 'RPA2480002021O',
  yearBuilt: 1956,
  improvementValue: 156720,
  landValue: 74726,
  assessedValue: 231446,
  acres: 0.25,
  improvements: 'DWELL',
  situsAddress: '805 CLAIRE VIEW LN',
  situsCity: 'IDAHO FALLS',
  landUse: null,
});
assert(gisHouse.propertyType === 'Single Family', 'GIS house → Single Family');
assert(gisHouse.yearBuilt === 1956, 'GIS year built applied');
assert(gisHouse.listPrice === 231446, 'Assessed seeds listPrice');
assert(gisHouse.address.indexOf('CLAIRE') >= 0, 'Situs address applied');
var gisLand = handoffToSubjectMini({
  pin: 'RPland',
  yearBuilt: null,
  improvementValue: 0,
  assessedValue: 80000,
  acres: 40,
  improvements: 'Vacant ag',
  situsAddress: null,
  situsCity: null,
  landUse: 'Agriculture',
});
assert(gisLand.propertyType === 'Vacant Land' || gisLand.propertyType === 'Land', 'GIS vacant → landish');

// ─── 8. Concept plat ring geometry ───
console.log('\n8. Concept plat ring');
function conceptRing(acres, lat, lng) {
  var sideFt = Math.sqrt(Math.max(0.25, acres) * 43560);
  var dLat = sideFt / 2 / 364320;
  var dLng = sideFt / 2 / (364320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}
var ring = conceptRing(40, 43.67, -111.91);
assert(ring.length === 5, 'Concept ring has 5 points');
assert(ring[0][0] === ring[4][0] && ring[0][1] === ring[4][1], 'Ring is closed');

// Parcel size unit check: IDWR STArea is m² (Idaho TM meters), not ft²
console.log('\n8b. Parcel size unit verification');
var ST_AREA_SAMPLE = 2236206.80461892; // IDWR PIN RP04N34E360000
var acresIfM2 = ST_AREA_SAMPLE / 4046.8564224;
var acresIfSqFt = ST_AREA_SAMPLE / 43560;
assert(acresIfM2 > 500 && acresIfM2 < 600, 'STArea as m² ≈ 552 ac (got ' + acresIfM2.toFixed(1) + ')');
assert(acresIfSqFt > 40 && acresIfSqFt < 60, 'STArea as ft² would wrongly be ~51 ac');
assert(acresIfM2 / acresIfSqFt > 10, 'm² vs ft² misread is ~10.76×');

// ─── 9. Offer decision engine (mirrors lib/offer/engine.ts scoring shape) ───
console.log('\n9. Offer decision engine');
function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}
function evaluateOfferMini(listPrice, offerPrice, opts) {
  opts = opts || {};
  var pctOfList = listPrice > 0 ? offerPrice / listPrice : 1;
  var avgStl = opts.avgStl || 0.98;
  var expectedClear = listPrice * avgStl;
  var priceDelta = (offerPrice - expectedClear) / expectedClear;
  var priceScore = clamp(50 + priceDelta * 200, 5, 95);
  var termsScore = 55;
  if (opts.cash) termsScore += 18;
  if (opts.inspection === false) termsScore += 8;
  termsScore = clamp(termsScore, 10, 95);
  var marketScore = 50;
  var win = clamp(Math.round(priceScore * 0.5 + termsScore * 0.3 + marketScore * 0.2), 5, 95);
  return { winProbability: win, pctOfList: pctOfList, priceScore: priceScore };
}
var fullPrice = evaluateOfferMini(489000, 489000, { cash: true });
var lowball = evaluateOfferMini(489000, 420000, {});
assert(fullPrice.winProbability > lowball.winProbability, 'Full-price cash beats lowball');
assert(fullPrice.pctOfList === 1, 'Full price is 100% of list');
assert(lowball.pctOfList < 0.9, 'Lowball under 90% of list');
assert(fullPrice.winProbability >= 40 && fullPrice.winProbability <= 95, 'Win prob in band');

// ─── 10. Nurture template tokens ───
console.log('\n10. Nurture templates');
function renderTemplate(template, ctx) {
  var first =
    ctx.firstName ||
    (ctx.name ? String(ctx.name).split(/\s+/)[0] : 'there');
  var budget =
    ctx.budget != null
      ? '$' + Number(ctx.budget).toLocaleString('en-US', { maximumFractionDigits: 0 })
      : 'your budget';
  return template
    .replace(/\{\{firstName\}\}/g, first)
    .replace(/\{\{name\}\}/g, ctx.name || first)
    .replace(/\{\{agent\}\}/g, ctx.agent || 'your agent')
    .replace(/\{\{area\}\}/g, ctx.area || 'Eastern Idaho')
    .replace(/\{\{budget\}\}/g, budget)
    .replace(/\{\{interest\}\}/g, ctx.interest || 'homes');
}
var sms = renderTemplate(
  'Hi {{firstName}} — this is {{agent}} in {{area}}. Budget {{budget}}.',
  { name: 'Alex Buyer', agent: 'Kipp Archibald', area: 'Rigby', budget: 450000 }
);
assert(sms.indexOf('Alex') !== -1, 'Template fills firstName');
assert(sms.indexOf('Kipp') !== -1, 'Template fills agent');
assert(sms.indexOf('Rigby') !== -1, 'Template fills area');
assert(sms.indexOf('450,000') !== -1 || sms.indexOf('450000') !== -1, 'Template fills budget');
assert(sms.indexOf('{{') === -1, 'No leftover tokens');

// ─── 11. Assessor address cleaning (Jefferson placeholders) ───
console.log('\n11. Assessor address cleaning');
function cleanAddrPart(raw) {
  if (raw == null) return null;
  var s = String(raw).replace(/\s+/g, ' ').trim();
  if (!s || /^null$/i.test(s) || s === 'None' || s === '.' || s === '-') return null;
  if (/^0+(-0+)*$/.test(s)) return null;
  return s;
}
function formatAddress(parts) {
  var street = cleanAddrPart(parts.street);
  var city = cleanAddrPart(parts.city);
  var state = cleanAddrPart(parts.state);
  var zip = cleanAddrPart(parts.zip);
  if (zip) zip = zip.replace(/\s+/g, '').slice(0, 10);
  if (zip && !/^\d{5}(-\d{4})?$/.test(zip)) zip = null;
  if (state && state.length === 2) state = state.toUpperCase();
  var line1 = street || '';
  if (!line1 && !city) return null;
  var tail = [];
  if (city) tail.push(city);
  if (state && zip) tail.push(state + ' ' + zip);
  else if (state && (line1 || city)) tail.push(state);
  else if (zip) tail.push(zip);
  if (!line1) return tail.join(', ') || null;
  if (!tail.length) return line1;
  return line1 + ', ' + tail.join(', ');
}
assert(cleanAddrPart('0-0') === null, 'ZIP placeholder 0-0 rejected');
assert(cleanAddrPart('83442') === '83442', 'Real ZIP kept');
assert(formatAddress({ street: '', city: '', state: 'ID', zip: '0-0' }) === null, 'No fake ID 0-0 address');
assert(
  formatAddress({ street: '100 S STATE ST', city: 'RIGBY', state: 'ID', zip: '83442' }).indexOf('RIGBY') !== -1,
  'Real situs formats'
);

// ─── 12. Transaction checklist dates ───
console.log('\n12. Transaction checklist');
function dueDateIso(effectiveDate, dayOffset) {
  var d = new Date(effectiveDate + 'T12:00:00');
  d.setDate(d.getDate() + dayOffset);
  return d.toISOString().slice(0, 10);
}
assert(dueDateIso('2026-07-01', 10) === '2026-07-11', 'Earnest due +10 days');
assert(dueDateIso('2026-07-01', 0) === '2026-07-01', 'Effective day offset 0');

// ─── 13. CMA export HTML shape ───
console.log('\n13. CMA export HTML');
function escapeHtmlSmoke(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
assert(escapeHtmlSmoke('A & B <x>') === 'A &amp; B &lt;x&gt;', 'escapeHtml encodes entities');
function buildCmaHtmlMini(subject, indicatedValue) {
  return (
    '<!DOCTYPE html><html><head><title>CMA — ' +
    escapeHtmlSmoke(subject) +
    '</title></head><body>' +
    '<div class="hero"><div class="addr">' +
    escapeHtmlSmoke(subject) +
    '</div></div>' +
    '<div class="stat accent"><span class="value">$' +
    indicatedValue.toLocaleString() +
    '</span></div>' +
    '<button onclick="window.print()">Print / Save as PDF</button></body></html>'
  );
}
var exportHtml = buildCmaHtmlMini('100 S State St, Rigby, ID', 489000);
assert(exportHtml.indexOf('<!DOCTYPE html>') === 0, 'Export starts with doctype');
assert(exportHtml.indexOf('CMA —') !== -1, 'Export title has CMA');
assert(exportHtml.indexOf('489,000') !== -1 || exportHtml.indexOf('489000') !== -1, 'Export shows value');
assert(exportHtml.indexOf('window.print') !== -1, 'Export includes print action');
// Regression: window.open must not use noopener feature (returns null Window)
var exportSrc = fs.readFileSync(path.join(root, 'lib/cma/export.ts'), 'utf8');
assert(exportSrc.indexOf('createObjectURL') !== -1, 'export uses blob URL');
assert(
  exportSrc.indexOf("window.open(url, '_blank', 'noopener") === -1 &&
    exportSrc.indexOf('noopener,noreferrer,width') === -1,
  'export does not open with noopener features (null Window bug)'
);
assert(exportSrc.indexOf('&amp;') !== -1, 'export escapeHtml uses real HTML entities');

// ─── 14. Optional live HTTP checks ───
var base = process.env.SMOKE_BASE_URL;
async function fetchJson(url, init, timeoutMs) {
  var ctrl = new AbortController();
  var t = setTimeout(function () {
    ctrl.abort();
  }, timeoutMs || 45000);
  try {
    var res = await fetch(url, Object.assign({}, init || {}, { signal: ctrl.signal }));
    var text = await res.text();
    var body = null;
    try {
      body = JSON.parse(text);
    } catch (_) {
      body = { _raw: text.slice(0, 200) };
    }
    return { status: res.status, body: body, ok: res.ok };
  } finally {
    clearTimeout(t);
  }
}

async function liveChecks() {
  if (!base) {
    console.log('\n14. Live HTTP (skipped — set SMOKE_BASE_URL to enable)');
    return;
  }
  var rootUrl = base.replace(/\/$/, '');
  console.log('\n14. Live HTTP against ' + rootUrl);
  try {
    var healthRes = await fetchJson(rootUrl + '/api/health', null, 15000);
    var health = healthRes.body || {};
    assert(healthRes.status === 200 || healthRes.status === 503, 'Health responds (' + healthRes.status + ')');
    assert(typeof health.ok === 'boolean', 'Health has ok flag');
    assert(health.navica && typeof health.navica.configured === 'boolean', 'Health reports navica');
    assert(health.supabase && typeof health.supabase.schemaOk === 'boolean', 'Health reports schema');
    assert(health.ai && typeof health.ai.live === 'boolean', 'Health reports AI');
    assert(health.twilio && typeof health.twilio.configured === 'boolean', 'Health reports Twilio');

    var pages = [
      '/',
      '/import',
      '/development/land-deals',
      '/development/plat',
      '/ai-assistants',
      '/alerts',
      '/cma',
      '/crm',
      '/offer',
      '/portal',
      '/forms',
      '/analytics',
      '/monitoring',
      '/transactions',
      '/marketing',
      '/pricing',
      '/setup',
      '/mortgage',
      '/publish',
      '/settings/branding',
      '/reports/land-analysis',
    ];
    for (var p of pages) {
      var r = await fetch(rootUrl + p);
      assert(r.status === 200, 'GET ' + p + ' -> ' + r.status);
    }

    var scan = await fetchJson(rootUrl + '/api/development/land-scan?minAcres=5', null, 60000);
    assert(scan.status === 200, 'Land scan 200');
    assert(typeof (scan.body && scan.body.analyzed) === 'number', 'Land scan analyzed count');
    assert(
      Array.isArray(scan.body && scan.body.all) || Array.isArray(scan.body && scan.body.top),
      'Land scan returns deals'
    );

    var analyze = await fetchJson(
      rootUrl + '/api/development/analyze',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing: { address: '40ac Terreton', acres: 40, price: 620000 } }),
      },
      60000
    );
    assert(analyze.status === 200, 'Analyze 200');
    assert(
      analyze.body && (analyze.body.verdict === 'OFFER' || analyze.body.verdict === 'PASS'),
      'Analyze has verdict'
    );

    var plat = await fetchJson(
      rootUrl + '/api/development/plat',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          acres: 40,
          lat: 43.67,
          lng: -111.91,
          county: 'Jefferson',
          concept: true,
          withAi: false,
        }),
      },
      60000
    );
    assert(plat.status === 200, 'Concept plat 200');
    assert(plat.body && plat.body.svg && plat.body.svg.indexOf('<svg') !== -1, 'Plat returns SVG');
    assert(plat.body && plat.body.metrics && typeof plat.body.metrics.lots === 'number', 'Plat metrics.lots');
    assert(plat.body && plat.body.geometrySource === 'concept', 'Plat geometrySource=concept');

    // GIS parcel identify + Jefferson assessor owner-of-record (TLS incomplete-chain host)
    console.log('\n14b. Live GIS parcel ownership (Jefferson assessor)');
    var parcelPoint = await fetchJson(
      rootUrl + '/api/gis/parcel?lat=43.672&lng=-111.915&sos=0',
      null,
      60000
    );
    assert(parcelPoint.status === 200, 'GIS point parcel 200 (got ' + parcelPoint.status + ')');
    assert(parcelPoint.body && parcelPoint.body.ok === true, 'GIS point ok');
    var pp = (parcelPoint.body && parcelPoint.body.parcel) || {};
    assert(!!pp.pin, 'GIS point has PIN (' + (pp.pin || 'none') + ')');
    assert(!!pp.owner, 'GIS owner of record present (' + (pp.owner || 'MISSING') + ')');
    assert(
      pp.source && String(pp.source).toLowerCase().indexOf('jefferson') !== -1,
      'GIS source includes Jefferson assessor'
    );
    assert(
      !pp.parcelAddress || String(pp.parcelAddress).indexOf('0-0') === -1,
      'GIS address not placeholder 0-0'
    );

    var parcelPin = await fetchJson(
      rootUrl + '/api/gis/parcel?pin=RP04N34E360000&sos=0',
      null,
      60000
    );
    assert(parcelPin.status === 200, 'GIS PIN parcel 200');
    var pinP = (parcelPin.body && parcelPin.body.parcel) || {};
    assert(pinP.owner === 'STATE OF IDAHO' || !!pinP.owner, 'PIN sample has owner (' + (pinP.owner || 'MISSING') + ')');
    assert(
      pinP.size && pinP.size.legalAcres != null && pinP.size.legalAcres > 500,
      'PIN legal acres from assessor (~560)'
    );

    // Realtime publish (in-process bus) — should accept a demo event
    var rt = await fetchJson(
      rootUrl + '/api/realtime/publish',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: 'system',
          type: 'smoke_test',
          payload: { ok: true },
        }),
      },
      15000
    );
    assert(rt.status === 200 || rt.status === 201 || rt.status === 400 || rt.status === 422, 'Realtime publish responds (' + rt.status + ')');

    // Nurture SMS (simulated when Twilio unset)
    var smsRes = await fetchJson(
      rootUrl + '/api/nurture/send-sms',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: '+12085550100',
          body: 'SummitForge smoke test — ignore',
          contactName: 'Smoke Test',
        }),
      },
      15000
    );
    assert(
      smsRes.status === 200 || smsRes.status === 400 || smsRes.status === 422,
      'Nurture SMS responds (' + smsRes.status + ')'
    );
  } catch (e) {
    failed += 1;
    console.error('  FAIL Live checks: ' + (e && e.message ? e.message : e));
  }
}

console.log('\nEnv notes');
console.log(
  '  Navica: ' + (process.env.NAVICA_IDX_URL && process.env.NAVICA_API_KEY ? 'SET' : 'not set (demo)')
);
console.log('  Schema: run supabase/migrations/2026-07-17-add-visibility.sql if needed');
console.log('  Health: GET /api/health');
console.log('  Live:   SMOKE_BASE_URL=http://localhost:3000 npm run test:smoke');

await liveChecks();

console.log('\n[SummitForge] Smoke tests: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
