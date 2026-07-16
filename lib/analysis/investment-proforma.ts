// Expanded investment pro formas for raw land and other types

import { analyzeListing, type LandAnalysis } from '../development/land-engine';

export interface ProFormaResult {
  lotYield: number;
  estInfraCost: number;
  totalCost: number;
  projectedRevenue: number;
  projectedIRR: number;
  cashOnCash?: number;
  scenarios: {
    base: any;
    optimistic: any;
    conservative: any;
  };
}

export function calculateRawLandProForma(listing: any, assumptions: any = {}) {
  const acres = listing.acres || 0;
  const price = listing.price || 0;
  
  // Jefferson County / Teton Heights style assumptions
  const minLotSize = assumptions.minLotSize || 0.6; // acres
  const lotYield = Math.floor(acres / minLotSize);
  const avgLotPrice = assumptions.avgLotPrice || 99500;
  const infraCostPerLot = assumptions.infraCostPerLot || 20000; // road + utilities rough
  const softCosts = assumptions.softCosts || 50000;
  
  const estInfraCost = lotYield * infraCostPerLot;
  const totalCost = price + estInfraCost + softCosts;
  const projectedRevenue = lotYield * avgLotPrice;
  
  const netProfit = projectedRevenue - totalCost;
  const projectedIRR = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  
  // Simple cash-on-cash (assuming some financing)
  const downPayment = totalCost * 0.25;
  const cashOnCash = downPayment > 0 ? (netProfit / downPayment) * 100 : 0;

  const base = { lotYield, estInfraCost, totalCost, projectedRevenue, projectedIRR, cashOnCash };
  
  // Scenarios
  const optimistic = {
    ...base,
    lotYield: Math.floor(lotYield * 1.1),
    avgLotPrice: avgLotPrice * 1.15,
    projectedIRR: projectedIRR * 1.3
  };
  
  const conservative = {
    ...base,
    lotYield: Math.floor(lotYield * 0.85),
    avgLotPrice: avgLotPrice * 0.85,
    projectedIRR: projectedIRR * 0.7
  };

  return {
    lotYield,
    estInfraCost,
    totalCost,
    projectedRevenue,
    projectedIRR,
    cashOnCash,
    scenarios: { base, optimistic, conservative }
  };
}

// Placeholder for future multi-family / commercial
export function calculateInvestmentProForma(property: any, type: 'multifamily' | 'commercial' = 'multifamily') {
  // Expand later with NOI, cap rate, etc.
  return {
    message: `${type} pro forma coming soon`,
    estimatedCapRate: 6.5
  };
}

/**
 * Accurate raw-land feasibility with a maximum-offer price and Offer/Pass verdict.
 * Uses the calibrated land-engine (county-aware presets, ISPWC costs, financing carry,
 * absorption, target margin). Returns null if the listing lacks acres or price.
 *
 * This is the recommended entry point for buy/pass decisions; calculateRawLandProForma
 * remains for the simpler legacy IRR view.
 */
export function calculateLandFeasibility(
  listing: any,
  assumptions: { lotPrice?: number; county?: string } = {}
): LandAnalysis | null {
  return analyzeListing(
    { acres: listing?.acres, price: listing?.price ?? listing?.listPrice, address: listing?.address, rawData: listing?.rawData },
    assumptions
  );
}