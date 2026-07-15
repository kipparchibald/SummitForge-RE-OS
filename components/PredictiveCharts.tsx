'use client';

import React, { useMemo } from 'react';

// Predictive analytics charts — Rigby vs Ririe price/sqft, absorption, DOM
// Jefferson County MLS-style trends (Hamer/Terreton excluded from Rigby-Ririe)

export interface TrendPoint {
  period: string;
  rigbyPpsf: number;
  ririePpsf: number;
  combinedPpsf: number;
  absorption: number;
  avgDom: number;
  newConstructionPpsf?: number;
}

const DEFAULT_TRENDS: TrendPoint[] = [
  { period: '2024 Q1', rigbyPpsf: 198, ririePpsf: 185, combinedPpsf: 194, absorption: 58, avgDom: 72, newConstructionPpsf: 225 },
  { period: '2024 Q2', rigbyPpsf: 205, ririePpsf: 190, combinedPpsf: 200, absorption: 62, avgDom: 68, newConstructionPpsf: 232 },
  { period: '2024 Q3', rigbyPpsf: 212, ririePpsf: 196, combinedPpsf: 207, absorption: 65, avgDom: 61, newConstructionPpsf: 238 },
  { period: '2024 Q4', rigbyPpsf: 218, ririePpsf: 201, combinedPpsf: 212, absorption: 59, avgDom: 64, newConstructionPpsf: 245 },
  { period: '2025 Q1', rigbyPpsf: 224, ririePpsf: 208, combinedPpsf: 219, absorption: 63, avgDom: 58, newConstructionPpsf: 252 },
  { period: '2025 Q2', rigbyPpsf: 231, ririePpsf: 214, combinedPpsf: 225, absorption: 67, avgDom: 52, newConstructionPpsf: 258 },
  { period: '2025 Q3', rigbyPpsf: 238, ririePpsf: 220, combinedPpsf: 232, absorption: 71, avgDom: 48, newConstructionPpsf: 265 },
  { period: '2025 Q4', rigbyPpsf: 245, ririePpsf: 226, combinedPpsf: 239, absorption: 69, avgDom: 50, newConstructionPpsf: 272 },
  { period: '2026 Q1', rigbyPpsf: 252, ririePpsf: 232, combinedPpsf: 246, absorption: 74, avgDom: 45, newConstructionPpsf: 278 },
  { period: '2026 Q2', rigbyPpsf: 261, ririePpsf: 240, combinedPpsf: 254, absorption: 78, avgDom: 41, newConstructionPpsf: 285 },
];

function maxVal(points: TrendPoint[], keys: (keyof TrendPoint)[]) {
  let m = 0;
  for (const p of points) {
    for (const k of keys) {
      const v = p[k];
      if (typeof v === 'number' && v > m) m = v;
    }
  }
  return m || 1;
}

export function PricePerSqFtChart({
  data = DEFAULT_TRENDS,
  height = 220,
}: {
  data?: TrendPoint[];
  height?: number;
}) {
  const max = maxVal(data, ['rigbyPpsf', 'ririePpsf', 'combinedPpsf', 'newConstructionPpsf']);
  const w = 100 / Math.max(data.length - 1, 1);

  const path = (key: keyof TrendPoint, color: string) => {
    const pts = data
      .map((d, i) => {
        const v = d[key];
        if (typeof v !== 'number') return null;
        const x = i * w;
        const y = 100 - (v / max) * 90;
        return `${x},${y}`;
      })
      .filter(Boolean)
      .join(' ');
    return (
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={pts}
        vectorEffect="non-scaling-stroke"
      />
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Price per sq ft trends</h3>
          <p className="text-xs text-gray-500">Rigby · Ririe · Combined · New construction</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px]">
          <Legend color="#10b981" label="Rigby" />
          <Legend color="#3b82f6" label="Ririe" />
          <Legend color="#6b7280" label="Combined" />
          <Legend color="#f59e0b" label="New const." />
        </div>
      </div>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ height, width: '100%' }}>
        {[0, 25, 50, 75, 100].map((y) => (
          <line key={y} x1="0" y1={y} x2="100" y2={y} stroke="#f3f4f6" strokeWidth="0.5" />
        ))}
        {path('combinedPpsf', '#6b7280')}
        {path('ririePpsf', '#3b82f6')}
        {path('rigbyPpsf', '#10b981')}
        {path('newConstructionPpsf', '#f59e0b')}
      </svg>
      <div className="flex justify-between text-[10px] text-gray-400 mt-2">
        <span>{data[0]?.period}</span>
        <span>{data[data.length - 1]?.period}</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-4 text-sm">
        <Metric label="Rigby latest" value={`$${data[data.length - 1]?.rigbyPpsf}/sqft`} />
        <Metric label="Ririe latest" value={`$${data[data.length - 1]?.ririePpsf}/sqft`} />
        <Metric label="New const." value={`$${data[data.length - 1]?.newConstructionPpsf}/sqft`} />
        <Metric
          label="YoY Rigby"
          value={`+${Math.round(
            ((data[data.length - 1].rigbyPpsf - data[Math.max(0, data.length - 5)].rigbyPpsf) /
              data[Math.max(0, data.length - 5)].rigbyPpsf) *
              100
          )}%`}
        />
      </div>
    </div>
  );
}

export function AbsorptionDomChart({
  data = DEFAULT_TRENDS,
  height = 180,
}: {
  data?: TrendPoint[];
  height?: number;
}) {
  const maxAbs = Math.max(...data.map((d) => d.absorption), 100);
  const maxDom = Math.max(...data.map((d) => d.avgDom), 1);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Market health</h3>
          <p className="text-xs text-gray-500">Absorption rate % · Avg days on market</p>
        </div>
        <div className="flex gap-3 text-[11px]">
          <Legend color="#10b981" label="Absorption %" />
          <Legend color="#f97316" label="Avg DOM" />
        </div>
      </div>
      <div className="flex items-end gap-1" style={{ height }}>
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
            <div className="w-full flex gap-0.5 items-end h-full">
              <div
                className="flex-1 bg-emerald-400 rounded-t-sm min-h-[4px]"
                style={{ height: `${(d.absorption / maxAbs) * 100}%` }}
                title={`Absorption ${d.absorption}%`}
              />
              <div
                className="flex-1 bg-orange-400 rounded-t-sm min-h-[4px]"
                style={{ height: `${(d.avgDom / maxDom) * 100}%` }}
                title={`DOM ${d.avgDom}`}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-gray-400 mt-2">
        <span>{data[0]?.period}</span>
        <span>{data[data.length - 1]?.period}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 mt-4 text-sm">
        <Metric label="Absorption (latest)" value={`${data[data.length - 1]?.absorption}%`} />
        <Metric label="Avg DOM (latest)" value={`${data[data.length - 1]?.avgDom} days`} />
      </div>
    </div>
  );
}

export function ForecastPanel({ data = DEFAULT_TRENDS }: { data?: TrendPoint[] }) {
  const forecast = useMemo(() => {
    if (data.length < 3) return [];
    const last = data[data.length - 1];
    const prev = data[data.length - 3];
    const priceSlope = (last.combinedPpsf - prev.combinedPpsf) / 2;
    return [1, 2, 3].map((m) => ({
      period: `+${m} mo`,
      ppsf: Math.round(last.combinedPpsf + priceSlope * m),
      dom: Math.max(25, Math.round(last.avgDom - 2 * m)),
      absorption: Math.min(95, last.absorption + m),
      confidence: Math.max(55, 88 - m * 10),
    }));
  }, [data]);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm">
      <h3 className="font-semibold text-gray-900 mb-1">3-month forecast</h3>
      <p className="text-xs text-gray-500 mb-4">
        Linear projection from recent Jefferson County trends (excludes Hamer/Terreton)
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-400 border-b">
              <th className="pb-2 font-medium">Period</th>
              <th className="pb-2 font-medium">$/sqft</th>
              <th className="pb-2 font-medium">DOM</th>
              <th className="pb-2 font-medium">Absorption</th>
              <th className="pb-2 font-medium">Confidence</th>
            </tr>
          </thead>
          <tbody>
            {forecast.map((f) => (
              <tr key={f.period} className="border-b border-gray-50">
                <td className="py-2 font-medium">{f.period}</td>
                <td className="py-2">${f.ppsf}</td>
                <td className="py-2">{f.dom}d</td>
                <td className="py-2">{f.absorption}%</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${
                      f.confidence >= 75
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {f.confidence}%
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-gray-600">
      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-xl px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-semibold text-gray-900">{value}</div>
    </div>
  );
}

export default function PredictiveChartsBundle() {
  return (
    <div className="space-y-6">
      <PricePerSqFtChart />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AbsorptionDomChart />
        <ForecastPanel />
      </div>
    </div>
  );
}
