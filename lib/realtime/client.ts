/**
 * Realtime client: Supabase Realtime (WebSocket) when live,
 * otherwise SSE to /api/realtime/stream + local bus.
 */

import { getSupabase, isSupabaseLive } from '@/lib/supabase/client';
import { publishRealtime, subscribeRealtime } from './bus';
import type {
  RealtimeChannel,
  RealtimeConnectionState,
  RealtimeEvent,
} from './types';

type StateListener = (state: RealtimeConnectionState) => void;

let connectionState: RealtimeConnectionState = 'disconnected';
const stateListeners = new Set<StateListener>();
let started = false;
let supabaseChannels: { unsubscribe: () => void }[] = [];
let eventSource: EventSource | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function setState(next: RealtimeConnectionState) {
  if (connectionState === next) return;
  connectionState = next;
  stateListeners.forEach((l) => {
    try {
      l(next);
    } catch {
      /* */
    }
  });
}

export function getRealtimeState(): RealtimeConnectionState {
  return connectionState;
}

export function onRealtimeState(listener: StateListener): () => void {
  stateListeners.add(listener);
  listener(connectionState);
  return () => stateListeners.delete(listener);
}

function mapPostgresEvent(
  channel: RealtimeChannel,
  payload: any
): RealtimeEvent {
  const type =
    payload.eventType === 'INSERT'
      ? 'INSERT'
      : payload.eventType === 'UPDATE'
        ? 'UPDATE'
        : payload.eventType === 'DELETE'
          ? 'DELETE'
          : 'NOTIFY';
  return {
    id: `sb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    channel,
    type,
    payload: {
      new: payload.new,
      old: payload.old,
      table: payload.table,
    },
    at: new Date().toISOString(),
    source: 'supabase',
  };
}

function startSupabaseRealtime() {
  const client = getSupabase();
  setState('connecting');

  const tables: { table: string; channel: RealtimeChannel }[] = [
    { table: 'listings', channel: 'listings' },
    { table: 'matches', channel: 'matches' },
    { table: 'showing_requests', channel: 'showings' },
    { table: 'transactions', channel: 'transactions' },
  ];

  for (const { table, channel } of tables) {
    try {
      const ch = client
        .channel(`sf-${table}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table },
          (payload: any) => {
            const evt = mapPostgresEvent(channel, payload);
            publishRealtime(evt);
          }
        )
        .subscribe((status: string) => {
          if (status === 'SUBSCRIBED') setState('connected');
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setState('reconnecting');
            // fall through to SSE as backup
            startSseFallback();
          }
          if (status === 'CLOSED') setState('disconnected');
        });

      supabaseChannels.push({
        unsubscribe: () => {
          try {
            client.removeChannel(ch);
          } catch {
            /* */
          }
        },
      });
    } catch (e) {
      console.warn('[realtime] supabase channel failed', table, e);
    }
  }

  // Also listen for custom broadcast events on a shared channel
  try {
    const broadcast = client
      .channel('sf-broadcast')
      .on('broadcast', { event: 'sf' }, (payload: any) => {
        const data = payload?.payload;
        if (data?.channel) {
          publishRealtime({
            channel: data.channel,
            type: data.type || 'NOTIFY',
            payload: data.payload,
            source: 'broadcast',
          });
        }
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') setState('connected');
      });

    supabaseChannels.push({
      unsubscribe: () => {
        try {
          client.removeChannel(broadcast);
        } catch {
          /* */
        }
      },
    });
  } catch (e) {
    console.warn('[realtime] broadcast channel failed', e);
  }
}

function startSseFallback() {
  if (typeof window === 'undefined') return;
  if (eventSource) return;

  setState(connectionState === 'connected' ? 'connected' : 'connecting');

  try {
    const es = new EventSource('/api/realtime/stream');
    eventSource = es;

    es.onopen = () => {
      setState(isSupabaseLive() ? connectionState : 'demo');
      if (!isSupabaseLive()) setState('demo');
      else if (connectionState !== 'connected') setState('connected');
    };

    es.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data);
        if (data?.channel) {
          publishRealtime({
            ...data,
            source: 'sse',
          });
        }
        if (data?.type === 'HEALTH') {
          /* heartbeat */
        }
      } catch {
        /* ignore parse errors */
      }
    };

    es.onerror = () => {
      es.close();
      eventSource = null;
      setState('reconnecting');
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(() => {
        startSseFallback();
      }, 4000);
    };
  } catch (e) {
    console.warn('[realtime] SSE failed', e);
    setState(isSupabaseLive() ? 'reconnecting' : 'demo');
  }
}

/** Start realtime transports once (client-side only). */
export function startRealtime() {
  if (typeof window === 'undefined') return;
  if (started) return;
  started = true;

  if (isSupabaseLive()) {
    startSupabaseRealtime();
    // SSE as secondary fan-out for server-published events
    startSseFallback();
  } else {
    setState('demo');
    startSseFallback();
  }
}

export function stopRealtime() {
  supabaseChannels.forEach((c) => c.unsubscribe());
  supabaseChannels = [];
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  started = false;
  setState('disconnected');
}

/** Subscribe after ensuring transports are running. */
export function watchChannel(
  channel: RealtimeChannel | '*',
  handler: (event: RealtimeEvent) => void
): () => void {
  startRealtime();
  return subscribeRealtime(channel, handler);
}

/** Convenience: notify local + multi-tab of a domain event. */
export function emitLocal(
  channel: RealtimeChannel,
  type: RealtimeEvent['type'],
  payload: unknown
) {
  return publishRealtime({ channel, type, payload, source: 'local' });
}
