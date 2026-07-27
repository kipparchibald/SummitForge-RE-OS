import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseLive } from '@/lib/supabase/client';

export const dynamic = 'force-dynamic';

/**
 * POST /api/realtime/publish
 * Body: { channel, type, payload }
 *
 * Broadcasts via Supabase Realtime when live so all connected clients receive
 * the event over WebSocket. Used by import/cron/rematch routes.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const channel = body.channel as string;
    const type = body.type || 'NOTIFY';
    const payload = body.payload ?? {};

    if (!channel) {
      return NextResponse.json({ error: 'channel required' }, { status: 400 });
    }

    if (!isSupabaseLive()) {
      return NextResponse.json({
        success: true,
        simulated: true,
        message: 'Supabase not live — clients rely on local bus / SSE hello only',
        channel,
        type,
      });
    }

    const client = getSupabase();
    const ch = client.channel('sf-broadcast');
    await ch.subscribe();
    await ch.send({
      type: 'broadcast',
      event: 'sf',
      payload: {
        channel,
        type,
        payload,
        at: new Date().toISOString(),
      },
    });
    try {
      await client.removeChannel(ch);
    } catch {
      /* */
    }

    return NextResponse.json({ success: true, simulated: false, channel, type });
  } catch (e: any) {
    console.error('[realtime/publish]', e);
    return NextResponse.json({ error: e?.message || 'publish failed' }, { status: 500 });
  }
}
