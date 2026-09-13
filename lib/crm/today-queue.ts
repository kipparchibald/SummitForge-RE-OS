/**
 * Today queue actions — snooze, dismiss, act (redirect to inbox).
 */

import type { CrmContact } from './store';
import { tomorrowMorningBoise } from './intent';

export function snoozeContact(contact: CrmContact): CrmContact {
  return {
    ...contact,
    snoozedUntil: tomorrowMorningBoise(),
    updatedAt: new Date().toISOString(),
  };
}

export function dismissContact(contact: CrmContact): CrmContact {
  return {
    ...contact,
    dismissedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Act → open inbox draft for this contact. */
export function inboxUrlForContact(contactId: string): string {
  return `/inbox?contact=${encodeURIComponent(contactId)}&from=today`;
}
