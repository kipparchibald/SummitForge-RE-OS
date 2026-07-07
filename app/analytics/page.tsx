'use client';

import React, { useState } from 'react';
import PriceTrendChart from '@/components/PriceTrendChart';

export default function AnalyticsDashboard() {
  const [lastImport, setLastImport] = useState('2026-06-15');
  const [recordCount, setRecordCount] = useState(12487);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'combined' | 'rigby' | 'ririe'>('combined');

  const handleImport = () => {
    setIsImporting(true);
    setImportSuccess(false);

    setTimeout(() => {
      const newDate = new Date().toISOString().split('T')[0];
      setLastImport(newDate);
      setRecordCount(prev => prev + 187);
      setIsImporting(false);
      setImportSuccess(true);

      setTimeout(() => setImportSuccess(false), 3000);
    }, 1400);
  };

  // New Construction data (mock for now, will be dynamic later)
  const ncData = {
    combined: { price: 312, change: 7.4, insight: "Strong momentum — good window for new spec listings in Rigby & Ririe." },
    rigby:    { price: 328, change: 8.9, insight: "Rigby new construction showing strong pricing power. Consider accelerating spec builds." },
    ririe:    { price: 295, change: 5.2, insight: "Ririe pricing rising steadily at a healthy but more moderate pace than Rigby." }
  };

  const currentNC = ncData[activeTab];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        
        {/* Header */}
        <div className="flex justify-between items-end mb-8">
          <div>
            <h1 className="text-4xl font-semibold tracking-tight">Analytics</h1>
            <p className="text-gray-600 mt-1">Jefferson County • Powered by Navica MLS data</p>
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

        {/* Data Freshness */}
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
              <div className="text-sm text-gray-500 mt-0.5">18 months of history</div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* Land Development Potential */}
          <div className="lg:col-span-5 bg-white border border-gray-200 rounded-3xl p-7 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-semibold text-xl">Land Development Potential</div>
                <div className="text-sm text-gray-500">Price per acre trends</div>
              </div>
              <div className="text-xs px-3 py-1 bg-amber-100 text-amber-700 rounded-full font-medium">Development</div>
            </div>

            <div className="space-y-4 text-sm">
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Hamer</span>
                <span className="font-semibold">$18,400 <span className="text-emerald-600 text-xs">↑ 4.2%</span></span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Terreton / Mud Lake</span>
                <span className="font-semibold">$14,200 <span className="text-gray-400 text-xs">→</span></span>
              </div>
              <div className="flex justify-between items-center py-2 border-b">
                <span className="text-gray-600">Roberts</span>
                <span className="font-semibold">$21,600 <span className="text-emerald-600 text-xs">↑ 6.1%</span></span>
              </div>
            </div>

            <button className="mt-6 w-full border border-gray-300 hover:bg-gray-50 py-3 rounded-2xl text-sm font-medium transition">
              View Full Land Analysis &amp; Forecasting
            </button>
          </div>

          {/* New Construction - Rigby & Ririe (Main Focus) */}
          <div className="lg:col-span-7 bg-white border border-gray-200 rounded-3xl p-7 shadow-sm">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-semibold text-xl">New Construction Pricing</div>
                <div className="text-sm text-gray-500">Rigby &amp; Ririe focus • Year-over-year trends</div>
              </div>
              <div className="text-xs px-3 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">Spec Homes</div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-5 bg-gray-100 p-1 rounded-2xl w-fit">
              <button 
                onClick={() => setActiveTab('combined')}
                className={`px-5 py-1.5 text-sm font-medium rounded-xl transition ${activeTab === 'combined' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                Combined
              </button>
              <button 
                onClick={() => setActiveTab('rigby')}
                className={`px-5 py-1.5 text-sm font-medium rounded-xl transition ${activeTab === 'rigby' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                Rigby
              </button>
              <button 
                onClick={() => setActiveTab('ririe')}
                className={`px-5 py-1.5 text-sm font-medium rounded-xl transition ${activeTab === 'ririe' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'}`}
              >
                Ririe
              </button>
            </div>

            {/* Main Metric */}
            <div className="flex items-baseline gap-3 mb-1">
              <div className="text-5xl font-semibold tracking-tighter">${currentNC.price}</div>
              <div className="text-2xl text-gray-400">/ sq ft</div>
              <div className={`text-lg font-medium ${currentNC.change > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {currentNC.change > 0 ? '+' : ''}{currentNC.change}% YoY
              </div>
            </div>

            <div className="text-sm text-gray-600 mb-5">
              Same period last year: <span className="font-medium">${Math.round(currentNC.price / (1 + currentNC.change/100))}</span>
            </div>

            {/* Interactive Trend Chart */}
            <div className="mb-6">
              <PriceTrendChart 
                data={[
                  { month: 'Jul', price: 278 },
                  { month: 'Sep', price: 285 },
                  { month: 'Nov', price: 291 },
                  { month: 'Jan', price: 299 },
                  { month: 'Mar', price: 305 },
                  { month: 'May', price: 312 },
                ]} 
                title="New Construction $/sq ft (Rigby + Ririe)"
              />
            </div>

            {/* Insight */}
            <div className="bg-gray-50 border border-gray-100 rounded-2xl p-4 text-sm leading-relaxed mb-4">
              {currentNC.insight}
            </div>

            <div className="flex items-center justify-between text-xs">
              <div className="text-gray-500">Data from Navica • Updated {lastImport}</div>
              <button className="text-blue-600 hover:text-blue-700 font-medium">View 3-month forecast →</button>
            </div>
          </div>

          {/* Quick Market Health */}
          <div className="lg:col-span-12 bg-white border border-gray-200 rounded-3xl p-7 shadow-sm">
            <div className="font-semibold text-xl mb-5">Market Health Snapshot</div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-gray-500">Avg Days on Market</div>
                <div className="text-4xl font-semibold mt-2">42 <span className="text-base font-normal text-gray-400">days</span></div>
                <div className="text-xs text-emerald-600 mt-1">↓ 8 days from last month</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Absorption Rate</div>
                <div className="text-4xl font-semibold mt-2">68%</div>
                <div className="text-xs text-emerald-600 mt-1">↑ Healthy pace</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Active Listings</div>
                <div className="text-4xl font-semibold mt-2">187</div>
                <div className="text-xs text-gray-500 mt-1">Jefferson County</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">New Construction Share</div>
                <div className="text-4xl font-semibold mt-2">19%</div>
                <div className="text-xs text-emerald-600 mt-1">↑ Rising interest</div>
              </div>
            </div>
          </div>

        </div>

        <div className="mt-8 text-center text-xs text-gray-400">
          All data sourced from your Navica exports • Analytics update automatically on import
        </div>

      </div>
    </div>
  );
}
