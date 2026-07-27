/**
 * Cross-tab + in-process event bus for SummitForge realtime.
 * Uses BroadcastChannel when available; falls back to window CustomEvent.
 */

import type { RealtimeChannel, RealtimeEvent } from './types';

const CHANNEL_NAME = 'summitforge-realtime';
const WINDOW_EVENT = 'sf-realtime';

type Handler = (event: RealtimeEvent) => void;

const handlers = new Map<RealtimeChannel | '*', Set<Handler>>();
let bc: BroadcastChannel | null = null;
let windowWired = false;

function ensureTransport() {
  if (typeof window === 'undefined') return;

  if (!bc && typeof BroadcastChannel !== 'undefined') {
    try {
      bc = new BroadcastChannel(CHANNEL_NAME);
      bc.onmessage = (msg) => {
        const event = msg.data as RealtimeEvent;
        if (event?.channel) dispatchLocal(event);
      };
    } catch {
      bc = null;
    }
  }

  if (!windowWired) {
    windowWired = true;
    window.addEventListener(WINDOW_EVENT, ((e: CustomEvent<RealtimeEvent>) => {
      if (e.detail?.channel) dispatchLocal(e.detail);
    }) as EventListener);
  }
}

function dispatchLocal(event: RealtimeEvent) {
  const star = handlers.get('*');
  star?.forEach((h) => {
    try {
      h(event);
    } catch (err) {
      console.warn('[realtime] handler error', err);
    }
  });
  const set = handlers.get(event.channel);
  set?.forEach((h) => {
    try {
      h(event);
    } catch (err) {
      console.warn('[realtime] handler error', err);
    }
  });
}

/** Publish an event to this tab + other tabs. */
export function publishRealtime(event: Omit<RealtimeEvent, 'id' | 'at'> & { id?: string; at?: string }) {
  const full: RealtimeEvent = {
    id: event.id || `evt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: event.at || new Date().toISOString(),
    channel: event.channel,
    type: event.type,
    payload: event.payload,
    source: event.source,
  };

  ensureTransport();
  dispatchLocal(full);

  if (typeof window !== 'undefined') {
    try {
      bc?.postMessage(full);
    } catch {
      /* */
    }
    try {
      window.dispatchEvent(new CustomEvent(WINDOW_EVENT, { detail: full }));
    } catch {
      /* */
    }
  }

  return full;
}

/** Subscribe to a channel (or '*' for all). Returns unsubscribe. */
export function subscribeRealtime(
  channel: RealtimeChannel | '*',
  handler: Handler
): () => void {
  ensureTransport();
  if (!handlers.has(channel)) handlers.set(channel, new Set());
  handlers.get(channel)!.add(handler);
  return () => {
    handlers.get(channel)?.delete(handler);
  };
}
