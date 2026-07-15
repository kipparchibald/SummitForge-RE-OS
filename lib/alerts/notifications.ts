// Summit Forge - Notification helpers
// SMS-first strategy: phone numbers are primary, email is secondary value capture

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
export function buildSmsMessage(alert: Alert, listing: Listing): string {
  const price = listing.price ? `$${listing.price.toLocaleString()}` : 'Price TBD';
  const acres = listing.acres ? ` • ${listing.acres} ac` : '';
  const address = listing.address || listing.city;

  return `SummitForge: New match for "${alert.name}"\n${address} • ${price}${acres}\nScore ${Math.round((listing as any).score || 0)}%. Reply STOP to pause.`;
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
 */
export async function sendSmsNotification(
  toPhone: string,
  message: string
): Promise<{ success: boolean; sid?: string }> {
  console.log(`[SMS Placeholder] To: ${toPhone} | Message: ${message}`);
  // TODO: Integrate Twilio when credentials are available
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

    const preferred = alert.notifyBy.includes('sms')
      ? 'sms'
      : alert.notifyBy.includes('in-app')
      ? 'in-app'
      : 'email';

    const message =
      preferred === 'sms'
        ? buildSmsMessage(alert, listing)
        : `New match for ${alert.name}: ${listing.address} - $${listing.price?.toLocaleString()}`;

    payloads.push({
      match,
      alert,
      listing,
      channel: preferred,
      message,
    });
  }

  return payloads;
}
