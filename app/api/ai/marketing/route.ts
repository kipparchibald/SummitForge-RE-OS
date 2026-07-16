import { NextRequest, NextResponse } from 'next/server';
import { marketingAgent } from '@/lib/marketing/agent';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { property } = await request.json();
    const plan = await marketingAgent.generatePlan(property);
    return NextResponse.json(plan);
  } catch (error) {
    return NextResponse.json({ error: 'Marketing agent error' }, { status: 500 });
  }
}
