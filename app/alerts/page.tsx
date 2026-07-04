'use client';

import React, { useState } from 'react';

interface UserPreference {
  id: string;
  name: string;
  locations: string[];
  minPrice: number;
  maxPrice: number;
  minAcres: number;
  propertyTypes: string[];
  newConstructionOnly: boolean;
  active: boolean;
}

export default function PropertyAlerts() {
  const [preferences, setPreferences] = useState<UserPreference[]>([
    {
      id: '1',
      name: 'Rigby New Construction',
      locations: ['Rigby'],
      minPrice: 350000,
      maxPrice: 650000,
      minAcres: 0.3,
      propertyTypes: ['Single Family', 'New Construction'],
      newConstructionOnly: true,
      active: true,
    },
    {
      id: '2',
      name: 'Land 5+ Acres',
      locations: ['Rigby', 'Ririe', 'Roberts'],
      minPrice: 100000,
      maxPrice: 400000,
      minAcres: 5,
      propertyTypes: ['Land', 'Farm'],
      newConstructionOnly: false,
      active: true,
    },
  ]);

  const [showNewForm, setShowNewForm] = useState(false);

  const toggleAlert = (id: string) => {
    setPreferences(prev =>
      prev.map(p => (p.id === id ? { ...p, active: !p.active } : p))
    );
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="flex justify-between items-end mb-8">
        <div>
          <h1 className="text-3xl font-semibold">Property Alerts</h1>
          <p className="text-gray-600 mt-1">Get notified when new listings match your preferences</p>
        </div>
        <button
          onClick={() => setShowNewForm(!showNewForm)}
          className="bg-black text-white px-6 py-2.5 rounded-2xl text-sm font-medium"
        >
          + New Alert
        </button>
      </div>

      {/* AI Learning Notice */}
      <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 mb-8 text-sm">
        <div className="font-medium text-blue-900 mb-1">🤖 AI-Powered Matching (Coming Soon)</div>
        <div className="text-blue-700">
          Summit Forge will automatically learn from properties you view, save, or inquire about, 
          and refine your alerts over time. You can also manually create alerts below.
        </div>
      </div>

      {/* Active Alerts */}
      <div className="space-y-4">
        {preferences.map((pref) => (
          <div key={pref.id} className="bg-white border border-gray-200 rounded-3xl p-6 flex justify-between items-center">
            <div>
              <div className="font-semibold text-lg">{pref.name}</div>
              <div className="text-sm text-gray-500 mt-1">
                {pref.locations.join(', ')} • {pref.minAcres}+ acres • {pref.newConstructionOnly ? 'New Construction' : 'Any'}
              </div>
              <div className="text-xs text-gray-400 mt-1">
                ${pref.minPrice.toLocaleString()} – ${pref.maxPrice.toLocaleString()}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className={`text-xs px-3 py-1 rounded-full ${pref.active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                {pref.active ? 'Active' : 'Paused'}
              </div>
              <button
                onClick={() => toggleAlert(pref.id)}
                className="text-sm px-4 py-2 border rounded-2xl hover:bg-gray-50"
              >
                {pref.active ? 'Pause' : 'Activate'}
              </button>
              <button className="text-sm text-gray-400 hover:text-gray-600">Edit</button>
            </div>
          </div>
        ))}
      </div>

      {showNewForm && (
        <div className="mt-8 bg-white border border-gray-200 rounded-3xl p-8">
          <h3 className="font-semibold mb-6">Create New Alert</h3>
          <div className="text-sm text-gray-500">
            Form coming soon. You’ll be able to set location, price range, acreage, new construction preference, etc.
          </div>
        </div>
      )}

      <div className="mt-10 text-xs text-gray-400">
        When new listings are imported from Navica, Summit Forge will automatically match them against your active alerts and notify you.
      </div>
    </div>
  );
}
