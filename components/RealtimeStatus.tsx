'use client';

import React, { useEffect } from 'react';
import { useRealtimeConnection } from '@/lib/realtime/hooks';
import { startRealtime } from '@/lib/realtime/client';
import StatusBadge, { type StatusTone } from '@/components/ui/StatusBadge';
import type { RealtimeConnectionState } from '@/lib/realtime/types';

function toneFor(state: RealtimeConnectionState): StatusTone {
  switch (state) {
    case 'connected':
      return 'success';
    case 'demo':
      return 'info';
    case 'connecting':
    case 'reconnecting':
      return 'warning';
    case 'disconnected':
    default:
      return 'offline';
  }
}

function labelFor(state: RealtimeConnectionState): string {
  switch (state) {
    case 'connected':
      return 'Live WS';
    case 'demo':
      return 'Realtime demo';
    case 'connecting':
      return 'Connecting…';
    case 'reconnecting':
      return 'Reconnecting…';
    case 'disconnected':
    default:
      return 'Offline';
  }
}

/** Visual connection indicator — mount once in layout/dashboard. */
export default function RealtimeStatus({
  className = '',
}: {
  className?: string;
}) {
  const state = useRealtimeConnection();

  useEffect(() => {
    startRealtime();
  }, []);

  return (
    <StatusBadge
      label={labelFor(state)}
      tone={toneFor(state)}
      pulse={state === 'connected' || state === 'connecting' || state === 'reconnecting'}
      className={className}
    />
  );
}
