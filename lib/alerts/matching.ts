// Summit Forge - Alert Matching Engine
// Location hard-filter + price/acres/type/new-construction/keywords scoring
// Attaches listingSnapshot + alertName so UI works without joins

import { Alert, Listing, AlertMatch } from '@/types/alerts';

export function calculateMatchScore(alert: Alert, listing: Listing): number {
  // Hard location filter
  if (!alert.locations.includes(listing.location)) {
    return 0;
  }

  let score = 0;
  let maxPossible = 0;

  // Location base (already filtered)
  score += 25;
  maxPossible += 25;

  // Price range (30 points)
  maxPossible += 30;
  if (alert.minPrice !== undefined && alert.maxPrice !== undefined) {
    if (listing.price >= alert.minPrice && listing.price <= alert.maxPrice) {
      score += 30;
    } else if (
      listing.price >= alert.minPrice * 0.9 &&
      listing.price <= alert.maxPrice * 1.1
    ) {
      score += 15;
    }
  } else if (alert.minPrice !== undefined && listing.price >= alert.minPrice) {
    score += 20;
  } else if (alert.maxPrice !== undefined && listing.price <= alert.maxPrice) {
    score += 20;
  }

  // Acres (15 points)
  maxPossible += 15;
  if (listing.acres !== undefined) {
    if (alert.minAcres !== undefined && listing.acres >= alert.minAcres) {
      score += 10;
    }
    if (alert.maxAcres !== undefined && listing.acres <= alert.maxAcres) {
      score += 5;
    } else if (alert.minAcres === undefined) {
      score += 5;
    }
  }

  // Property Type (20 points)
  maxPossible += 20;
  if (alert.propertyTypes.includes(listing.propertyType)) {
    score += 20;
  }

  // New Construction (hard or soft)
  maxPossible += 15;
  if (alert.newConstructionOnly) {
    if (listing.isNewConstruction) {
      score += 15;
    } else {
      return 0;
    }
  } else if (listing.isNewConstruction) {
    score += 8;
  }

  // Keywords (10 points)
  maxPossible += 10;
  if (alert.keywords && alert.keywords.length > 0 && listing.description) {
    const desc = listing.description.toLowerCase();
    const hits = alert.keywords.filter(k => desc.includes(k.toLowerCase())).length;
    if (hits > 0) {
      score += Math.min(10, hits * 4);
    }
  }

  return Math.min(100, Math.round((score / maxPossible) * 100));
}

export function findMatchesForListing(listing: Listing, alerts: Alert[]): AlertMatch[] {
  const matches: AlertMatch[] = [];

  for (const alert of alerts) {
    if (!alert.active) continue;

    const score = calculateMatchScore(alert, listing);

    if (score >= 55) {
      matches.push({
        id: `match_${Date.now()}_${alert.id}_${listing.id}`,
        alertId: alert.id,
        listingId: listing.id,
        matchScore: score,
        matchedAt: new Date().toISOString(),
        notified: false,
        alertName: alert.name,
        listingSnapshot: {
          address: listing.address,
          city: listing.city,
          price: listing.price,
          acres: listing.acres,
          propertyType: listing.propertyType,
          isNewConstruction: listing.isNewConstruction,
          mlsNumber: listing.mlsNumber,
        },
      });
    }
  }

  return matches;
}

export function findMatchesForAlerts(listings: Listing[], alerts: Alert[]): AlertMatch[] {
  const allMatches: AlertMatch[] = [];

  for (const listing of listings) {
    allMatches.push(...findMatchesForListing(listing, alerts));
  }

  return allMatches.sort((a, b) => b.matchScore - a.matchScore);
}
