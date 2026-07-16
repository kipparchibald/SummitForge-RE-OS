'use client';

import { useState, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl'; // Mapbox GL
import 'mapbox-gl/dist/mapbox-gl.css';
import { setLastSyncTimestamp, getLastSyncTimestamp, formatLastSyncTime, isLastSyncRecent } from '@/lib/import/lastSync';

// Must be read as a full static reference for Next to inline it into the client bundle.
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

export default function MonitoringDashboard() {
  const [watchedAreas, setWatchedAreas] = useState<any[]>([]);
  const [selectedParcel, setSelectedParcel] = useState<any>(null);
  const [analysisResult, setAnalysisResult] = useState<any>(null);
  const [mapViewState, setMapViewState] = useState({
    longitude: -112.0, // Approx Rigby / Jefferson County, ID
    latitude: 43.7,
    zoom: 11
  });

  // Mock properties/parcels for demo (in production load from Supabase GIS layer)
  const [parcels, setParcels] = useState([
    { id: 1, address: 'Sample Parcel near Teton Heights', lat: 43.72, lng: -112.05, acres: 5.2, price: 450000, type: 'land' },
    { id: 2, address: 'Another Raw Land Opportunity', lat: 43.68, lng: -111.98, acres: 12.8, price: 890000, type: 'land' }
  ]);

  useEffect(() => {
    // TODO: Load from Supabase watched_areas and properties with geometry
    setWatchedAreas([
      { id: '1', name: 'Teton Heights Area', geometry: '...' }
    ]);
  }, []);

  const checkArea = async (id: string) => {
    // Call optimized GIS monitor
    const result = await fetch('/api/monitoring/check', { method: 'POST', body: JSON.stringify({ watchedAreaId: id }) });
    const data = await result.json();
    alert(`Checked area: ${data.newOpportunities} new opportunities found.`);
  };

  const [recentParcels, setRecentParcels] = useState<any[]>([]);
  const [autoLoad, setAutoLoad] = useState(false);
  const [lastPull, setLastPull] = useState('');
  const [syncIsRecent, setSyncIsRecent] = useState(false);

  const loadRecentNavica = async () => {
    try {
      const res = await fetch('/api/import/listings?live=navica');
      const data = await res.json();
      setRecentParcels(data.listings || []);
      const ts = data.lastSync || new Date().toISOString();
      setLastSyncTimestamp(ts);
      setLastPull(formatLastSyncTime(ts));
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
    } catch (e) {
      setRecentParcels([]);
    }
  };

  // Manual trigger for Vercel cron background Navica sync (works in DEMO without CRON_SECRET)
  const triggerNavicaCronSync = async () => {
    try {
      const res = await fetch('/api/cron/sync-navica');
      const data = await res.json();
      if (res.ok) {
        alert(`✅ Navica cron sync complete: ${data.landCount || 0} land listings (${data.source}). Demo: ${data.demo ? 'yes' : 'no'}. ${!data.demo ? 'Live data active.' : ''}`);
        const ts = data.lastSync || new Date().toISOString();
        setLastSyncTimestamp(ts);
        setLastPull(formatLastSyncTime(ts));
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('navica-pull-updated'));
        loadRecentNavica(); // refresh the list
      } else {
        alert(`Sync response: ${data.error || 'Check console'}. In production with CRON_SECRET set, use curl with Authorization header or rely on scheduled cron.`);
      }
    } catch (e: any) {
      alert('Failed to trigger sync: ' + (e?.message || e));
    }
  };

  // Automate live parcels load
  useEffect(() => {
    let iv: any;
    if (autoLoad) {
      iv = setInterval(loadRecentNavica, 60000);
      loadRecentNavica();
    }
    return () => clearInterval(iv);
  }, [autoLoad]);

  // Hydrate shared last pull on mount (for badge)
  useEffect(() => {
    const ts = getLastSyncTimestamp();
    if (ts) setLastPull(formatLastSyncTime(ts));
    setSyncIsRecent(isLastSyncRecent());

    const onUpdate = () => {
      const newTs = getLastSyncTimestamp();
      setLastPull(formatLastSyncTime(newTs));
      setSyncIsRecent(isLastSyncRecent());
    };
    window.addEventListener('navica-pull-updated', onUpdate);
    return () => window.removeEventListener('navica-pull-updated', onUpdate);
  }, []);

  const selectParcel = (parcel: any) => {
    setSelectedParcel(parcel);
    setAnalysisResult(null);
  };

  const runAnalysis = async () => {
    if (!selectedParcel) return;
    
    // Run expanded pro forma + raw land projection
    const { calculateRawLandProForma } = await import('../../lib/analysis/investment-proforma');
    const result = calculateRawLandProForma(selectedParcel);
    setAnalysisResult(result);
    
    // TODO: Save to Supabase + trigger full pipeline
  };

  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>GIS Monitoring</h1>
          <p>Track raw land opportunities across Eastern Idaho. Click parcels to analyze and run pro formas.</p>
        </div>
        {/* Last pulled / live status indicator (shared mechanism) */}
        <span className={`ml-4 px-3 py-1 text-xs rounded-full border font-medium ${syncIsRecent ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : lastPull ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-gray-100 text-gray-500'}`}>
          Live • Last: {lastPull || '—'}
        </span>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <div>
          <h2 className="text-xl mb-2">Interactive Parcel Map (Eastern Idaho)</h2>
          <div className="h-[500px] border rounded-lg overflow-hidden">
            {MAPBOX_TOKEN ? (
              <Map
                {...mapViewState}
                onMove={evt => setMapViewState(evt.viewState)}
                style={{ width: '100%', height: '100%' }}
                mapStyle="mapbox://styles/mapbox/streets-v12"
                mapboxAccessToken={MAPBOX_TOKEN}
              >
                {parcels.map(parcel => (
                  <Marker
                    key={parcel.id}
                    longitude={parcel.lng}
                    latitude={parcel.lat}
                    onClick={() => selectParcel(parcel)}
                  >
                    <div className="w-4 h-4 bg-blue-600 rounded-full cursor-pointer" />
                  </Marker>
                ))}
              </Map>
            ) : (
              <div className="h-full flex flex-col items-center justify-center gap-3 bg-gray-50 text-center p-6">
                <p className="font-medium text-gray-700">Map unavailable</p>
                <p className="text-sm text-gray-500 max-w-xs">
                  Set <code className="px-1 py-0.5 bg-gray-200 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> to
                  enable the parcel map. Parcel selection below still works without it.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-2">
                  {parcels.map(parcel => (
                    <button
                      key={parcel.id}
                      onClick={() => selectParcel(parcel)}
                      className="px-3 py-1 text-xs rounded-full border bg-white hover:bg-gray-100"
                    >
                      {parcel.address || `Parcel ${parcel.id}`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">Click any parcel marker to select and run analysis</p>
        </div>

        {/* Controls & Results */}
        <div>
          <h2 className="text-xl mb-4">Watched Areas & Quick Actions</h2>
          
          <div className="mb-6">
            <h3 className="font-semibold mb-2">Monitored Areas</h3>
            {watchedAreas.map(area => (
              <div key={area.id} className="flex justify-between items-center p-3 bg-gray-50 rounded mb-2">
                <span>{area.name}</span>
                <button 
                  onClick={() => checkArea(area.id)}
                  className="px-3 py-1 bg-green-600 text-white rounded text-sm"
                >
                  Check Now
                </button>
              </div>
            ))}
            <button onClick={loadRecentNavica} className="mt-2 w-full text-sm px-3 py-2 border rounded hover:bg-gray-50">
              Load Recent Navica Parcels (Live IDX)
            </button>
            <button onClick={triggerNavicaCronSync} className="mt-1 w-full text-sm px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
              🔄 Trigger Navica Background Sync (Cron Endpoint)
            </button>
            <label className="mt-1 flex items-center gap-1 text-xs cursor-pointer">
              <input type="checkbox" checked={autoLoad} onChange={e=>setAutoLoad(e.target.checked)} /> Auto-refresh live parcels
            </label>
          </div>

          {recentParcels.length > 0 && (
            <div className="mb-6 bg-white border rounded p-4">
              <div className="font-semibold text-sm mb-2">Recent Imported Land (Navica)</div>
              <ul className="text-xs space-y-1 max-h-40 overflow-auto">
                {recentParcels.slice(0, 6).map((p, i) => (
                  <li key={i}>{p.address} — {p.acres} ac • ${p.price?.toLocaleString()}</li>
                ))}
              </ul>
              <div className="text-[10px] mt-1 text-gray-500">Click parcels on map or run analysis below. Data from live feed.</div>
            </div>
          )}

          {/* Selected Parcel Analysis */}
          {selectedParcel && (
            <div className="bg-white border rounded-lg p-4 mb-6">
              <h3 className="font-semibold mb-2">Selected Parcel</h3>
              <p><strong>Address:</strong> {selectedParcel.address}</p>
              <p><strong>Acres:</strong> {selectedParcel.acres}</p>
              <p><strong>Price:</strong> ${selectedParcel.price.toLocaleString()}</p>
              
              <button 
                onClick={runAnalysis}
                className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                Run Raw Land Analysis & Pro Forma
              </button>

              {analysisResult && (
                <div className="mt-4 p-4 bg-green-50 rounded">
                  <h4 className="font-semibold">Analysis Results</h4>
                  <pre className="text-sm overflow-auto">{JSON.stringify(analysisResult, null, 2)}</pre>
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-500">
            All analysis uses existing GIS data + PostGIS. No new drone flights required.
          </div>
        </div>
      </div>
    </div>
  );
}