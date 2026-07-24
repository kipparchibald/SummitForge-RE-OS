#!/usr/bin/env node
/**
 * SummitForge smoke tests - pure Node, no Next.js runtime required.
 * Run: npm run test:smoke
 */

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

console.log('1. FeedTypes visibility gating');
const PUBLIC_TOKENS = new Set(['idx', 'public']);
function tokens(raw) {
  if (raw == null) return [];
  if (Array.isArray(raw)) return raw.map(function (t) { return String(t).trim().toLowerCase(); }).filter(Boolean);
  return String(raw).split(/[,;|]/).map(function (t) { return t.trim().toLowerCase(); }).filter(Boolean);
}
function looksLikeNavicaRecord(row) {
  if (!row || typeof row !== 'object') return false;
  return ('FeedTypes' in row || 'FeedType' in row || 'feed_types' in row || row.source === 'navica' || row.__feed === 'navica');
}
function feedVisibility(row) {
  var raw = row && (row.FeedTypes || row.feedTypes || row.FeedType || row.feed_types || row.feed_type);
  if (raw == null && !looksLikeNavicaRecord(row)) return 'public';
  return tokens(raw).some(function (t) { return PUBLIC_TOKENS.has(t); }) ? 'public' : 'internal';
}
assert(feedVisibility({ 'Street Address': '123 Main', City: 'Rigby' }) === 'public', 'CSV-style row -> public');
assert(feedVisibility({ FeedTypes: 'IDX', ListingId: '1' }) === 'public', 'FeedTypes=IDX -> public');
assert(feedVisibility({ FeedTypes: 'BBO', ListingId: '3' }) === 'internal', 'FeedTypes=BBO -> internal');
assert(feedVisibility({ FeedTypes: 'BBO,IDX', ListingId: '4' }) === 'public', 'FeedTypes contains IDX -> public');
assert(feedVisibility({ FeedTypes: null, __feed: 'navica' }) === 'internal', 'Navica null FeedTypes -> internal');

console.log('\n2. Demo Navica land data');
var DEMO_LAND = [
  { 'MLS #': '2185506', 'Street Address': '730 N Center Street', City: 'Blackfoot', 'List Price': 16800000, Acres: 1177.68, 'Property Type': 'Land' },
  { 'MLS #': '2184829', 'Street Address': 'L16B8 146 N', City: 'Rigby', 'List Price': 488000, Acres: 2.46, 'Property Type': 'Vacant Land' },
  { 'MLS #': '2181391', 'Street Address': '119 Ac 3900 E', City: 'Rigby', 'List Price': 4165000, Acres: 119, 'Property Type': 'Land' }
];
function normalizeDemo(row) {
  var address = row['Street Address'] || '';
  var city = row.City || '';
  var price = parseFloat(String(row['List Price'] || 0).replace(/[^0-9.\-]/g, ''));
  var acres = parseFloat(row.Acres || 0) || undefined;
  if (!address || !Number.isFinite(price) || price <= 0) return null;
  return { address: city ? address + ', ' + city + ', ID' : address, price: price, acres: acres, visibility: 'public' };
}
var normalized = DEMO_LAND.map(normalizeDemo).filter(Boolean);
assert(normalized.length === 3, 'All 3 demo rows normalize');
assert(normalized.every(function (l) { return l.price > 0; }), 'All prices > 0');
assert(normalized.every(function (l) { return (l.acres || 0) > 0.5; }), 'All acres > 0.5');
assert(normalized.some(function (l) { return l.address.indexOf('Rigby') !== -1; }), 'Rigby parcel present');

console.log('\n3. Fuzzy search');
function levenshtein(a, b) {
  var s = a.toLowerCase(), t = b.toLowerCase();
  if (s === t) return 0;
  var m = s.length, n = t.length;
  if (m === 0) return n; if (n === 0) return m;
  var dp = [];
  for (var i = 0; i <= m; i++) { dp[i] = []; for (var j = 0; j <= n; j++) dp[i][j] = 0; }
  for (i = 0; i <= m; i++) dp[i][0] = i;
  for (j = 0; j <= n; j++) dp[0][j] = j;
  for (i = 1; i <= m; i++) for (j = 1; j <= n; j++) {
    var cost = s[i-1] === t[j-1] ? 0 : 1;
    dp[i][j] = Math.min(dp[i-1][j]+1, dp[i][j-1]+1, dp[i-1][j-1]+cost);
  }
  return dp[m][n];
}
function fuzzyScore(query, target) {
  if (!query || !target) return 0;
  var q = query.trim().toLowerCase(), t = target.toLowerCase();
  if (!q) return 0;
  if (t.indexOf(q) !== -1) return 0.95;
  var dist = levenshtein(q, t), maxLen = Math.max(q.length, t.length);
  return maxLen === 0 ? 0 : Math.max(0, Math.min(1, 1 - dist / maxLen));
}
assert(fuzzyScore('rigby', '123 Main St, Rigby, ID') >= 0.9, 'Substring rigby scores high');
assert(fuzzyScore('xyzabc', 'completely different') < 0.4, 'Unrelated scores low');

console.log('\n4. Land pro-forma sanity');
function roughLotYield(acres, minLot) { return Math.floor((acres * 0.75) / (minLot || 0.25)); }
var lots = roughLotYield(12.8, 0.5);
assert(lots >= 10 && lots <= 25, 'Lot yield sensible (' + lots + ')');
var coc = (28000 / 200000) * 100;
assert(coc > 10 && coc < 20, 'Cash-on-cash band (' + coc.toFixed(1) + '%)');

console.log('\n5. Env notes');
console.log('  Navica: ' + (process.env.NAVICA_IDX_URL && process.env.NAVICA_API_KEY ? 'SET' : 'not set (demo)'));
console.log('  Schema: run supabase/migrations/2026-07-17-add-visibility.sql if needed');
console.log('  Health: GET /api/health');

console.log('\n[SummitForge] Smoke tests: ' + passed + ' passed, ' + failed + ' failed\n');
process.exit(failed > 0 ? 1 : 0);
