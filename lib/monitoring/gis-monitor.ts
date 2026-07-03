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
  // Optimized PostGIS spatial queries for performance (Jefferson County parcel data can be large)

  let query = supabase
    .from('properties')
    .select('*, geometry')
    .eq('property_type', 'land')
    .gte('updated_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()); // Recent changes

  if (watchedAreaId) {
    const area = await getWatchedArea(watchedAreaId);
    if (area?.geometry) {
      // Optimized spatial query: Use ST_Intersects or ST_Within with bounding box filter first for speed
      // GIST index on geometry recommended (already in schema)
      query = query
        .filter('geometry', 'st_intersects', area.geometry) // Efficient intersection
        .filter('geometry', 'st_within', area.geometry); // Or strict within
    }
  }

  const { data: recentProperties, error } = await query.limit(500); // Limit for performance; paginate if needed

  if (error) throw error;

  const newOpportunities = recentProperties?.filter(p => {
    // Additional post-query filters (acres, price, zoning)
    return (p.acres || 0) > (area?.filters?.minAcres || 0);
  }) || [];

  for (const prop of newOpportunities) {
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