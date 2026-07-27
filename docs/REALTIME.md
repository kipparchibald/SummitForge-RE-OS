# SummitForge realtime (WebSocket)

## Architecture

| Layer | Transport | When |
|-------|-----------|------|
| **Supabase Realtime** | WebSocket | `NEXT_PUBLIC_SUPABASE_URL` is a real project |
| **SSE** | `/api/realtime/stream` | Always (heartbeat + hello); backup fan-out |
| **BroadcastChannel + bus** | Same-origin multi-tab | Always (portal → CRM showings) |

## Channels

- `listings` — Navica / import upserts
- `matches` — alert rematch → portal feed
- `showings` — portal Schedule showing → CRM inbox
- `transactions` — deal stage changes
- `nurture` — SMS enrollments
- `system` — health heartbeats

## Client usage

```tsx
import { useRealtime, useRealtimeConnection } from '@/lib/realtime/hooks';
import { emitLocal } from '@/lib/realtime/client';

const state = useRealtimeConnection(); // 'connected' | 'demo' | …

useRealtime('showings', (evt) => {
  console.log(evt.type, evt.payload);
});

emitLocal('showings', 'INSERT', { id: 'show_1' });
```

## Server publish

```bash
curl -X POST /api/realtime/publish \
  -H 'Content-Type: application/json' \
  -d '{"channel":"listings","type":"SYNC","payload":{"count":12}}'
```

## Supabase setup

Enable Realtime replication on `listings` (and optional match/showing tables).
Until then, clients run in **demo** mode via SSE + local bus.
