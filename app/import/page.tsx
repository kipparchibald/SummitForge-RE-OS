'use client';

import React, { useState } from 'react';
import { getStoredAlerts, addMatches } from '@/lib/alerts/store';

export default function DataImport() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('source', 'mls');

      // Send current alerts so the server can run matching
      const alerts = getStoredAlerts();
      if (alerts.length > 0) {
        formData.append('alerts', JSON.stringify(alerts));
      }

      const res = await fetch('/api/import/listings', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Import failed');
      }

      // Store matches locally so the Alerts page can show them
      if (data.matches && data.matches.length > 0) {
        addMatches(data.matches);
      }

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <h1 className="text-3xl font-semibold mb-2">Data Import</h1>
      <p className="text-gray-600 mb-8">
        Upload Navica MLS exports. New listings are automatically matched against your active Property Alerts.
      </p>

      <div className="bg-white border border-gray-200 rounded-3xl p-8">
        <div className="border-2 border-dashed border-gray-300 rounded-3xl p-10 text-center">
          <div className="text-5xl mb-4">📁</div>
          <h3 className="font-semibold mb-2">Upload Navica Export (CSV)</h3>
          <p className="text-sm text-gray-500 mb-6">
            Supports your standard Jefferson County export format. Matching runs automatically.
          </p>

          <label className="inline-block">
            <input
              type="file"
              accept=".csv,.json"
              onChange={handleFileUpload}
              className="hidden"
              disabled={isProcessing}
            />
            <div className="bg-black text-white px-8 py-3 rounded-2xl text-sm font-medium cursor-pointer hover:bg-gray-900 inline-block">
              {isProcessing ? 'Processing + Matching...' : 'Choose CSV File'}
            </div>
          </label>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-sm text-red-700">
            {error}
          </div>
        )}

        {result && (
          <div className="mt-6 p-5 bg-emerald-50 border border-emerald-100 rounded-2xl">
            <div className="font-medium text-emerald-900">Import complete</div>
            <div className="text-sm text-emerald-800 mt-1">
              Imported <strong>{result.imported}</strong> listings.
              {result.matches?.length > 0 && (
                <>
                  {' '}
                  Generated <strong>{result.matches.length}</strong> alert matches.
                  Go to Property Alerts → Recent Matches to review them.
                </>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 text-xs text-gray-500">
          Tip: Export from Navica with Sold + Active listings for best results. We automatically
          deduplicate and run your active alerts against every new listing.
        </div>
      </div>
    </div>
  );
}
