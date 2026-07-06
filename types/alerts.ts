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
  brokerageId: string;           // For multi-tenant support
  name: string;                  // e.g. "Rigby New Construction"
  
  // Criteria
  locations: Location[];
  minPrice?: number;
  maxPrice?: number;
  minAcres?: number;
  maxAcres?: number;
  propertyTypes: PropertyType[];
  newConstructionOnly: boolean;
  keywords?: string[];           // e.g. ["basement", "shop", "water rights"]

  // Notification Preferences
  notifyBy: ('email' | 'sms' | 'in-app')[];
  frequency: 'instant' | 'daily' | 'weekly';

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
  importedAt: string;
}

export interface AlertMatch {
  id: string;
  alertId: string;
  listingId: string;
  matchScore: number;           // 0-100
  matchedAt: string;
  notified: boolean;
  notificationMethod?: 'email' | 'sms' | 'in-app';
}

// For future AI learning
export interface UserBehavior {
  userId: string;
  viewedListingIds: string[];
  savedListingIds: string[];
  inquiredListingIds: string[];
  lastUpdated: string;
}