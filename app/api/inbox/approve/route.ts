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
 * POST /api/inbox/approve
 *
 * Approve-only outreach. Records approval intent; does NOT transmit unless
 * BOTH are true:
 *   - body.explicitApprove === true
 *   - process.env.OUTBOUND_APPROVE_SEND === 'true'
 *
 * Twilio/nurture auto-send stays OFF by default. Prefer recording approval
 * without sending when infra is not explicitly enabled.
 */
export async function POST(request: NextRequest) {
  const rl = rateLimit(request, { limit: 30, windowMs: 60_000, key: 'inbox-approve' });
  if (!rl.ok) return rateLimitResponse(rl);

  try {
    const raw = await readJsonBody<{
      draftId?: string;
      contactId?: string;
      channel?: 'sms' | 'email';
      body?: string;
      subject?: string;
      to?: string;
      explicitApprove?: boolean;
    }>(request, 16 * 1024);

    if (!raw.explicitApprove) {
      throw new RequestGuardError('explicitApprove must be true to approve outreach');
    }

    const channel = raw.channel === 'email' ? 'email' : 'sms';
    const body = clampString(raw.body, channel === 'sms' ? 1600 : 8000).trim();
    if (!body) throw new RequestGuardError('body required');

    const draftId = raw.draftId || `draft_${Date.now()}`;
    const approvedAt = new Date().toISOString();
    const outboundEnabled = process.env.OUTBOUND_APPROVE_SEND === 'true';

    if (!outboundEnabled || channel === 'email') {
      return NextResponse.json({
        success: true,
        draftId,
        contactId: raw.contactId || null,
        channel,
        status: 'approved',
        approvedAt,
        transmitted: false,
        simulated: true,
        message:
          channel === 'email'
            ? 'Email approval recorded — outbound email is not wired; draft saved only.'
            : 'Approval recorded — outbound SMS remains OFF (set OUTBOUND_APPROVE_SEND=true to enable live send).',
        preview: body.slice(0, 200),
      });
    }

    const to = normalizePhone(raw.to);
    if (!to) {
      throw new RequestGuardError('Valid phone required for SMS approve');
    }

    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_FROM_NUMBER;

    if (!sid || !token || !from) {
      return NextResponse.json({
        success: true,
        draftId,
        contactId: raw.contactId || null,
        channel: 'sms',
        status: 'approved',
        approvedAt,
        transmitted: false,
        simulated: true,
        message:
          'Approval recorded — Twilio not configured; no message sent.',
        to,
        preview: body.slice(0, 160),
      });
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({ To: to, From: from, Body: body });

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
      console.error('[inbox/approve] Twilio error', data?.code, data?.message);
      return NextResponse.json({ error: 'Twilio send failed' }, { status: 502 });
    }

    return NextResponse.json({
      success: true,
      draftId,
      contactId: raw.contactId || null,
      channel: 'sms',
      status: 'sent',
      approvedAt,
      transmitted: true,
      simulated: false,
      sid: data.sid,
      twilioStatus: data.status,
    });
  } catch (e) {
    if (e instanceof RequestGuardError) return guardErrorResponse(e);
    console.error('[inbox/approve]', e);
    return NextResponse.json({ error: 'Approve failed' }, { status: 500 });
  }
}
