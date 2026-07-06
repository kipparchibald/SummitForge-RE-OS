// Summit Forge - Alert Matching Engine
// Basic version - will be enhanced with AI scoring later

import { Alert, Listing, AlertMatch } from '@/types/alerts';

export function calculateMatchScore(alert: Alert, listing: Listing): number {
  let score = 0;
  let factors = 0;

  // Location match (very important)
  if (alert.locations.includes(listing.location)) {
    score += 30;
  } else {
    return 0; // Hard fail if location doesn't match
  }
  factors++;

  // Price range
  if (alert.minPrice && listing.price >= alert.minPrice) score += 15;
  if (alert.maxPrice && listing.price <= alert.maxPrice) score += 15;
  factors += 2;

  // Acres
  if (alert.minAcres && listing.acres && listing.acres >= alert.minAcres) score += 10;
  if (alert.maxAcres && listing.acres && listing.acres <= alert.maxAcres) score += 5;
  factors += 2;

  // Property Type
  if (alert.propertyTypes.includes(listing.propertyType)) {
    score += 15;
  }
  factors++;

  // New Construction preference
  if (alert.newConstructionOnly) {
    if (listing.isNewConstruction) {
      score += 25;
    } else {
      return 0; // Hard fail
    }
  } else {
    if (listing.isNewConstruction) score += 5; // Slight bonus
  }
  factors++;

  // Normalize score to 0-100
  const normalizedScore = Math.min(100, Math.round((score / (factors * 15)) * 100));
  
  return normalizedScore;
}

export function findMatchesForListing(listing: Listing, alerts: Alert[]): AlertMatch[] {
  const matches: AlertMatch[] = [];

  for (const alert of alerts) {
    if (!alert.active) continue;

    const score = calculateMatchScore(alert, listing);
    
    if (score >= 60) { // Only consider strong matches
      matches.push({
        id: `match_${Date.now()}_${alert.id}`,
        alertId: alert.id,
        listingId: listing.id,
        matchScore: score,
        matchedAt: new Date().toISOString(),
        notified: false,
      });
    }
  }

  return matches;
}

export function findMatchesForAlerts(listings: Listing[], alerts: Alert[]): AlertMatch[] {
  const allMatches: AlertMatch[] = [];

  for (const listing of listings) {
    const matches = findMatchesForListing(listing, alerts);
    allMatches.push(...matches);
  }

  return allMatches.sort((a, b) => b.matchScore - a.matchScore);
}