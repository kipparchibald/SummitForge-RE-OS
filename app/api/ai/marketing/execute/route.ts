import { NextRequest, NextResponse } from 'next/server';
import { marketingAgent } from '@/lib/marketing/agent';

export async function POST(request: NextRequest) {
  try {
    const { plan } = await request.json();
    const result = await marketingAgent.executePlan(plan, ['generate_content', 'schedule_campaign']);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: 'Execution failed' }, { status: 500 });
  }
}
