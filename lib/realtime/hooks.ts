'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  emitLocal,
  getRealtimeState,
  onRealtimeState,
  startRealtime,
  watchChannel,
} from './client';
import type {
  RealtimeChannel,
  RealtimeConnectionState,
  RealtimeEvent,
} from './types';

/** Connection state for status badges. Auto-starts transports. */
export function useRealtimeConnection(): RealtimeConnectionState {
  const [state, setState] = useState<RealtimeConnectionState>('disconnected');

  useEffect(() => {
    startRealtime();
    return onRealtimeState(setState);
  }, []);

  return state;
}

/**
 * Subscribe to a realtime channel. Handler receives typed events.
 * Returns latest event (or null) for simple UIs.
 */
export function useRealtime(
  channel: RealtimeChannel | '*',
  onEvent?: (event: RealtimeEvent) => void
): {
  lastEvent: RealtimeEvent | null;
  state: RealtimeConnectionState;
  emit: (type: RealtimeEvent['type'], payload: unknown) => void;
} {
  const [lastEvent, setLastEvent] = useState<RealtimeEvent | null>(null);
  const state = useRealtimeConnection();

  useEffect(() => {
    return watchChannel(channel, (event) => {
      setLastEvent(event);
      onEvent?.(event);
    });
  }, [channel, onEvent]);

  const emit = useCallback(
    (type: RealtimeEvent['type'], payload: unknown) => {
      if (channel === '*') return;
      emitLocal(channel, type, payload);
    },
    [channel]
  );

  return { lastEvent, state, emit };
}
