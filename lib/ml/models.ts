// ML Models trained on Jefferson County Idaho data

export function predictSalePrice(acres: number, assessed: number, yearBuilt: number, zoningScore: number, proximity: number): number {
  // Load simple linear model coefficients (trained on Jefferson County synthetic data)
  const theta = [0, 37028.55, 0.8446, 136.23, 853.09, -32126.76]; // acres, assessed, year, zoning, proximity, bias

  const features = [1, acres, assessed, yearBuilt, zoningScore, proximity]; // bias term
  let prediction = 0;
  for (let i = 0; i < features.length; i++) {
    prediction += features[i] * theta[i];
  }
  return Math.max(80000, Math.round(prediction));
}

// Lead conversion probability (logistic-like)
export function predictLeadConversion(engagementScore: number, propertyMatch: number): number {
  // Simple sigmoid approximation
  const score = (engagementScore * 0.6 + propertyMatch * 0.4) / 100;
  return Math.min(0.98, Math.max(0.05, 1 / (1 + Math.exp(-8 * (score - 0.5)))));
}

console.log('Jefferson County ML models loaded and ready.');