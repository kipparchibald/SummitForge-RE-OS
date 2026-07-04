'use client';

import React from 'react';

interface PriceTrendChartProps {
  data: { month: string; price: number }[];
  title?: string;
}

export default function PriceTrendChart({ data, title = "Price per Sq Ft Trend" }: PriceTrendChartProps) {
  const maxPrice = Math.max(...data.map(d => d.price));
  const minPrice = Math.min(...data.map(d => d.price));

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6">
      <div className="font-semibold mb-4">{title}</div>
      
      <div className="flex items-end gap-2 h-48">
        {data.map((item, index) => {
          const height = ((item.price - minPrice) / (maxPrice - minPrice)) * 100 + 10;
          return (
            <div key={index} className="flex-1 flex flex-col items-center">
              <div 
                className="w-full bg-emerald-500 rounded-t transition-all hover:bg-emerald-600"
                style={{ height: `${height}%` }}
                title={`${item.month}: $${item.price}`}
              />
              <div className="text-[10px] text-gray-500 mt-2">{item.month}</div>
            </div>
          );
        })}
      </div>
      
      <div className="text-xs text-gray-400 mt-3 text-center">
        New Construction • Rigby & Ririe Combined
      </div>
    </div>
  );
}
