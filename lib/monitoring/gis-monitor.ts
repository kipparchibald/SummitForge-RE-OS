import { supabase } from '../supabase/client'; // Assume Supabase client

export interface WatchedArea {
  id: string;
  name: string;
  geometry: any; // GeoJSON polygon for the watched area (e.g., Jefferson County zones near Teton Heights)
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
  // Use existing GIS data (PostGIS queries on properties/parcels table + county layers)
  // No new drone data — leverage enriched GIS Hub data, ATTOM/Parceled, local Jefferson County shapefiles

  let query = supabase
    .from('properties')
    .select('*')
    .eq('property_type', 'land') // or filter via GIS
    .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Recent changes

  if (watchedAreaId) {
    // Spatial query: properties within watched geometry
    // Example PostGIS: ST_Within(geometry, watched_geometry)
    const area = await getWatchedArea(watchedAreaId);
    if (area?.geometry) {
      query = query.filter('geometry', 'st_within', area.geometry); // Simplified; use proper PostGIS in real query
    }
  }

  const { data: recentProperties, error } = await query;

  if (error) throw error;

  const newOpportunities = recentProperties?.filter(p => {
    // Apply filters from watched area
    return true; // Add real filtering logic
  }) || [];

  for (const prop of newOpportunities) {
    // Trigger raw land projection using existing GIS data (zoning from county layers, etc.)
    await triggerRawLandProjectionFromGIS(prop);
  }

  return { checked: recentProperties?.length || 0, newOpportunities: newOpportunities.length };
}

async function getWatchedArea(id: string) {
  const { data } = await supabase.from('watched_areas').select('*').eq('id', id).single();
  return data;
}

async function triggerRawLandProjectionFromGIS(property: any) {
  console.log(`GIS-based raw land projection triggered for property in watched area: ${property.address}`);
  // Use GIS Hub data: zoning, nearby comps, DEM if available from county, etc.
  // Call your raw land module with enriched GIS context (no new drone)
}