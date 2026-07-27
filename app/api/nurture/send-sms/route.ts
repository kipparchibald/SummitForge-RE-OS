import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/nurture/send-sms
 * Body: { to: string, body: string }
 *
 * When TWILIO_* env vars are set, sends via Twilio.
 * Otherwise returns simulated: true so the agent outbox still works in demo.
 */
export async function POST(request: NextRequest) {
  try {
    const { to, body } = await request.json();
    if (!to || !body) {
      return NextResponse.json({ error: 'to and body required' }, { status: 400 });
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
        preview: String(body).slice(0, 160),
      });
    }

    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const params = new URLSearchParams({
      To: to,
      From: from,
      Body: String(body).slice(0, 1600),
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
      return NextResponse.json(
        { error: 'Twilio send failed', detail: data },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      simulated: false,
      sid: data.sid,
      status: data.status,
    });
  } catch (e) {
    console.error('send-sms', e);
    return NextResponse.json({ error: 'Send failed' }, { status: 500 });
  }
}
