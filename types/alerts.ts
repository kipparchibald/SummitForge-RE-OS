// Summit Forge - Property Alerts Types
// Designed for multi-tenant + agent-first experience

export type Location =
  | 'Rigby'
  | 'Ririe'
  | 'Roberts'
  | 'Hamer'
  | 'Terreton'
  | 'Idaho Falls Area'
  | 'Other';

export type PropertyType =
  | 'Single Family'
  | 'New Construction'
  | 'Land'
  | 'Farm/Ranch'
  | 'Multi-Family'
  | 'Commercial';

export interface Alert {
  id: string;
  userId: string;
  brokerageId: string; // multi-tenant
  name: string;

  // Criteria
  locations: Location[];
  minPrice?: number;
  maxPrice?: number;
  minAcres?: number;
  maxAcres?: number;
  propertyTypes: PropertyType[];
  newConstructionOnly: boolean;
  keywords?: string[];

  // Notification Preferences (SMS-first)
  notifyBy: ('email' | 'sms' | 'in-app')[];
  frequency: 'instant' | 'daily' | 'weekly';
  phone?: string; // primary contact for SMS
  email?: string; // progressive capture

  active: boolean;
  createdAt: string;
  lastMatchedAt?: string;
}

export interface Listing {
  id: string;
  mlsNumber: string;
  address: string;
  city: string;
  location: Location;
  price: number;
  acres?: number;
  sqFt?: number;
  yearBuilt?: number;
  propertyType: PropertyType;
  isNewConstruction: boolean;
  description?: string;
  url?: string;
  importedAt: string;
}

/** Lightweight snapshot so UI can show address/price without a full join */
export interface ListingSnapshot {
  address: string;
  city?: string;
  price: number;
  acres?: number;
  propertyType?: PropertyType;
  isNewConstruction?: boolean;
  mlsNumber?: string;
}

export interface AlertMatch {
  id: string;
  alertId: string;
  listingId: string;
  matchScore: number; // 0-100
  matchedAt: string;
  notified: boolean;
  notificationMethod?: 'email' | 'sms' | 'in-app';
  // Enriched for display (optional for backward compat)
  alertName?: string;
  listingSnapshot?: ListingSnapshot;
}

// For future AI preference learning
export interface UserBehavior {
  userId: string;
  viewedListingIds: string[];
  savedListingIds: string[];
  inquiredListingIds: string[];
  lastUpdated: string;
}
