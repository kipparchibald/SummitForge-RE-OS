// Summit Forge - Notification helpers
// SMS-first strategy: phone numbers are primary, email is secondary value capture

import { AlertMatch, Alert, Listing } from '@/types/alerts';

export interface NotificationPayload {
  match: AlertMatch;
  alert: Alert;
  listing: Listing;
  channel: 'sms' | 'in-app' | 'email';
}

/**
 * Build a short SMS-friendly message for a matched listing.
 * Keep under ~160 characters when possible.
 */
export function buildSmsMessage(payload: NotificationPayload): string {
  const { alert, listing } = payload;
  const price = listing.price ? `$${listing.price.toLocaleString()}` : 'Price TBD';
  const acres = listing.acres ? ` • ${listing.acres} ac` : '';

  return `SummitForge Alert: ${alert.name}\n${listing.address || listing.city} • ${price}${acres}\nReply STOP to pause.`;
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
 * Placeholder for future Twilio integration.
 * For now we log and return a simulated success.
 */
export async function sendSmsNotification(
  toPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string }> {
  console.log(`[SMS Placeholder] To: ${toPhone} | Message: ${message}`);
  // TODO: Integrate Twilio when credentials are available
  // const client = twilio(accountSid, authToken);
  // const result = await client.messages.create({ body: message, from: twilioNumber, to: toPhone });
  return { success: true, sid: `sim_${Date.now()}` };
}

/**
 * Process matches and prepare notifications according to each alert's preferences.
 */
export async function processMatchesForNotification(
  matches: AlertMatch[],
  alerts: Alert[],
  listings: Listing[]
): Promise<NotificationPayload[]> {
  const payloads: NotificationPayload[] = [];

  for (const match of matches) {
    const alert = alerts.find(a => a.id === match.alertId);
    const listing = listings.find(l => l.id === match.listingId);
    if (!alert || !listing) continue;

    // Prefer SMS if the alert allows it (SMS-first strategy)
    const preferred = alert.notifyBy.includes('sms')
      ? 'sms'
      : alert.notifyBy.includes('in-app')
      ? 'in-app'
      : 'email';

    payloads.push({
      match,
      alert,
      listing,
      channel: preferred,
    });
  }

  return payloads;
}
