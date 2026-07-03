import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase/client';
import { checkForNewOpportunities } from '@/lib/monitoring/gis-monitor';

export async function POST(request: NextRequest) {
  try {
    const { watchedAreaId } = await request.json();
    
    const result = await checkForNewOpportunities(watchedAreaId);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Monitoring check error:', error);
    return NextResponse.json({ error: 'Failed to check opportunities' }, { status: 500 });
  }
}