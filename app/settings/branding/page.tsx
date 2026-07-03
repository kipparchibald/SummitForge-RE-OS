'use client';

import { useState } from 'react';

export default function BrandingSettings() {
  const [branding, setBranding] = useState({
    logo: '',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
    companyName: 'Archibald-Bagley Real Estate',
    customDomain: 'app.archibaldbagley.com'
  });

  const handleSave = () => {
    // In production: Save to Supabase + apply theme variables
    alert('Branding settings saved! (White-label ready)');
    // Apply CSS variables dynamically
    document.documentElement.style.setProperty('--primary', branding.primaryColor);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-2">White-Label Branding Settings</h1>
      <p className="text-gray-600 mb-8">Customize the platform appearance for your brand or resell as white-label.</p>

      <div className="bg-white p-8 rounded-xl border space-y-6">
        <div>
          <label className="block font-medium mb-2">Company / Brokerage Name</label>
          <input 
            type="text" 
            value={branding.companyName}
            onChange={(e) => setBranding({...branding, companyName: e.target.value})}
            className="w-full border p-3 rounded-lg"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block font-medium mb-2">Primary Color</label>
            <div className="flex gap-3">
              <input 
                type="color" 
                value={branding.primaryColor}
                onChange={(e) => setBranding({...branding, primaryColor: e.target.value})}
                className="w-16 h-12 border rounded"
              />
              <input 
                type="text" 
                value={branding.primaryColor}
                onChange={(e) => setBranding({...branding, primaryColor: e.target.value})}
                className="flex-1 border p-3 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-2">Secondary Color</label>
            <div className="flex gap-3">
              <input 
                type="color" 
                value={branding.secondaryColor}
                onChange={(e) => setBranding({...branding, secondaryColor: e.target.value})}
                className="w-16 h-12 border rounded"
              />
              <input 
                type="text" 
                value={branding.secondaryColor}
                onChange={(e) => setBranding({...branding, secondaryColor: e.target.value})}
                className="flex-1 border p-3 rounded-lg font-mono"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block font-medium mb-2">Custom Domain (White-Label)</label>
          <input 
            type="text" 
            value={branding.customDomain}
            onChange={(e) => setBranding({...branding, customDomain: e.target.value})}
            className="w-full border p-3 rounded-lg"
            placeholder="yourbrand.com"
          />
          <p className="text-xs text-gray-500 mt-1">Point your domain to this platform (CNAME or A record).</p>
        </div>

        <button 
          onClick={handleSave}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded-xl font-semibold text-lg"
        >
          Save Branding & Apply Theme
        </button>

        <div className="text-center text-sm text-gray-500 pt-4 border-t">
          This foundation enables full white-labeling and reseller mode for other brokerages.
        </div>
      </div>
    </div>
  );
}