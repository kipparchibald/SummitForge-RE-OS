// Summit Forge - Property Alerts Types
// Designed for multi-tenant + agent-first experience

// Markets across the seven Eastern Idaho counties SummitForge covers.
// Grouped by county in lib/geo/counties.ts — add new markets there, and add the
// matching string here. 'Idaho Falls Area' is retained as a legacy value from
// pre-expansion alerts; lib/geo/counties.ts normalizes it to 'Idaho Falls'.
export type Location =
  // Jefferson
  | 'Rigby'
  | 'Ririe'
  | 'Roberts'
  | 'Menan'
  | 'Lewisville'
  | 'Hamer'
  | 'Terreton'
  // Madison
  | 'Rexburg'
  | 'Sugar City'
  // Bonneville
  | 'Idaho Falls'
  | 'Ammon'
  | 'Iona'
  | 'Ucon'
  | 'Swan Valley'
  | 'Irwin'
  // Bingham
  | 'Blackfoot'
  | 'Shelley'
  | 'Firth'
  | 'Basalt'
  | 'Aberdeen'
  // Bannock
  | 'Pocatello'
  | 'Chubbuck'
  | 'Inkom'
  | 'McCammon'
  | 'Lava Hot Springs'
  | 'Downey'
  // Fremont
  | 'St. Anthony'
  | 'Ashton'
  | 'Island Park'
  | 'Parker'
  // Teton
  | 'Driggs'
  | 'Victor'
  | 'Tetonia'
  | 'Idaho Falls Area' // legacy — normalized to 'Idaho Falls'
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
