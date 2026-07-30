// lib/security/request.ts
// Shared request guards: JSON body size, phone validation, channel names.

import { NextResponse } from 'next/server';

const DEFAULT_MAX_JSON_BYTES = 256 * 1024; // 256 KB

export class RequestGuardError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/**
 * Read and parse JSON with a hard byte ceiling to avoid memory exhaustion.
 */
export async function readJsonBody<T = unknown>(
  request: Request,
  maxBytes: number = DEFAULT_MAX_JSON_BYTES
): Promise<T> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType && !contentType.includes('application/json') && !contentType.includes('+json')) {
    // Allow empty content-type for some clients; still parse if body is JSON-ish.
    if (!contentType.includes('text/plain') && contentType.length > 0) {
      throw new RequestGuardError('Content-Type must be application/json', 415);
    }
  }

  const cl = request.headers.get('content-length');
  if (cl && Number(cl) > maxBytes) {
    throw new RequestGuardError(`Request body too large (max ${maxBytes} bytes)`, 413);
  }

  const buf = await request.arrayBuffer();
  if (buf.byteLength > maxBytes) {
    throw new RequestGuardError(`Request body too large (max ${maxBytes} bytes)`, 413);
  }
  if (buf.byteLength === 0) {
    return {} as T;
  }

  const text = new TextDecoder('utf-8').decode(buf);
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new RequestGuardError('Invalid JSON body', 400);
  }
}

export function guardErrorResponse(err: unknown): NextResponse {
  if (err instanceof RequestGuardError) {
    return NextResponse.json({ error: err.message }, { status: err.status });
  }
  console.error('[request-guard]', err);
  return NextResponse.json({ error: 'Bad request' }, { status: 400 });
}

/** E.164-ish phone: optional +, 10–15 digits. Strips common formatting. */
export function normalizePhone(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const digits = raw.replace(/[^\d+]/g, '');
  const compact = digits.startsWith('+')
    ? `+${digits.slice(1).replace(/\D/g, '')}`
    : digits.replace(/\D/g, '');
  const onlyDigits = compact.startsWith('+') ? compact.slice(1) : compact;
  if (onlyDigits.length < 10 || onlyDigits.length > 15) return null;
  if (!/^\+?\d{10,15}$/.test(compact)) return null;
  // US-friendly: if 10 digits, prefix +1
  if (!compact.startsWith('+') && onlyDigits.length === 10) return `+1${onlyDigits}`;
  if (!compact.startsWith('+')) return `+${onlyDigits}`;
  return compact;
}

const CHANNEL_RE = /^[a-zA-Z0-9_.:-]{1,64}$/;

export function assertChannelName(raw: unknown): string {
  if (typeof raw !== 'string' || !CHANNEL_RE.test(raw)) {
    throw new RequestGuardError('Invalid channel name');
  }
  return raw;
}

/** Cap free-text fields for AI / SMS. */
export function clampString(raw: unknown, max: number): string {
  if (raw == null) return '';
  const s = String(raw);
  return s.length > max ? s.slice(0, max) : s;
}
