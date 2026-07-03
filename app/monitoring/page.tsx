'use client';

import { useState, useEffect } from 'react';
import Map, { Marker, Popup } from 'react-map-gl'; // Mapbox GL
import 'mapbox-gl/dist/mapbox-gl.css';

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
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">GIS Monitoring Dashboard</h1>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Map Section */}
        <div>
          <h2 className="text-xl mb-2">Interactive Parcel Map (Jefferson County Area)</h2>
          <div className="h-[500px] border rounded-lg overflow-hidden">
            <Map
              {...mapViewState}
              onMove={evt => setMapViewState(evt.viewState)}
              style={{ width: '100%', height: '100%' }}
              mapStyle="mapbox://styles/mapbox/streets-v12"
              mapboxAccessToken={process.env.NEXT_PUBLIC_MAPBOX_TOKEN}
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
          </div>

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