import { NextRequest, NextResponse } from 'next/server';
import { council } from '@/lib/ai/council';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { request: userRequest, profile, context } = await request.json();

    if (typeof userRequest !== 'string' || !userRequest.trim()) {
      return NextResponse.json(
        { error: 'Missing "request" field — send { request: "your question" }' },
        { status: 400 }
      );
    }

    if (profile) {
      council.setUserProfile(profile);
    }

    const result = await council.handleRequest(userRequest, context || {});
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Council error:', error);
    return NextResponse.json({ 
      error: 'Council temporarily unavailable',
      fallback: "I'm here to help with your real estate goals in Jefferson County. What would you like to focus on?"
    }, { status: 500 });
  }
}
