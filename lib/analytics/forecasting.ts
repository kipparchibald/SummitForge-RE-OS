// Predictive Forecasting Module for SummitForge

import { MarketTrendPoint } from './market-health';

export interface ForecastPoint {
  period: string;
  predictedPricePerSqFt: number;
  predictedDOM: number;
  predictedAbsorption: number;
  confidence: number; // 0-100
}

export function generateForecast(trends: MarketTrendPoint[], monthsAhead: number = 3): ForecastPoint[] {
  if (trends.length < 3) {
    return []; // Not enough data for meaningful forecast
  }

  const forecasts: ForecastPoint[] = [];
  const last = trends[trends.length - 1];

  // Simple linear trend projection (can be upgraded to better models later)
  const priceSlope = (last.avgPricePerSqFt - trends[0].avgPricePerSqFt) / trends.length;
  const domSlope = (last.avgDOM - trends[0].avgDOM) / trends.length;

  for (let i = 1; i <= monthsAhead; i++) {
    const futurePrice = Math.round(last.avgPricePerSqFt + priceSlope * i);
    const futureDOM = Math.max(20, Math.round(last.avgDOM + domSlope * i));
    const futureAbsorption = Math.min(95, Math.max(45, last.absorptionRate + (i % 2 === 0 ? 2 : -1)));

    forecasts.push({
      period: `+${i} month${i > 1 ? 's' : ''}`,
      predictedPricePerSqFt: futurePrice,
      predictedDOM: futureDOM,
      predictedAbsorption: futureAbsorption,
      confidence: Math.max(55, 85 - i * 8) // Confidence decreases over time
    });
  }

  return forecasts;
}