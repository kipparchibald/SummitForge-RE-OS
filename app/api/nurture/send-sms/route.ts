import { NextRequest, NextResponse } from 'next/server';
import { rateLimit, rateLimitResponse } from '@/lib/security/rateLimit';
import {
  clampString,
  guardErrorResponse,
  normalizePhone,
  readJsonBody,
  RequestGuardError,
} from '@/lib/security/request';

/**
 * POST /api/nurture/send-sms
 * Body: { to: string, body: string }
 *
 * When TWILIO_* env vars are set, sends via Twilio.
 * Otherwise returns simulated: true so the agent outbox still works in demo.
 *
 * Hardened: rate limit, E.164 phone validation, body length cap.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 20, windowMs: 60_000, key: 'sms' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const raw = await readJsonBody<{ to?: string; body?: string }>(request, 8 * 1024);
    const to = normalizePhone(raw.to);
    if (!to) {
      throw new RequestGuardError('Valid phone number required (E.164 or 10-digit US)');
    }
    const body = clampString(raw.body, 1600).trim();
    if (!body) {
      throw new RequestGuardError('body required');
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return NextResponse.json({
        success: true,
        simulated: true,
        message:
          'Twilio not configured — message simulated. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER.',
        to,
        preview: body.slice(0, 160),
      });
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: body,
    });

    const twilioRes = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const data = await twilioRes.json();
    if (!twilioRes.ok) {
      // Do not echo full Twilio payload to clients
      console.error('[send-sms] Twilio error', data?.code, data?.message);
      return NextResponse.json({ error: 'Twilio send failed' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      simulated: false,
      sid: data.sid,
      status: data.status,
    });
  } catch (e) {
    if (e instanceof RequestGuardError) return guardErrorResponse(e);
    console.error('send-sms', e);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
}
