// Summit Forge - Notification helpers
// SMS-first strategy: phone numbers are primary, email is secondary value capture
// Twilio integration is live when TWILIO_* env vars are present.

import { AlertMatch, Alert, Listing } from '@/types/alerts';

export interface NotificationPayload {
  match: AlertMatch;
  alert: Alert;
  listing: Listing;
  channel: 'sms' | 'in-app' | 'email';
  message: string;
}

/**
 * Build a short SMS-friendly message for a matched listing.
 * Keep under ~160 characters when possible.
 */
export function buildSmsMessage(alert: Alert, listing: Listing, score?: number): string {
  const price = listing.price ? `$${listing.price.toLocaleString()}` : 'Price TBD';
  const acres = listing.acres ? ` • ${listing.acres} ac` : '';
  const address = listing.address || listing.city;
  const scorePart = score != null ? ` (${Math.round(score)}%)` : '';

  return `SummitForge: Match for "${alert.name}"${scorePart}\n${address} • ${price}${acres}\nReply STOP to pause.`;
}

/**
 * In-app notification object (ready for a toast or feed).
 */
export function buildInAppNotification(payload: NotificationPayload) {
  return {
    id: payload.match.id,
    title: `New match for "${payload.alert.name}"`,
    body: `${payload.listing.address || payload.listing.city} • $${payload.listing.price?.toLocaleString() || 'TBD'}`,
    score: payload.match.matchScore,
    listingId: payload.listing.id,
    alertId: payload.alert.id,
    createdAt: new Date().toISOString(),
    read: false,
  };
}

/**
 * Real Twilio SMS when credentials exist, otherwise simulated.
 * Required env: TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 */
export async function sendSmsNotification(
  toPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string; simulated?: boolean; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !from) {
    console.log(`[SMS Simulated] To: ${toPhone} | ${message}`);
    return { success: true, sid: `sim_${Date.now()}`, simulated: true };
  }

  try {
    const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const body = new URLSearchParams({
      To: toPhone,
      From: from,
      Body: message,
    });

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      }
    );

    const data = await res.json();
    if (!res.ok) {
      console.error('[SMS Twilio error]', data);
      return { success: false, error: data.message || 'Twilio error' };
    }

    return { success: true, sid: data.sid };
  } catch (err: any) {
    console.error('[SMS send failed]', err);
    return { success: false, error: err.message };
  }
}

/**
 * Process matches and prepare + optionally send notifications.
 */
export async function processMatchesForNotification(
  matches: AlertMatch[],
  alerts: Alert[],
  listings: Listing[],
  options?: { sendSms?: boolean; phoneLookup?: (alert: Alert) => string | undefined }
): Promise<NotificationPayload[]> {
  const payloads: NotificationPayload[] = [];

  for (const match of matches) {
    const alert = alerts.find(a => a.id === match.alertId);
    const listing = listings.find(l => l.id === match.listingId);
    if (!alert || !listing) continue;

    const preferred = alert.notifyBy.includes('sms')
      ? 'sms'
      : alert.notifyBy.includes('in-app')
      ? 'in-app'
      : 'email';

    const message =
      preferred === 'sms'
        ? buildSmsMessage(alert, listing, match.matchScore)
        : `New match for ${alert.name}: ${listing.address} - $${listing.price?.toLocaleString()}`;

    const payload: NotificationPayload = {
      match,
      alert,
      listing,
      channel: preferred,
      message,
    };

    if (preferred === 'sms' && options?.sendSms) {
      const phone = options.phoneLookup?.(alert);
      if (phone) {
        await sendSmsNotification(phone, message);
      }
    }

    payloads.push(payload);
  }

  return payloads;
}
