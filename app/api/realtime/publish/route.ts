import { NextRequest, NextResponse } from 'next/server';
import { getSupabase, isSupabaseLive } from '@/lib/supabase/client';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import {
  assertChannelName,
  clampString,
  guardErrorResponse,
  readJsonBody,
  RequestGuardError,
} from '@/lib/security/request';

export const dynamic = 'force-dynamic';

/**
 * POST /api/realtime/publish
 * Body: { channel, type, payload }
 *
 * Broadcasts via Supabase Realtime when live so all connected clients receive
 * the event over WebSocket. Used by import/cron/rematch routes.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 60, windowMs: 60_000, key: 'rt-pub' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const body = await readJsonBody<{
      channel?: string;
      type?: string;
      payload?: unknown;
    }>(request, 64 * 1024);

    const channel = assertChannelName(body.channel);
    const type = clampString(body.type || 'NOTIFY', 64) || 'NOTIFY';
    const payload = body.payload ?? {};

    // Bound payload size after parse
    const payloadJson = JSON.stringify(payload);
    if (payloadJson.length > 48 * 1024) {
      throw new RequestGuardError('payload too large', 413);
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
  } catch (e) {
    if (e instanceof RequestGuardError) return guardErrorResponse(e);
    console.error('[realtime/publish]', e);
    return NextResponse.json({ error: 'publish failed' }, { status: 500 });
  }
}
