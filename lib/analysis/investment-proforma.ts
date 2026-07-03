// Basic investment pro formas (expand for full scenarios)
export function calculateRawLandProForma(listing: any, assumptions = {}) {
  const acres = listing.acres || 0;
  const lotYield = Math.floor(acres / 0.6); // Example Jefferson County R-1 style
  const roadCostEst = lotYield * 200; // Per lot rough estimate
  const totalCost = listing.price + roadCostEst + 50000; // Example soft costs
  const projectedRevenue = lotYield * 99500; // Teton Heights style lot price
  const irr = ((projectedRevenue - totalCost) / totalCost) * 100; // Simplified

  return {
    lotYield,
    estInfraCost: roadCostEst,
    projectedIRR: irr,
    scenarios: ['base', 'optimistic', 'conservative']
  };
}

// Add multi-family/commercial later