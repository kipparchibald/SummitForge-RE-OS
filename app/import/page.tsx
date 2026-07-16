'use client';
import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { queryListings } from '@/lib/supabase/client';
import { fuzzyFilterListings, NormalizedListing } from '@/lib/import/listings';
import { getRecentListings, searchRecentListingsFuzzy, syncRecentListingsFromSupabase, setLastSyncTimestamp, getLastSyncTimestamp, formatLastSyncTime, isLastSyncRecent } from '@/lib/import/recentListings';
import { getAlerts } from '@/lib/alerts/supabase-store';
import { COUNTIES } from '@/lib/geo/counties';

interface ImportedListing {
  address: string;
  price: number;
  acres?: number;
  propertyType?: string;
  description?: string;
  url?: string;
  externalId?: string;
  _score?: number;
}

// Module-scope so its identity is stable across ImportPage renders. When this
// was defined inside the component, every keystroke gave it a new identity and
// React remounted the subtree, so the search input lost focus after each letter.
const SearchFilters = ({
  searchTerm, setSearchTerm, minAcres, setMinAcres, maxPrice, setMaxPrice,
  locationFilter, setLocationFilter, sortBy, setSortBy, useFuzzy, setUseFuzzy,
  onClear, onSemanticAI, isLoading, isSearching, lastSearchSource
}: any) => (
  <div className="grid grid-cols-2 md:grid-cols-6 gap-2 text-sm w-full md:w-auto">
    <input
      type="text"
      placeholder="Search address, MLS #, description..."
      value={searchTerm}
      onChange={e => setSearchTerm(e.target.value)}
      className="border p-2 rounded col-span-2 md:col-span-2"
    />
    <input
      type="number"
      placeholder="Min acres"
      value={minAcres}
      onChange={e => setMinAcres(e.target.value)}
      className="border p-2 rounded"
    />
    <input
      type="number"
      placeholder="Max price $"
      value={maxPrice}
      onChange={e => setMaxPrice(e.target.value)}
      className="border p-2 rounded"
    />
    <select
      value={locationFilter}
      onChange={e => setLocationFilter(e.target.value)}
      className="border p-2 rounded"
    >
      <option value="">All locations</option>
      {COUNTIES.map(({ county, locations }) => (
        <optgroup key={county} label={`${county} County`}>
          {locations.map(loc => (
            <option key={loc} value={loc.toLowerCase()}>{loc}</option>
          ))}
        </optgroup>
      ))}
    </select>
    <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="border p-2 rounded">
      <option value="acres-desc">Sort: Acres ↓</option>
      <option value="score">Sort: Relevance ↓</option>
      <option value="price-asc">Price ↑</option>
      <option value="price-desc">Price ↓</option>
    </select>
    <button onClick={onClear} className="text-xs border px-2 py-1 rounded hover:bg-gray-50">Clear</button>

    <div className="col-span-2 md:col-span-6 flex items-center gap-3 mt-1 flex-wrap">
      <label className="flex items-center gap-1 text-xs cursor-pointer">
        <input type="checkbox" checked={useFuzzy} onChange={e => setUseFuzzy(e.target.checked)} />
        Use fuzzy (Levenshtein + score) + MLS/desc
      </label>
      <button
        onClick={onSemanticAI}
        disabled={isLoading || isSearching}
        className="text-xs px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-60"
      >
        🧠 Semantic Search with AI
      </button>
      <span className="text-[10px] text-gray-400">{isSearching ? 'Searching DB live...' : lastSearchSource}</span>
    </div>
  </div>
);

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [url, setUrl] = useState('');
  const [source, setSource] = useState<'mls' | 'zillow' | 'landwatch' | 'navica' | 'idx-site'>('mls');
  const [status, setStatus] = useState('');
  const [importedListings, setImportedListings] = useState<ImportedListing[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Enhanced search / filters for imported results (and live Navica data)
  const [searchTerm, setSearchTerm] = useState('');
  const [minAcres, setMinAcres] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [locationFilter, setLocationFilter] = useState(''); // e.g. Rigby, Blackfoot
  const [autoSync, setAutoSync] = useState(false);
  // Start empty and hydrate from localStorage in useEffect — reading it during
  // render makes server and client HTML disagree (hydration error).
  const [lastLiveSync, setLastLiveSync] = useState('');
  const [syncIsRecent, setSyncIsRecent] = useState(false);
  const [sortBy, setSortBy] = useState<'price-asc' | 'price-desc' | 'acres-desc' | 'newest' | 'score'>('acres-desc');

  // Deeper live search state: DB + fuzzy + AI
  const [dbListings, setDbListings] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [aiSemanticResults, setAiSemanticResults] = useState<any>(null);
  const [useFuzzy, setUseFuzzy] = useState(true);
  const [lastSearchSource, setLastSearchSource] = useState('');
  const [attribution, setAttribution] = useState('');

  // Combine sources: imported + recent + live DB results for real-time search
  // Use new fuzzy recent helper when search active
  const recentPart = searchTerm ? searchRecentListingsFuzzy(searchTerm, 100) : getRecentListings();
  const allSourceListings: any[] = [
    ...importedListings,
    ...recentPart,
    ...dbListings.map((r: any) => ({
      address: r.address,
      price: r.price,
      acres: r.acres,
      propertyType: r.property_type || r.propertyType,
      description: r.description,
      url: r.url,
      externalId: r.external_id || r.externalId,
      source: r.source,
    }))
  ];

  // Dedup by address + price roughly
  const uniqueSources = Array.from(
    new Map(allSourceListings.map(l => [`${l.address}|${l.price}`, l])).values()
  );

  // Deeper fuzzy search (Levenshtein + includes + score) + MLS # + description support
  let filteredListings: any[] = useFuzzy && searchTerm
    ? fuzzyFilterListings(uniqueSources, searchTerm)
    : uniqueSources.filter((l) => {
        const q = searchTerm.toLowerCase();
        const matchesSearch = !searchTerm || 
          l.address.toLowerCase().includes(q) ||
          (l.propertyType || '').toLowerCase().includes(q) ||
          (l.description || '').toLowerCase().includes(q) ||
          (l.externalId || '').toLowerCase().includes(q); // MLS # support
        return matchesSearch;
      });

  // Apply other filters
  filteredListings = filteredListings.filter((l: any) => {
    const acres = l.acres || 0;
    const matchesAcres = !minAcres || acres >= parseFloat(minAcres);
    const matchesPrice = !maxPrice || l.price <= parseFloat(maxPrice);
    const matchesLoc = !locationFilter || l.address.toLowerCase().includes(locationFilter.toLowerCase());
    return matchesAcres && matchesPrice && matchesLoc;
  });

  // Automated sorting for live search results (score-aware)
  filteredListings = [...filteredListings].sort((a: any, b: any) => {
    if (sortBy === 'score') return (b._score || 0) - (a._score || 0);
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'acres-desc') return (b.acres || 0) - (a.acres || 0);
    return 0; // newest would need date
  });

  // Automate live data: polling for real-time feel (every 45s when enabled)
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (autoSync && source === 'navica') {
      interval = setInterval(async () => {
        await pullLiveNavicaSilent();
      }, 45000);
    }
    return () => { if (interval) clearInterval(interval); };
  }, [autoSync, source]);

  // LIVE SEARCH: debounce + real-time results from Supabase queryListings + recent + fuzzy
  // Triggered on searchTerm, filters change. Uses queryListings when available.
  useEffect(() => {
    const debounceMs = 280; // live feel
    const handler = setTimeout(async () => {
      if (!searchTerm && !minAcres && !maxPrice && !locationFilter) {
        setDbListings([]);
        setLastSearchSource('');
        return;
      }
      setIsSearching(true);
      try {
        // Enhance filters: use Supabase queryListings
        const dbFilters: any = {
          limit: 80,
        };
        if (minAcres) dbFilters.minAcres = parseFloat(minAcres);
        if (maxPrice) dbFilters.maxPrice = parseFloat(maxPrice);
        if (locationFilter) dbFilters.location = locationFilter; // note: server may ignore extra, client fuzzy too
        // source / property handled in fuzzy post if needed

        const results = await queryListings(searchTerm || undefined, dbFilters);
        // Post-process with fuzzy for deeper scoring (MLS #, desc, etc already boosted in queryListings)
        let processed = results;
        if (useFuzzy && searchTerm) {
          processed = fuzzyFilterListings(
            results.map((r: any) => ({
              address: r.address,
              price: r.price,
              acres: r.acres,
              propertyType: r.property_type,
              description: r.description,
              externalId: r.external_id,
            })),
            searchTerm
          );
        }
        setDbListings(processed);
        setLastSearchSource(`Supabase queryListings + ${useFuzzy ? 'fuzzy' : 'exact'} (${results.length} raw)`);
      } catch (e) {
        // fallback to recent only
        console.warn('[Import] queryListings failed, using recent', e);
        const recent = getRecentListings();
        setDbListings(recent);
        setLastSearchSource('recentListings fallback');
      } finally {
        setIsSearching(false);
      }
    }, debounceMs);

    return () => clearTimeout(handler);
  }, [searchTerm, minAcres, maxPrice, locationFilter, useFuzzy]);

  // On mount, ensure recent synced for DB + recent hybrid results
  useEffect(() => {
    syncRecentListingsFromSupabase().catch(() => {});
    // hydrate shared last sync display
    const ts = getLastSyncTimestamp();
    if (ts) setLastLiveSync(formatLastSyncTime(ts));
    setSyncIsRecent(isLastSyncRecent());

    const onUpdate = () => {
      const newTs = getLastSyncTimestamp();
      setLastLiveSync(formatLastSyncTime(newTs));
      setSyncIsRecent(isLastSyncRecent());
    };
    window.addEventListener('navica-pull-updated', onUpdate);
    return () => window.removeEventListener('navica-pull-updated', onUpdate);
  }, []);

  const pullLiveNavicaSilent = async () => {
    try {
      const res = await fetch('/api/import/listings?live=navica');
      const data = await res.json();
      if (data.listings) {
        setImportedListings(data.listings);
        const ts = data.lastSync || new Date().toISOString();
        setLastSyncTimestamp(ts);
        setLastLiveSync(formatLastSyncTime(ts));
        // notify header badge + other indicators
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
      }
    } catch (e) {
      // silent fail in auto mode
    }
  };

  // overrideSource: setSource() is async, so callers that switch source and
  // import in one action (Pull Live button) must pass the source explicitly.
  const handleImport = async (overrideSource?: string) => {
    const activeSource = overrideSource || source;
    setIsLoading(true);
    setStatus('Importing and analyzing...');
    setImportedListings([]);

    try {
      if (activeSource === 'idx-site') {
        // Real MLS listings from the brokerage's own IDX site.
        const res = await fetch('/api/import/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ live: 'site', source: 'idx-site' }),
        });
        const data = await res.json();
        if (data.listings) {
          setImportedListings(data.listings);
          const ts = data.lastSync || new Date().toISOString();
          setLastSyncTimestamp(ts);
          setLastLiveSync(formatLastSyncTime(ts));
          setSyncIsRecent(true);
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
          setAttribution(data.attribution || '');
          setStatus(`✅ Imported ${data.imported} live listings from your IDX site (${data.landCount} land).`);
        } else {
          setStatus(data.error || 'Site import failed.');
        }
      } else if (activeSource === 'navica') {
        // Live Navica pull
        const res = await fetch('/api/import/listings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ live: 'navica', source: 'navica' })
        });
        const data = await res.json();

        if (data.listings) {
          setImportedListings(data.listings);
          const ts = data.lastSync || new Date().toISOString();
          setLastSyncTimestamp(ts);
          setLastLiveSync(formatLastSyncTime(ts));
          if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
          setStatus(`✅ Live Navica pull complete. ${data.imported} land parcels imported from ${data.source}.`);
        } else {
          setStatus(data.error || 'Live pull completed (see console).');
        }
      } else {
        // Existing file/URL flow — include active alerts so the matching engine runs
        const formData = new FormData();
        if (file) formData.append('file', file);
        if (url) formData.append('url', url);
        formData.append('source', activeSource);

        try {
          const alerts = await getAlerts('user_kipp');
          if (alerts.length > 0) formData.append('alerts', JSON.stringify(alerts));
        } catch {
          // alerts store unavailable — import proceeds without matching
        }

        const res = await fetch('/api/import/listings', { method: 'POST', body: formData });
        const data = await res.json();

        if (data.listings) setImportedListings(data.listings);
        const matchNote = data.matches?.length ? ` ${data.matches.length} alert matches generated.` : '';
        setStatus(`✅ Imported from ${activeSource}. ${data.imported || 0} listings.${matchNote}`);
      }
    } catch (e) {
      setStatus('Import failed. Check console or try demo data.');
      console.error(e);
    }

    setIsLoading(false);
    setFile(null);
    setUrl('');
  };

  const pullLiveNavica = async () => {
    setSource('navica');
    await handleImport('navica');
    const ts = new Date().toISOString();
    setLastSyncTimestamp(ts);
    setLastLiveSync(formatLastSyncTime(ts));
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
  };

  // AI Semantic Search tie-in: calls /api/ai/council with search term for matching listings
  const handleSemanticSearchWithAI = async () => {
    const term = searchTerm || 'land parcels in Eastern Idaho';
    setIsLoading(true);
    setAiSemanticResults(null);
    setStatus('Running Semantic Search with AI Council...');
    try {
      // Pass search term + current filter context
      const res = await fetch('/api/ai/council', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          request: `Semantic search and match listings for: "${term}". Analyze description, MLS #, address for relevance. Prioritize best matches for raw land opportunities.`,
          context: {
            searchTerm: term,
            filters: { minAcres, maxPrice, locationFilter },
            availableListingsHint: filteredListings.slice(0, 5).map((l: any) => ({ address: l.address, acres: l.acres, price: l.price }))
          }
        })
      });
      const data = await res.json();
      setAiSemanticResults(data);
      setStatus(`✅ AI Semantic Search complete. ${data.message ? 'See AI insights below.' : 'Results synthesized.'}`);

      // If AI returns any structured matches, we could merge but for now surface in UI
      if (data.listings || data.matches) {
        // Optional: could setDb or augment here
      }
    } catch (e) {
      setStatus('AI semantic search failed (falling back to fuzzy DB).');
      console.error(e);
      // Fallback to deeper query
      const fallback = await queryListings(term, { limit: 30 });
      setDbListings(fallback);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="page-header">
        <h1>Import Listings</h1>
        <p>Bring in opportunities from multiple sources. Connect live Navica IDX from Archibald-Bagley for real-time Eastern Idaho data.</p>
      </div>

      <div className="card p-8 mb-6">
        <div className="mb-4">
          <label className="text-sm font-medium block mb-1">Source</label>
          <select value={source} onChange={e => setSource(e.target.value as any)} className="border p-3 rounded-lg w-full">
            <option value="mls">MLS CSV Export</option>
            <option value="zillow">Zillow</option>
            <option value="landwatch">LandWatch / Lands of America</option>
            <option value="idx-site">My IDX Site — real MLS listings (Live)</option>
            <option value="navica">Navica IDX - Archibald-Bagley (Live)</option>
          </select>
        </div>

        {source !== 'navica' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="text-sm font-medium block mb-1">CSV / File</label>
              <input type="file" onChange={e => setFile(e.target.files?.[0] || null)} className="block w-full text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">Or Paste URL</label>
              <input type="text" placeholder="https://..." value={url} onChange={e => setUrl(e.target.value)} className="border p-3 w-full rounded-lg" />
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={() => handleImport()}
            disabled={isLoading}
            className="btn-primary flex-1 py-3 rounded-2xl font-semibold disabled:opacity-60"
          >
            {isLoading ? 'Connecting...' : (source === 'navica' ? 'Pull Live Navica Data' : 'Import & Trigger Analysis')}
          </button>

          <button
            onClick={pullLiveNavica}
            disabled={isLoading}
            className="px-6 py-3 rounded-2xl border font-medium hover:bg-gray-50 disabled:opacity-60"
          >
            ⚡ Pull Live from Archibald-Bagley Navica
          </button>
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs">
          <label className="flex items-center gap-1 cursor-pointer">
            <input 
              type="checkbox" 
              checked={autoSync} 
              onChange={(e) => setAutoSync(e.target.checked)} 
            /> 
            Auto-sync every 45s (makes it live)
          </label>
          {/* Shared live status indicator (updates on Navica pull, syncs to header) */}
          <span className={syncIsRecent ? 'text-emerald-600 font-medium' : 'text-amber-600'}>
            Live • Last: {lastLiveSync || '—'}
          </span>
          <span className="text-gray-400">• Real-time Navica IDX data</span>
        </div>

        {status && <div className="mt-4 p-3 bg-emerald-50 text-sm rounded-xl">{status}</div>}
      </div>

      {/* Results + Enhanced Search/Filters */}
      {importedListings.length > 0 && (
        <div className="card p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-4">
            <div>
              <div className="font-semibold">Imported + Live DB + Recent Land Parcels</div>
              <div className="text-xs text-gray-500">Showing {filteredListings.length} matches (hybrid fuzzy + queryListings + recent)</div>
              {attribution && (
                <div className="text-[10px] text-gray-500 mt-0.5">Listing data courtesy of {attribution}. Displayed under IDX rules.</div>
              )}
            </div>

            {/* Search & Filter Controls - using reusable SearchFilters component */}
            <SearchFilters
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              minAcres={minAcres} setMinAcres={setMinAcres}
              maxPrice={maxPrice} setMaxPrice={setMaxPrice}
              locationFilter={locationFilter} setLocationFilter={setLocationFilter}
              sortBy={sortBy} setSortBy={setSortBy}
              useFuzzy={useFuzzy} setUseFuzzy={setUseFuzzy}
              onClear={() => { setSearchTerm(''); setMinAcres(''); setMaxPrice(''); setLocationFilter(''); setSortBy('acres-desc'); setDbListings([]); setAiSemanticResults(null); }}
              onSemanticAI={handleSemanticSearchWithAI}
              isLoading={isLoading} isSearching={isSearching} lastSearchSource={lastSearchSource}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="py-2 pr-4">Address / MLS</th>
                  <th className="py-2 pr-4">Price</th>
                  <th className="py-2 pr-4">Acres</th>
                  <th className="py-2">Type</th>
                  <th className="py-2 text-right">Score</th>
                </tr>
              </thead>
              <tbody>
                {filteredListings.slice(0, 60).map((l, i) => (
                  <tr key={i} className="border-b last:border-none hover:bg-gray-50">
                    <td className="py-2 pr-4">
                      {l.url ? <a href={l.url} target="_blank" className="underline">{l.address}</a> : l.address}
                      {l.externalId && <div className="text-[10px] text-gray-500">MLS #: {l.externalId}</div>}
                      {l.description && <div className="text-[10px] text-gray-400 truncate max-w-[280px]">{l.description.slice(0, 80)}</div>}
                    </td>
                    <td className="py-2 pr-4">${l.price.toLocaleString()}</td>
                    <td className="py-2 pr-4">{l.acres ? l.acres : '—'}</td>
                    <td className="py-2">{l.propertyType}</td>
                    <td className="py-2 text-right font-mono text-xs">{l._score ? l._score.toFixed(2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-4 text-xs text-gray-500">
            These parcels are now available for GIS analysis, AI valuation, and marketing plans.
            Go to <Link href="/monitoring" className="underline">GIS Monitoring</Link> or <Link href="/ai-assistants" className="underline">AI Assistants</Link>.
            Filters and search enhance discovery of the right raw land opportunities. Live = DB queryListings + recent + fuzzy.
          </div>

          {/* AI Semantic Search Results Tie-in */}
          {aiSemanticResults && (
            <div className="mt-4 p-4 bg-indigo-50 rounded-xl text-sm border border-indigo-100">
              <div className="font-semibold mb-1">🧠 AI Council Semantic Search Response</div>
              <div className="whitespace-pre-wrap text-xs">{JSON.stringify(aiSemanticResults, null, 2).slice(0, 900)}</div>
              {aiSemanticResults.message && <div className="mt-2 text-indigo-700">{aiSemanticResults.message}</div>}
            </div>
          )}
        </div>
      )}

      <div className="mt-6 text-xs text-gray-500">
        Configure real <code>NAVICA_IDX_URL</code> + <code>NAVICA_API_KEY</code> in .env for live Snake River MLS data.
        Demo data is realistic Eastern Idaho raw land across all seven counties.
      </div>
    </div>
  );
}
