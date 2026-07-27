import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * SSE stream — WebSocket alternative that works on Vercel serverless
 * for fan-out of server-side events. Clients also use Supabase Realtime WS
 * when configured.
 *
 * GET /api/realtime/stream
 */
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          closed = true;
        }
      };

      // Hello + connection mode
      send({
        id: `hello_${Date.now()}`,
        channel: 'system',
        type: 'HEALTH',
        payload: {
          message: 'SummitForge realtime SSE connected',
          supabaseLive: !!(process.env.NEXT_PUBLIC_SUPABASE_URL && !String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('demo')),
        },
        at: new Date().toISOString(),
        source: 'sse',
      });

      // Heartbeat every 25s (keeps proxies from closing idle connections)
      const heartbeat = setInterval(() => {
        send({
          id: `hb_${Date.now()}`,
          channel: 'system',
          type: 'HEALTH',
          payload: { heartbeat: true },
          at: new Date().toISOString(),
          source: 'sse',
        });
      }, 25_000);

      const onAbort = () => {
        closed = true;
        clearInterval(heartbeat);
        try {
          controller.close();
        } catch {
          /* */
        }
      };

      request.signal.addEventListener('abort', onAbort);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
