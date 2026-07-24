/**
 * Form Simplicity–style e-sign workflow for SummitForge.
 *
 * Architecture recommendation (industry practice for MLS/IAR forms):
 * ─────────────────────────────────────────────────────────────────
 *  PREPARE in SummitForge  →  SIGN in Form Simplicity (or in-app mirror)
 *
 *  • LINK OUT (recommended for production legal signing)
 *    - Official IAR forms + compliance live in Form Simplicity
 *    - SummitForge builds cover letter, packet, signers, then
 *      "Open Form Simplicity" / handoff export
 *    - Avoids iframe/X-Frame and SSO embedding issues
 *
 *  • EMBED (usually worse for Form Simplicity)
 *    - Most form portals set X-Frame-Options / CSP frame-ancestors deny
 *    - Session cookies + SSO break inside iframes
 *    - Only viable if FS provides an official embed SDK (rare)
 *
 *  • IN-APP MIRROR (this module)
 *    - Same mental model as Form Simplicity for training + demos:
 *      Transaction room → Forms tray → Recipients & routing → Send → Track → COA
 *    - Recipient signs via /forms/sign/[token] (email-link style)
 *    - Swap send/status for real Form Simplicity API when credentials exist
 */

import type {
  CertificateOfAuthenticity,
  CoverLetter,
  EnvelopeSigner,
  SignerRole,
  SignaturePackage,
} from './cover-letter';
import {
  buildCertificateOfAuthenticity,
  buildSignaturePackage,
  markSignerSigned,
  sendSignaturePackage,
} from './cover-letter';

/** Configurable portal URL — set NEXT_PUBLIC_FORM_SIMPLICITY_URL in env */
export function formSimplicityPortalUrl(): string {
  return (
    process.env.NEXT_PUBLIC_FORM_SIMPLICITY_URL?.trim() ||
    'https://www.formsimplicity.com/'
  );
}

export function formSimplicityConfigured(): boolean {
  return !!(
    process.env.FORM_SIMPLICITY_API_KEY ||
    process.env.NEXT_PUBLIC_FORM_SIMPLICITY_URL
  );
}

export type FsRoomStatus =
  | 'draft'
  | 'ready_to_send'
  | 'out_for_signature'
  | 'partially_signed'
  | 'completed'
  | 'voided';

export type FsFormRow = {
  code: string;
  name: string;
  required: boolean;
  status: 'prepared' | 'in_packet' | 'sent' | 'signed';
};

export type FsRecipient = EnvelopeSigner & {
  routingOrder: number;
  accessToken: string;
  signingUrl: string;
  lastNotifiedAt?: string;
};

/**
 * Form Simplicity–style “transaction room” for one deal packet.
 */
export type FormSimplicityRoom = {
  id: string;
  provider: 'summitforge_mirror' | 'form_simplicity';
  status: FsRoomStatus;
  createdAt: string;
  updatedAt: string;
  /** Human label like FS transaction name */
  roomName: string;
  propertyLabel: string;
  package: SignaturePackage;
  forms: FsFormRow[];
  recipients: FsRecipient[];
  /** Deep link / portal for official Form Simplicity */
  formSimplicityLaunchUrl: string;
  /** JSON handoff for import or API */
  handoffPayload: Record<string, unknown>;
  instructions: string[];
};

const ROOM_KEY = 'sf_fs_rooms';
const TOKEN_KEY = 'sf_fs_sign_tokens';

const FORM_NAMES: Record<string, string> = {
  COVER: 'Transaction Cover Letter',
  'RE-21': 'Purchase & Sale Agreement (Residential)',
  'RE-24': 'Vacant Land Purchase & Sale Agreement',
  'RE-22': 'Pre-Sold New Construction PSA',
  'RE-23': 'Commercial / Investment PSA',
  'RE-14': 'Buyer Representation Agreement',
  'RE-16': 'Seller Representation Agreement',
  'RE-25': "Seller's Property Condition Disclosure",
  'RE-25A': 'Seller Disclosure — Exempt',
  'RE-26': 'Seller Disclosure — New Construction',
  LeadPaint: 'Lead-Based Paint Disclosure',
  'Lead-Based Paint': 'Lead-Based Paint Disclosure',
  'RE-11': 'Addendum',
  'RE-13': 'Counter Offer',
};

function tokenFor(role: string, email: string): string {
  const raw = `${role}:${email}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2, 8)}`;
  // URL-safe compact token
  if (typeof btoa === 'function') {
    return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  return Buffer.from(raw).toString('base64url');
}

function originBase(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}

export function formDisplayName(code: string): string {
  return FORM_NAMES[code] || code;
}

/**
 * Build a Form Simplicity–style room from cover letter + form codes.
 */
export function createFormSimplicityRoom(
  cl: CoverLetter,
  formCodes: string[],
  opts?: { message?: string }
): FormSimplicityRoom {
  const codes = formCodes.filter((c) => c && c !== 'COVER');
  const pkg = buildSignaturePackage(cl, ['COVER', ...codes], opts);

  const recipients: FsRecipient[] = pkg.signers.map((s) => {
    const accessToken = tokenFor(s.role, s.email);
    return {
      ...s,
      routingOrder: s.order,
      accessToken,
      signingUrl: `${originBase()}/forms/sign/${accessToken}`,
    };
  });

  const forms: FsFormRow[] = [
    {
      code: 'COVER',
      name: formDisplayName('COVER'),
      required: true,
      status: 'prepared',
    },
    ...codes.map((code) => ({
      code,
      name: formDisplayName(code),
      required: true,
      status: 'in_packet' as const,
    })),
  ];

  const roomName =
    cl.address || cl.buyerName
      ? `${cl.address || 'Deal'} — ${cl.buyerName || 'Buyer'} / ${cl.sellerName || 'Seller'}`
      : `Transaction ${cl.id}`;

  const handoffPayload = {
    provider: 'form_simplicity_handoff_v1',
    exportedAt: new Date().toISOString(),
    brokerage: cl.brokerage,
    agent: {
      name: cl.agentName,
      email: cl.agentEmail,
      phone: cl.agentPhone,
      license: cl.agentLicense,
    },
    property: {
      address: cl.address,
      city: cl.city,
      county: cl.county,
      state: cl.state,
      zip: cl.zip,
      legalDescription: cl.legalDescription,
      acres: cl.acres,
      pin: cl.parcelOrApn,
    },
    parties: {
      buyer: { name: cl.buyerName, email: cl.buyerEmail, phone: cl.buyerPhone },
      seller: { name: cl.sellerName, email: cl.sellerEmail, phone: cl.sellerPhone },
    },
    terms: {
      purchasePrice: cl.purchasePrice,
      earnestMoney: cl.earnestMoney,
      earnestHeldBy: cl.earnestHeldBy,
      closingDate: cl.closingDate,
      financingType: cl.financingType,
      financingDetails: cl.financingDetails,
      inspectionDays: cl.inspectionDays,
      contingencies: cl.contingencies,
      titleCompany: cl.titleCompany,
    },
    forms: forms.map((f) => f.code),
    recipients: recipients.map((r) => ({
      role: r.role,
      name: r.name,
      email: r.email,
      routingOrder: r.routingOrder,
    })),
    message: pkg.message,
    note:
      'Import or re-key this packet into Form Simplicity. When API credentials exist, SummitForge can POST this payload automatically.',
  };

  const portal = formSimplicityPortalUrl();
  const now = new Date().toISOString();

  const room: FormSimplicityRoom = {
    id: `fsroom_${Date.now().toString(36)}`,
    provider: 'summitforge_mirror',
    status: recipients.length ? 'ready_to_send' : 'draft',
    createdAt: now,
    updatedAt: now,
    roomName,
    propertyLabel: cl.address || 'Property TBD',
    package: pkg,
    forms,
    recipients,
    formSimplicityLaunchUrl: portal,
    handoffPayload,
    instructions: [
      '1. Review forms in the packet tray (prepared from your cover letter).',
      '2. Confirm recipients and routing order (Buyer → Seller → Agent).',
      '3. Send for e-signature (in-app mirror) OR open Form Simplicity to use official IAR e-sign.',
      '4. Track status until complete — Certificate of Authenticity issues when all sign.',
      '5. Production: connect Form Simplicity API key to auto-create the room remotely.',
    ],
  };

  persistRoom(room);
  persistTokens(room);
  return room;
}

function persistRoom(room: FormSimplicityRoom) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    const list: FormSimplicityRoom[] = raw ? JSON.parse(raw) : [];
    const i = list.findIndex((r) => r.id === room.id);
    if (i >= 0) list[i] = room;
    else list.unshift(room);
    localStorage.setItem(ROOM_KEY, JSON.stringify(list.slice(0, 25)));
  } catch {
    /* ignore */
  }
}

function persistTokens(room: FormSimplicityRoom) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    const map: Record<string, { roomId: string; role: SignerRole; email: string }> = raw
      ? JSON.parse(raw)
      : {};
    for (const r of room.recipients) {
      map[r.accessToken] = { roomId: room.id, role: r.role, email: r.email };
    }
    localStorage.setItem(TOKEN_KEY, JSON.stringify(map));
  } catch {
    /* ignore */
  }
}

export function loadRooms(): FormSimplicityRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROOM_KEY);
    return raw ? (JSON.parse(raw) as FormSimplicityRoom[]) : [];
  } catch {
    return [];
  }
}

export function getRoom(id: string): FormSimplicityRoom | null {
  return loadRooms().find((r) => r.id === id) || null;
}

export function saveRoom(room: FormSimplicityRoom) {
  const next = { ...room, updatedAt: new Date().toISOString() };
  persistRoom(next);
  return next;
}

export function resolveSignToken(token: string): {
  room: FormSimplicityRoom;
  recipient: FsRecipient;
} | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(TOKEN_KEY);
    const map: Record<string, { roomId: string; role: SignerRole; email: string }> = raw
      ? JSON.parse(raw)
      : {};
    const ref = map[token];
    if (!ref) return null;
    const room = getRoom(ref.roomId);
    if (!room) return null;
    const recipient = room.recipients.find(
      (r) => r.accessToken === token || (r.role === ref.role && r.email === ref.email)
    );
    if (!recipient) return null;
    return { room, recipient };
  } catch {
    return null;
  }
}

/** Send room for signature — mirrors FS “Send for e-signature”. */
export async function sendFormSimplicityRoom(
  room: FormSimplicityRoom
): Promise<FormSimplicityRoom> {
  const sentPkg = await sendSignaturePackage({
    ...room.package,
    message: room.package.message,
  });

  const now = new Date().toISOString();
  const recipients = room.recipients.map((r) => {
    const link = sentPkg.signingLinks?.find((l) => l.role === r.role);
    return {
      ...r,
      status: 'sent' as const,
      lastNotifiedAt: now,
      // Keep our in-app signing URL (Form Simplicity style email link)
      signingUrl: r.signingUrl || link?.url || r.signingUrl,
    };
  });

  const next: FormSimplicityRoom = {
    ...room,
    status: 'out_for_signature',
    updatedAt: now,
    package: {
      ...sentPkg,
      signingLinks: recipients.map((r) => ({
        role: r.role,
        name: r.name,
        url: r.signingUrl,
      })),
    },
    recipients,
    forms: room.forms.map((f) => ({ ...f, status: 'sent' as const })),
  };
  persistRoom(next);
  persistTokens(next);
  return next;
}

/** Recipient completes signature in the mirror signing room. */
export function signAsRecipient(
  room: FormSimplicityRoom,
  role: SignerRole
): FormSimplicityRoom {
  const pkg = markSignerSigned(room.package, role);
  const recipients = room.recipients.map((r) => {
    if (r.role !== role) return r;
    const updated = pkg.signers.find((s) => s.role === role);
    return {
      ...r,
      status: 'signed' as const,
      signedAt: updated?.signedAt,
      ipAddress: updated?.ipAddress,
      userAgent: updated?.userAgent,
    };
  });

  const allSigned = recipients.every((r) => r.status === 'signed');
  let certificateOfAuthenticity: CertificateOfAuthenticity | undefined =
    pkg.certificateOfAuthenticity;
  if (allSigned && !certificateOfAuthenticity) {
    certificateOfAuthenticity = buildCertificateOfAuthenticity({
      ...pkg,
      signers: recipients,
      status: 'completed',
    });
  }

  const next: FormSimplicityRoom = {
    ...room,
    status: allSigned ? 'completed' : 'partially_signed',
    updatedAt: new Date().toISOString(),
    package: {
      ...pkg,
      certificateOfAuthenticity,
      status: allSigned ? 'completed' : 'sent',
      signers: recipients,
    },
    recipients,
    forms: allSigned
      ? room.forms.map((f) => ({ ...f, status: 'signed' as const }))
      : room.forms,
  };
  persistRoom(next);
  return next;
}

export function openFormSimplicityPortal(room?: FormSimplicityRoom) {
  const url = room?.formSimplicityLaunchUrl || formSimplicityPortalUrl();
  if (typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
  return url;
}

export function exportHandoffJson(room: FormSimplicityRoom): string {
  return JSON.stringify(room.handoffPayload, null, 2);
}

export const FS_STATUS_LABEL: Record<FsRoomStatus, string> = {
  draft: 'Draft',
  ready_to_send: 'Ready to send',
  out_for_signature: 'Out for signature',
  partially_signed: 'Partially signed',
  completed: 'Completed',
  voided: 'Voided',
};
