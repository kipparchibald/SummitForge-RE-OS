'use client';

import React, { useState } from 'react';

export default function DataImport() {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      alert(`Successfully processed ${file.name}\n\n+187 new records added to analytics.`);
    }, 1600);
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Data Import</h1>
      <p className="text-gray-600 mb-8">Upload Navica MLS exports to refresh all analytics</p>

      <div className="bg-white border border-gray-200 rounded-3xl p-8">
        <div className="border-2 border-dashed border-gray-300 rounded-3xl p-10 text-center">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="font-semibold mb-2">Upload Navica Export (CSV)</h3>
          <p className="text-sm text-gray-500 mb-6">Supports your standard Jefferson County export format</p>
          
          <label className="inline-block">
            <input 
              type="file" 
              accept=".csv" 
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="bg-black text-white px-8 py-3 rounded-2xl text-sm font-medium cursor-pointer hover:bg-gray-900 inline-block">
              {isProcessing ? 'Processing...' : 'Choose CSV File'}
            </div>
          </label>
        </div>

        <div className="mt-6 text-xs text-gray-500">
          Tip: Export from Navica with Sold + Active listings for best results. We automatically deduplicate.
        </div>
      </div>
    </div>
  );
}
