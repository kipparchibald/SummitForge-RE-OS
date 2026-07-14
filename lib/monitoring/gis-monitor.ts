import { supabase } from '../supabase/client';

export interface WatchedArea {
  id: string;
  name: string;
  geometry: any;
  filters: {
    minAcres?: number;
    maxPricePerAcre?: number;
    zoning?: string[];
  };
  lastChecked: string;
  userId: string;
}

export async function addWatchedArea(area: Omit<WatchedArea, 'id' | 'lastChecked'>) {
  const { data, error } = await supabase
    .from('watched_areas')
    .insert({
      ...area,
      lastChecked: new Date().toISOString()
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function checkForNewOpportunities(watchedAreaId?: string) {
  // Enhanced GIS monitoring with better PostGIS optimization and plat triggers

  let query = supabase
    .from('properties')
    .select('*, geometry')
    .eq('property_type', 'land')
    .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  let area = null;
  if (watchedAreaId) {
    area = await getWatchedArea(watchedAreaId);
    if (area?.geometry) {
      // Enhanced: Use ST_DWithin for proximity + intersects for efficiency
      query = query
        .filter('geometry', 'st_dwithin', [area.geometry, 1000])
        .filter('geometry', 'st_intersects', area.geometry);
    }
  }

  const { data: recentProperties, error } = await query.limit(500);

  if (error) throw error;

  const filters = area?.filters;
  const newOpportunities = recentProperties?.filter((p: any) => {
    const acres = p.acres || 0;
    // Apply every declared filter, not just minAcres. Use >= so a parcel exactly
    // at the threshold qualifies.
    if (filters?.minAcres != null && acres < filters.minAcres) return false;
    if (filters?.maxPricePerAcre != null && acres > 0 && p.price != null) {
      if (p.price / acres > filters.maxPricePerAcre) return false;
    }
    if (filters?.zoning && filters.zoning.length > 0) {
      if (!p.zoning || !filters.zoning.includes(p.zoning)) return false;
    }
    return true;
  }) || [];

  for (const prop of newOpportunities) {
    await triggerRawLandProjectionFromGIS(prop);
    // Enhanced: Auto-trigger plat creation for high-potential land
    if ((prop.acres || 0) > 3) {
      await triggerPlatCreation(prop);
    }
  }

  return { checked: recentProperties?.length || 0, newOpportunities: newOpportunities.length };
}

async function getWatchedArea(id: string) {
  const { data } = await supabase.from('watched_areas').select('*').eq('id', id).single();
  return data;
}

async function triggerRawLandProjectionFromGIS(property: any) {
  console.log(`GIS-based raw land projection triggered for property in watched area: ${property.address}`);
}

async function triggerPlatCreation(property: any) {
  console.log(`[Enhanced] Auto-triggering preliminary plat for large parcel: ${property.address}`);
}