/** Shared realtime event types for SummitForge. */

export type RealtimeChannel =
  | 'listings'
  | 'matches'
  | 'showings'
  | 'transactions'
  | 'nurture'
  | 'system';

export type RealtimeEventType =
  | 'INSERT'
  | 'UPDATE'
  | 'DELETE'
  | 'SYNC'
  | 'NOTIFY'
  | 'HEALTH';

export type RealtimeEvent<T = unknown> = {
  id: string;
  channel: RealtimeChannel;
  type: RealtimeEventType;
  payload: T;
  at: string;
  source: 'supabase' | 'sse' | 'broadcast' | 'local';
};

export type RealtimeConnectionState =
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'disconnected'
  | 'demo';
