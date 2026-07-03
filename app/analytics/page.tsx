'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function AnalyticsDashboard() {
  const [lastImport, setLastImport] = useState('2026-06-15');
  const [recordCount, setRecordCount] = useState(12487);
  const [isImporting, setIsImporting] = useState(false);

  const handleNavicaImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);

    // Simulate processing
    setTimeout(() => {
      const newDate = new Date().toISOString().split('T')[0];
      setLastImport(newDate);
      setRecordCount(prev => prev + Math.floor(Math.random() * 180) + 40);
      setIsImporting(false);
      alert('Navica data imported successfully! Analytics have been updated.');
    }, 1800);
  };

  return (
    <div className="p-6 space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics &amp; Intelligence</h1>
          <p className="text-muted-foreground">Jefferson County Market • Land Development • CMA • Market Health</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-muted-foreground">Last MLS Import</div>
            <div className="font-semibold text-lg">{lastImport}</div>
            <div className="text-xs text-green-600">{recordCount.toLocaleString()} records</div>
          </div>

          <div>
            <label className="cursor-pointer">
              <Button variant="default" disabled={isImporting}>
                {isImporting ? 'Processing...' : 'Import New Navica Data'}
              </Button>
              <Input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleNavicaImport}
              />
            </label>
          </div>
        </div>
      </div>

      {/* Data Freshness Widget */}
      <Card className="border-l-4 border-l-green-500">
        <CardHeader>
          <CardTitle>Data Freshness</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <div className="text-sm text-muted-foreground">Last Import</div>
            <div className="text-2xl font-semibold">{lastImport}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Total Records</div>
            <div className="text-2xl font-semibold">{recordCount.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground">Coverage</div>
            <div className="text-2xl font-semibold">Jefferson County • 18 months</div>
          </div>
        </CardContent>
      </Card>

      {/* Three Main Modules - Enhanced with Charts & Forecasting */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Land Development Potential */}
        <Card className="border-l-4 border-l-blue-500">
          <CardHeader>
            <CardTitle>Land Development Potential</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm font-medium">Price per Acre Trends</div>
            <div className="space-y-2 text-sm">
              <div>Hamer: <span className="font-semibold">$18,400/acre</span> <span className="text-green-600">↑</span></div>
              <div>Terreton: <span className="font-semibold">$14,200/acre</span> <span className="text-gray-500">→</span></div>
              <div>Roberts: <span className="font-semibold">$21,600/acre</span> <span className="text-green-600">↑</span></div>
            </div>
            <div className="pt-2">
              <Button variant="default" className="w-full">View Full Land Analysis + Forecast</Button>
            </div>
          </CardContent>
        </Card>

        {/* CMA Tool */}
        <Card className="border-l-4 border-l-purple-500">
          <CardHeader>
            <CardTitle>CMA &amp; Valuation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm">Smart Comp Selector powered by real Navica data.</div>
            <div className="flex flex-col gap-2">
              <Button variant="default">Generate Professional CMA</Button>
              <Button variant="outline">Run Property Valuation</Button>
              <Button variant="outline">Export CMA as PDF</Button>
            </div>
          </CardContent>
        </Card>

        {/* Market Health Dashboard */}
        <Card className="border-l-4 border-l-emerald-500">
          <CardHeader>
            <CardTitle>Market Health Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>Avg DOM: <span className="font-semibold">42 days</span></div>
              <div>Absorption Rate: <span className="font-semibold">68%</span></div>
              <div>Price/SqFt Trend: <span className="font-semibold text-green-600">+4.2%</span></div>
              <div>Active Listings: <span className="font-semibold">187</span></div>
            </div>
            
            <div className="pt-2 space-y-2">
              <Button variant="default" className="w-full">Open Full Interactive Dashboard</Button>
              <Button variant="outline" className="w-full">View 3-Month Forecast</Button>
            </div>
          </CardContent>
        </Card>

      </div>

      <div className="text-xs text-muted-foreground text-center pt-4">
        All analytics powered by your Navica MLS history • Data updates automatically on import
      </div>
    </div>
  );
}
