'use client';

import React, { useState } from 'react';
import PriceTrendChart from '@/components/PriceTrendChart';
import PredictiveChartsBundle from '@/components/PredictiveCharts';

export default function AnalyticsDashboard() {
  const [lastImport, setLastImport] = useState('2026-07-14');
  const [recordCount, setRecordCount] = useState(12874);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'combined' | 'rigby' | 'ririe'>('combined');

  const handleImport = () => {
    setIsImporting(true);
    setImportSuccess(false);

    setTimeout(() => {
      const newDate = new Date().toISOString().split('T')[0];
      setLastImport(newDate);
      setRecordCount((prev) => prev + 187);
      setIsImporting(false);
      setImportSuccess(true);
      setTimeout(() => setImportSuccess(false), 3000);
    }, 1400);
  };

  const ncData = {
    combined: {
      price: 285,
      change: 7.4,
      insight:
        'Strong momentum — good window for new spec listings in Rigby & Ririe. New construction $/sqft leading resale.',
    },
    rigby: {
      price: 295,
      change: 8.9,
      insight:
        'Rigby new construction showing strong pricing power. Consider accelerating Teton Heights spec builds.',
    },
    ririe: {
      price: 268,
      change: 5.2,
      insight:
        'Ririe pricing rising steadily at a healthy but more moderate pace than Rigby.',
    },
  };

  const currentNC = ncData[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-gray-600 mt-1">
              Jefferson County · Rigby & Ririe focus · Powered by Navica MLS
            </p>
          </div>

          <div className="flex items-center gap-3">
            {importSuccess && (
              <div className="text-sm text-green-600 font-medium flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-2xl">
                ✓ +187 new records imported
              </div>
            )}
            <button
              onClick={handleImport}
              disabled={isImporting}
              className="bg-black hover:bg-gray-900 text-white px-6 py-2.5 rounded-2xl text-sm font-medium transition disabled:opacity-70 flex items-center gap-2"
            >
              {isImporting ? 'Importing from Navica...' : 'Import New Navica Data'}
            </button>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-6 mb-8 shadow-sm">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Last Import</div>
              <div className="text-3xl font-semibold mt-2">{lastImport}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Total Records</div>
              <div className="text-3xl font-semibold mt-2">{recordCount.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-widest text-gray-500">Coverage</div>
              <div className="text-3xl font-semibold mt-2">Jefferson County, ID</div>
              <div className="text-sm text-gray-500 mt-0.5">
                Hamer / Terreton excluded from Rigby-Ririe stats
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-3xl p-6 mb-8 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <h2 className="text-lg font-semibold">New construction $/sqft</h2>
            <div className="flex bg-gray-100 rounded-2xl p-1">
              {(['combined', 'rigby', 'ririe'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-xl text-sm font-medium capitalize transition ${
                    activeTab === tab
                      ? 'bg-white shadow text-gray-900'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-end gap-8">
            <div>
              <div className="text-4xl font-bold tracking-tight">${currentNC.price}</div>
              <div className="text-sm text-gray-500">per sq ft · new construction</div>
            </div>
            <div className="text-emerald-600 font-semibold text-lg">+{currentNC.change}% YoY</div>
            <p className="text-sm text-gray-600 max-w-xl">{currentNC.insight}</p>
          </div>
          <div className="mt-6">
            <PriceTrendChart />
          </div>
        </div>

        <div className="mb-4">
          <h2 className="text-xl font-semibold text-gray-900 mb-1">
            Predictive analytics
          </h2>
          <p className="text-sm text-gray-500 mb-6">
            Price/sqft trends, absorption, DOM, and 3-month forecast — Rigby vs Ririe
          </p>
          <PredictiveChartsBundle />
        </div>
      </div>
    </div>
  );
}
