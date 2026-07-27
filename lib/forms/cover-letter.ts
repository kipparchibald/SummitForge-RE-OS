/**
 * Transaction Cover Letter — single source of truth for Idaho form population.
 *
 * Two layers:
 *  1. Defaults (agent, brokerage, usual title co, standard contingency language)
 *     — saved once, reused every deal
 *  2. Deal-specific (price, legal, earnest, closing, financing, inspection, parties)
 *     — filled per transaction
 *
 * Cover letter → RE-21/24/14/… + signature package.
 */

import {
  createIdahoFormsEngine,
  type PopulatedForm,
} from './idaho-forms';

export type FinancingType =
  | 'Conventional'
  | 'FHA'
  | 'VA'
  | 'USDA'
  | 'Cash'
  | 'Seller finance'
  | 'Other';

export type PropertyKind = 'Residential' | 'Vacant Land' | 'New Construction' | 'Commercial';

/** Fields that rarely change — stored as agent defaults */
export type CoverLetterDefaults = {
  agentName: string;
  agentLicense?: string;
  agentEmail: string;
  agentPhone: string;
  brokerage: string;
  brokerageAddress?: string;
  defaultTitleCompany: string;
  defaultTitleOfficer?: string;
  defaultTitleEmail?: string;
  defaultTitlePhone?: string;
  defaultEarnestMoney: number;
  defaultInspectionDays: number;
  defaultFinancingType: FinancingType;
  defaultClosingDaysFromOffer: number;
  /** Boilerplate contingency language applied unless deal overrides */
  standardContingencies: string;
  buyerBrokerCompensation: string;
  listingCommission: string;
  preferredCounty: string;
  preferredState: string;
};

/** Per-transaction deal sheet */
export type CoverLetterDeal = {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: 'draft' | 'forms_ready' | 'sent_for_signature' | 'partially_signed' | 'fully_signed';

  // Parties
  buyerName: string;
  buyerEmail: string;
  buyerPhone?: string;
  sellerName: string;
  sellerEmail: string;
  sellerPhone?: string;

  // Property
  propertyKind: PropertyKind;
  address: string;
  city: string;
  county: string;
  state: string;
  zip: string;
  legalDescription: string;
  acres?: string;
  parcelOrApn?: string;
  subdivision?: string;
  lotNumber?: string;
  zoning?: string;
  yearBuilt?: string;

  // Money & dates (deal-specific)
  purchasePrice: number;
  listPrice?: number;
  earnestMoney: number;
  earnestHeldBy: string;
  closingDate: string;
  agreementDate: string;

  // Title
  titleCompany: string;
  titleOfficer?: string;
  titleEmail?: string;
  titlePhone?: string;

  // Contingencies & terms (deal-specific)
  financingType: FinancingType;
  financingDetails?: string;
  loanAmount?: number;
  inspectionDays: number;
  inspectionDeadline?: string;
  contingencies: string;
  additionalTerms?: string;

  // Package
  formCodes: string[];
  coverNotes?: string;
};

export type CoverLetter = CoverLetterDefaults & CoverLetterDeal;

export type SignerRole = 'buyer' | 'seller' | 'listing_agent' | 'buyer_agent' | 'other';

export type EnvelopeSigner = {
  role: SignerRole;
  name: string;
  email: string;
  order: number;
  status: 'pending' | 'sent' | 'viewed' | 'signed' | 'declined';
  signedAt?: string;
  /** Demo audit fields — real providers supply IP / device from their COC */
  ipAddress?: string;
  userAgent?: string;
};

/**
 * Certificate of Authenticity / Completion (COA).
 * Industry parallel to DocuSign Certificate of Completion (COC) / Adobe Certificate of Authenticity.
 * Generated when all required signers complete. Production DocuSign returns their own COC PDF.
 */
export type CertificateOfAuthenticity = {
  id: string;
  envelopeId: string;
  packageId: string;
  issuedAt: string;
  status: 'issued';
  /** Documents covered by this certificate */
  documents: string[];
  /** Property / deal summary line */
  transactionSummary: string;
  subject: string;
  /** Ordered audit of each signer event */
  auditTrail: {
    order: number;
    role: SignerRole;
    name: string;
    email: string;
    action: 'sent' | 'signed';
    timestamp: string;
    ipAddress?: string;
    userAgent?: string;
  }[];
  /** Simple integrity fingerprint of the completed package (demo SHA-style hash) */
  documentHash: string;
  /** Human-readable full certificate text for print / copy */
  fullText: string;
  disclaimer: string;
};

export type SignaturePackage = {
  id: string;
  coverLetterId: string;
  createdAt: string;
  status: 'draft' | 'sent' | 'completed' | 'voided';
  subject: string;
  message: string;
  formCodes: string[];
  signers: EnvelopeSigner[];
  /** Simulated DocuSign / Form Simplicity envelope id */
  envelopeId?: string;
  signingLinks?: { role: string; name: string; url: string }[];
  /** Present once all signers complete */
  certificateOfAuthenticity?: CertificateOfAuthenticity;
  /** Optional deal context for COA text */
  dealContext?: {
    address?: string;
    buyerName?: string;
    sellerName?: string;
    purchasePrice?: number;
    closingDate?: string;
    brokerage?: string;
    agentName?: string;
  };
};

const DEFAULTS_KEY = 'sf_forms_cover_defaults';
const DEAL_KEY = 'sf_forms_cover_deal';
const PACKAGE_KEY = 'sf_forms_signature_packages';

export const DEFAULT_COVER_DEFAULTS: CoverLetterDefaults = {
  agentName: 'Kipp Archibald',
  agentLicense: '',
  agentEmail: 'kipp@archibaldbagley.com',
  agentPhone: '(208) 745-5911',
  brokerage: 'Archibald-Bagley Real Estate',
  brokerageAddress: 'Rigby, Idaho',
  defaultTitleCompany: 'TitleOne / local title company',
  defaultTitleOfficer: '',
  defaultTitleEmail: '',
  defaultTitlePhone: '',
  defaultEarnestMoney: 5000,
  defaultInspectionDays: 10,
  defaultFinancingType: 'Conventional',
  defaultClosingDaysFromOffer: 30,
  standardContingencies:
    'Sale subject to: (1) financing approval; (2) satisfactory inspection within inspection period; (3) clear and marketable title; (4) buyer approval of HOA/CC&Rs if any. Time is of the essence.',
  buyerBrokerCompensation: 'As per offer / brokerage agreement',
  listingCommission: 'As agreed',
  preferredCounty: 'Jefferson',
  preferredState: 'Idaho',
};

export function defaultClosingDate(daysFromNow = 30): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

export function createBlankDeal(defaults: CoverLetterDefaults = DEFAULT_COVER_DEFAULTS): CoverLetterDeal {
  const now = new Date().toISOString();
  return {
    id: `deal_${Date.now().toString(36)}`,
    createdAt: now,
    updatedAt: now,
    status: 'draft',
    buyerName: '',
    buyerEmail: '',
    sellerName: '',
    sellerEmail: '',
    propertyKind: 'Residential',
    address: '',
    city: 'Rigby',
    county: defaults.preferredCounty,
    state: defaults.preferredState,
    zip: '83442',
    legalDescription: '',
    purchasePrice: 0,
    earnestMoney: defaults.defaultEarnestMoney,
    earnestHeldBy: defaults.defaultTitleCompany,
    closingDate: defaultClosingDate(defaults.defaultClosingDaysFromOffer),
    agreementDate: new Date().toISOString().slice(0, 10),
    titleCompany: defaults.defaultTitleCompany,
    titleOfficer: defaults.defaultTitleOfficer,
    titleEmail: defaults.defaultTitleEmail,
    titlePhone: defaults.defaultTitlePhone,
    financingType: defaults.defaultFinancingType,
    inspectionDays: defaults.defaultInspectionDays,
    contingencies: defaults.standardContingencies,
    formCodes: ['RE-21', 'RE-14', 'RE-25', 'LeadPaint'],
    coverNotes: '',
  };
}

export function loadDefaults(): CoverLetterDefaults {
  if (typeof window === 'undefined') return DEFAULT_COVER_DEFAULTS;
  try {
    const raw = localStorage.getItem(DEFAULTS_KEY);
    if (!raw) return DEFAULT_COVER_DEFAULTS;
    return { ...DEFAULT_COVER_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_COVER_DEFAULTS;
  }
}

export function saveDefaults(d: CoverLetterDefaults) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(DEFAULTS_KEY, JSON.stringify(d));
}

export function loadDeal(): CoverLetterDeal | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(DEAL_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as CoverLetterDeal;
  } catch {
    return null;
  }
}

export function saveDeal(deal: CoverLetterDeal) {
  if (typeof window === 'undefined') return;
  const next = { ...deal, updatedAt: new Date().toISOString() };
  localStorage.setItem(DEAL_KEY, JSON.stringify(next));
}

export function mergeCoverLetter(
  defaults: CoverLetterDefaults,
  deal: CoverLetterDeal
): CoverLetter {
  return { ...defaults, ...deal };
}

/** Human-readable cover letter body for print / email / packet front page */
export function renderCoverLetterText(cl: CoverLetter): string {
  const money = (n: number) =>
    n
      ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      : '—';

  return [
    `TRANSACTION COVER LETTER`,
    `${cl.brokerage}`,
    ``,
    `Date: ${cl.agreementDate || new Date().toLocaleDateString()}`,
    `Prepared by: ${cl.agentName} · ${cl.agentPhone} · ${cl.agentEmail}`,
    cl.agentLicense ? `License: ${cl.agentLicense}` : null,
    ``,
    `────────────────────────────────────────`,
    `PARTIES`,
    `Buyer:  ${cl.buyerName || '—'}  <${cl.buyerEmail || 'no email'}>`,
    `Seller: ${cl.sellerName || '—'}  <${cl.sellerEmail || 'no email'}>`,
    ``,
    `PROPERTY`,
    `Type: ${cl.propertyKind}`,
    `Address: ${cl.address || '—'}`,
    `City/State/Zip: ${cl.city}, ${cl.state} ${cl.zip}`,
    `County: ${cl.county}`,
    cl.acres ? `Acres: ${cl.acres}` : null,
    cl.parcelOrApn ? `APN/Parcel: ${cl.parcelOrApn}` : null,
    `Legal description:`,
    cl.legalDescription || '(to be attached / confirmed with title)',
    ``,
    `FINANCIAL TERMS`,
    `Purchase price: ${money(cl.purchasePrice)}`,
    cl.listPrice ? `List price: ${money(cl.listPrice)}` : null,
    `Earnest money: ${money(cl.earnestMoney)} held by ${cl.earnestHeldBy || cl.titleCompany}`,
    `Closing date: ${cl.closingDate || '—'}`,
    ``,
    `TITLE`,
    `Title company: ${cl.titleCompany || '—'}`,
    cl.titleOfficer ? `Officer: ${cl.titleOfficer}` : null,
    cl.titleEmail ? `Title email: ${cl.titleEmail}` : null,
    cl.titlePhone ? `Title phone: ${cl.titlePhone}` : null,
    ``,
    `FINANCING`,
    `Type: ${cl.financingType}`,
    cl.loanAmount ? `Loan amount: ${money(cl.loanAmount)}` : null,
    cl.financingDetails || null,
    ``,
    `INSPECTION & CONTINGENCIES`,
    `Inspection period: ${cl.inspectionDays} days` +
      (cl.inspectionDeadline ? ` (deadline ${cl.inspectionDeadline})` : ''),
    `Contingencies:`,
    cl.contingencies || '—',
    cl.additionalTerms ? `\nAdditional terms:\n${cl.additionalTerms}` : null,
    ``,
    `FORMS IN THIS PACKET`,
    (cl.formCodes || []).join(', ') || '—',
    ``,
    cl.coverNotes ? `AGENT NOTES\n${cl.coverNotes}\n` : null,
    `────────────────────────────────────────`,
    `This cover letter is used to populate Idaho Association of REALTORS® forms`,
    `(RE-21, RE-24, RE-14, disclosures, etc.). Verify all legal descriptions and`,
    `figures with title and your client before signing.`,
    ``,
    `Equal Housing Opportunity · ${cl.brokerage}`,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/** Map cover letter → IdahoFormsEngine constructor args */
export function coverLetterToEngineParts(cl: CoverLetter) {
  const transaction = {
    agreementDate: cl.agreementDate,
    purchasePrice: cl.purchasePrice,
    listPrice: cl.listPrice || cl.purchasePrice,
    earnestMoney: cl.earnestMoney,
    earnestHeldBy: cl.earnestHeldBy,
    closingDate: cl.closingDate,
    financingType: cl.financingType,
    financingDetails: cl.financingDetails,
    loanAmount: cl.loanAmount,
    inspectionDays: String(cl.inspectionDays),
    inspectionDeadline: cl.inspectionDeadline,
    contingencies: cl.contingencies,
    additionalTerms: cl.additionalTerms,
    titleCompany: cl.titleCompany,
    titleOfficer: cl.titleOfficer,
    titleEmail: cl.titleEmail,
    titlePhone: cl.titlePhone,
    propertyType: cl.propertyKind,
    commission: cl.listingCommission,
    buyerBrokerCompensation: cl.buyerBrokerCompensation,
    addendumText: [cl.contingencies, cl.additionalTerms].filter(Boolean).join('\n\n'),
    counterOfferChanges: '',
    counterExpiration: '',
    completionDate: '',
    capRate: '',
    noi: '',
  };

  const property = {
    address: cl.address,
    city: cl.city,
    county: cl.county,
    state: cl.state,
    zip: cl.zip,
    legalDescription: cl.legalDescription,
    acres: cl.acres,
    parcelOrApn: cl.parcelOrApn,
    zoning: cl.zoning,
    yearBuilt: cl.yearBuilt,
    wellSeptic: cl.propertyKind === 'Vacant Land' ? 'To be verified' : 'N/A',
    access: 'As disclosed / public road',
    lotNumber: cl.lotNumber,
    subdivision: cl.subdivision,
    knownDefects: 'See seller disclosure',
    exemptionReason: '',
    annexationStatus: '',
    cityServices: '',
    consentToAnnex: '',
    knownLeadHazards: 'No known lead-based paint hazards',
    leadRecords: 'No reports available',
  };

  const buyer = {
    name: cl.buyerName,
    email: cl.buyerEmail,
    phone: cl.buyerPhone,
  };
  const seller = {
    name: cl.sellerName,
    email: cl.sellerEmail,
    phone: cl.sellerPhone,
  };
  const agent = {
    name: cl.agentName,
    email: cl.agentEmail,
    phone: cl.agentPhone,
    license: cl.agentLicense,
    brokerage: cl.brokerage,
    brokerageAddress: cl.brokerageAddress,
  };

  return { transaction, property, buyer, seller, agent };
}

export function formsForPropertyKind(kind: PropertyKind): string[] {
  switch (kind) {
    case 'Vacant Land':
      return ['RE-24', 'RE-14', 'RE-16', 'RE-11'];
    case 'New Construction':
      return ['RE-22', 'RE-14', 'RE-26', 'RE-11'];
    case 'Commercial':
      return ['RE-23', 'RE-14', 'RE-11'];
    default:
      return ['RE-21', 'RE-14', 'RE-25', 'LeadPaint', 'RE-11'];
  }
}

export function populateFormsFromCoverLetter(cl: CoverLetter): PopulatedForm[] {
  const parts = coverLetterToEngineParts(cl);
  const engine = createIdahoFormsEngine(
    parts.transaction,
    parts.property,
    parts.buyer,
    parts.seller,
    parts.agent
  );

  const codes = cl.formCodes?.length ? cl.formCodes : formsForPropertyKind(cl.propertyKind);
  const all = engine.generateAllCriticalForms();
  const coverDoc: PopulatedForm = {
    formCode: 'COVER',
    formName: 'Transaction Cover Letter',
    populatedFields: {
      fullText: renderCoverLetterText(cl),
      buyerName: cl.buyerName,
      sellerName: cl.sellerName,
      propertyAddress: cl.address,
      purchasePrice: cl.purchasePrice,
      earnestMoney: cl.earnestMoney,
      closingDate: cl.closingDate,
      titleCompany: cl.titleCompany,
      financingType: cl.financingType,
      inspectionDays: cl.inspectionDays,
      legalDescription: cl.legalDescription,
      contingencies: cl.contingencies,
    },
    pdfReady: true,
    exportFormat: 'pdf',
    notes: 'Source document — all other forms populated from this cover letter',
  };

  const codeAliases: Record<string, string> = {
    LeadPaint: 'Lead-Based Paint',
    LEAD: 'Lead-Based Paint',
    'Lead-Based Paint': 'Lead-Based Paint',
  };

  const selected = codes
    .map((code) => {
      if (code === 'COVER') return coverDoc;
      const want = codeAliases[code] || code;
      return all.find(
        (f) =>
          f.formCode === want ||
          f.formCode === code ||
          f.formCode.replace(/-/g, '').toLowerCase() === code.replace(/-/g, '').toLowerCase()
      );
    })
    .filter(Boolean) as PopulatedForm[];

  // Always put cover first
  const withoutDupCover = selected.filter((f) => f.formCode !== 'COVER');
  return [coverDoc, ...withoutDupCover];
}

export function buildSignaturePackage(
  cl: CoverLetter,
  formCodes: string[],
  opts?: { message?: string }
): SignaturePackage {
  const signers: EnvelopeSigner[] = [];
  let order = 1;
  if (cl.buyerName && cl.buyerEmail) {
    signers.push({
      role: 'buyer',
      name: cl.buyerName,
      email: cl.buyerEmail,
      order: order++,
      status: 'pending',
    });
  }
  if (cl.sellerName && cl.sellerEmail) {
    signers.push({
      role: 'seller',
      name: cl.sellerName,
      email: cl.sellerEmail,
      order: order++,
      status: 'pending',
    });
  }
  if (cl.agentName && cl.agentEmail) {
    signers.push({
      role: 'listing_agent',
      name: cl.agentName,
      email: cl.agentEmail,
      order: order++,
      status: 'pending',
    });
  }

  return {
    id: `pkg_${Date.now().toString(36)}`,
    coverLetterId: cl.id,
    createdAt: new Date().toISOString(),
    status: 'draft',
    subject: `Please sign: ${cl.address || 'Transaction packet'} — ${cl.brokerage}`,
    message:
      opts?.message ||
      `Hello,\n\nPlease review and sign the attached Idaho real estate forms for ${cl.address || 'this property'}.\n\nPurchase price: $${(cl.purchasePrice || 0).toLocaleString()}\nClosing: ${cl.closingDate}\nTitle: ${cl.titleCompany}\n\nQuestions? Contact ${cl.agentName} at ${cl.agentPhone} or ${cl.agentEmail}.\n\nThank you,\n${cl.agentName}\n${cl.brokerage}`,
    formCodes: formCodes.filter((c) => c !== 'COVER'),
    signers,
    dealContext: {
      address: cl.address,
      buyerName: cl.buyerName,
      sellerName: cl.sellerName,
      purchasePrice: cl.purchasePrice,
      closingDate: cl.closingDate,
      brokerage: cl.brokerage,
      agentName: cl.agentName,
    },
  };
}

/** Deterministic demo hash for package integrity line on the COA. */
function packageFingerprint(pkg: SignaturePackage): string {
  const payload = [
    pkg.envelopeId || pkg.id,
    pkg.formCodes.join(','),
    ...pkg.signers.map((s) => `${s.role}:${s.email}:${s.signedAt || ''}`),
    pkg.createdAt,
  ].join('|');
  let h = 2166136261;
  for (let i = 0; i < payload.length; i++) {
    h ^= payload.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const a = (h >>> 0).toString(16).padStart(8, '0');
  const b = (Math.imul(h ^ payload.length, 0x9e3779b9) >>> 0).toString(16).padStart(8, '0');
  return a + b;
}

/**
 * Build Certificate of Authenticity when the envelope is fully signed.
 * Mirrors fields you get on a DocuSign Certificate of Completion.
 */
export function buildCertificateOfAuthenticity(pkg: SignaturePackage): CertificateOfAuthenticity {
  const issuedAt = new Date().toISOString();
  const envelopeId = pkg.envelopeId || pkg.id;
  const ctx = pkg.dealContext || {};
  const money = (n?: number) =>
    n
      ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
      : '—';

  const auditTrail: CertificateOfAuthenticity['auditTrail'] = [];
  for (const s of pkg.signers) {
    auditTrail.push({
      order: s.order,
      role: s.role,
      name: s.name,
      email: s.email,
      action: 'sent',
      timestamp: pkg.createdAt,
    });
    if (s.signedAt) {
      auditTrail.push({
        order: s.order,
        role: s.role,
        name: s.name,
        email: s.email,
        action: 'signed',
        timestamp: s.signedAt,
        ipAddress: s.ipAddress || 'demo-session',
        userAgent: s.userAgent || 'Voxli E-Sign Demo',
      });
    }
  }

  const documentHash = packageFingerprint({ ...pkg, envelopeId });
  const coaId = `coa_${envelopeId.replace(/^env_/, '')}`;
  const transactionSummary = [
    ctx.address || 'Property TBD',
    ctx.buyerName ? `Buyer: ${ctx.buyerName}` : null,
    ctx.sellerName ? `Seller: ${ctx.sellerName}` : null,
    ctx.purchasePrice != null ? `Price: ${money(ctx.purchasePrice)}` : null,
    ctx.closingDate ? `Closing: ${ctx.closingDate}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const disclaimer =
    'This Certificate of Authenticity documents the electronic signing events for the listed packet. ' +
    'In production, DocuSign (Certificate of Completion) or Adobe Acrobat Sign issues a provider-signed COC/COA with ' +
    'cryptographic seals, certificate authority chains, and verified identity evidence. This demo certificate is for ' +
    'workflow and audit-trail practice inside Voxli and is not a substitute for a qualified trust service provider certificate.';

  const fullText = [
    '═══════════════════════════════════════════════════════════',
    '  CERTIFICATE OF AUTHENTICITY (Electronic Signature Packet)',
    '  Voxli.dev · Transaction E-Sign Audit Record',
    '═══════════════════════════════════════════════════════════',
    '',
    `Certificate ID:     ${coaId}`,
    `Envelope ID:        ${envelopeId}`,
    `Package ID:         ${pkg.id}`,
    `Issued (UTC):       ${issuedAt}`,
    `Document hash:      ${documentHash}`,
    `Status:             COMPLETE — all required signers finished`,
    '',
    '───────────────────────────────────────────────────────────',
    'TRANSACTION',
    '───────────────────────────────────────────────────────────',
    transactionSummary,
    ctx.brokerage ? `Brokerage: ${ctx.brokerage}` : null,
    ctx.agentName ? `Agent: ${ctx.agentName}` : null,
    `Subject: ${pkg.subject}`,
    '',
    '───────────────────────────────────────────────────────────',
    'DOCUMENTS IN ENVELOPE',
    '───────────────────────────────────────────────────────────',
    ...(pkg.formCodes.length ? pkg.formCodes.map((c, i) => `  ${i + 1}. ${c}`) : ['  (none listed)']),
    '',
    '───────────────────────────────────────────────────────────',
    'AUDIT TRAIL (chronological events)',
    '───────────────────────────────────────────────────────────',
    ...auditTrail.map((e, i) => {
      const when = new Date(e.timestamp).toLocaleString();
      const extra =
        e.action === 'signed'
          ? ` | IP: ${e.ipAddress || '—'} | Client: ${e.userAgent || '—'}`
          : '';
      return `  ${i + 1}. [${when}] ${e.action.toUpperCase()} — ${e.name} <${e.email}> (${e.role})${extra}`;
    }),
    '',
    '───────────────────────────────────────────────────────────',
    'SIGNERS (final status)',
    '───────────────────────────────────────────────────────────',
    ...pkg.signers.map(
      (s) =>
        `  • ${s.name} <${s.email}> — ${s.role} — ${s.status.toUpperCase()}` +
        (s.signedAt ? ` at ${new Date(s.signedAt).toLocaleString()}` : '')
    ),
    '',
    '───────────────────────────────────────────────────────────',
    'DISCLAIMER',
    '───────────────────────────────────────────────────────────',
    disclaimer,
    '',
    'Equal Housing Opportunity',
    '═══════════════════════════════════════════════════════════',
  ]
    .filter((line) => line !== null)
    .join('\n');

  return {
    id: coaId,
    envelopeId,
    packageId: pkg.id,
    issuedAt,
    status: 'issued',
    documents: [...pkg.formCodes],
    transactionSummary,
    subject: pkg.subject,
    auditTrail,
    documentHash,
    fullText,
    disclaimer,
  };
}

/** Simulate send (DocuSign / Form Simplicity). Ready to swap for real API. */
export async function sendSignaturePackage(
  pkg: SignaturePackage
): Promise<SignaturePackage> {
  const envelopeId = `env_${Date.now().toString(36)}`;
  const sent: SignaturePackage = {
    ...pkg,
    status: 'sent',
    envelopeId,
    signers: pkg.signers.map((s) => ({ ...s, status: 'sent' as const })),
    signingLinks: pkg.signers.map((s) => ({
      role: s.role,
      name: s.name,
      // Demo deep-link pattern — replace with DocuSign recipient view URL
      url: `https://demo.docusign.net/Signing/StartInSession.aspx?t=${envelopeId}_${s.role}`,
    })),
  };

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(PACKAGE_KEY);
      const list: SignaturePackage[] = raw ? JSON.parse(raw) : [];
      list.unshift(sent);
      localStorage.setItem(PACKAGE_KEY, JSON.stringify(list.slice(0, 30)));
    } catch {
      /* ignore */
    }
  }

  return sent;
}

export function loadSignaturePackages(): SignaturePackage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PACKAGE_KEY);
    return raw ? (JSON.parse(raw) as SignaturePackage[]) : [];
  } catch {
    return [];
  }
}

function persistPackage(pkg: SignaturePackage) {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(PACKAGE_KEY);
    const list: SignaturePackage[] = raw ? JSON.parse(raw) : [];
    const i = list.findIndex((p) => p.id === pkg.id);
    if (i >= 0) list[i] = pkg;
    else list.unshift(pkg);
    localStorage.setItem(PACKAGE_KEY, JSON.stringify(list.slice(0, 30)));
  } catch {
    /* ignore */
  }
}

/** Mark a signer as signed (demo). Issues COA when all signers complete. */
export function markSignerSigned(pkg: SignaturePackage, role: SignerRole): SignaturePackage {
  const ua =
    typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'Voxli E-Sign Demo';
  const signers = pkg.signers.map((s) =>
    s.role === role
      ? {
          ...s,
          status: 'signed' as const,
          signedAt: new Date().toISOString(),
          ipAddress: s.ipAddress || '127.0.0.1 (demo)',
          userAgent: s.userAgent || ua,
        }
      : s
  );
  const allSigned = signers.length > 0 && signers.every((s) => s.status === 'signed');
  let next: SignaturePackage = {
    ...pkg,
    signers,
    status: allSigned ? 'completed' : 'sent',
  };
  if (allSigned) {
    next = {
      ...next,
      certificateOfAuthenticity: buildCertificateOfAuthenticity(next),
    };
  }
  persistPackage(next);
  return next;
}

/** Force-issue or refresh COA for a completed package (or if all already signed). */
export function ensureCertificateOfAuthenticity(pkg: SignaturePackage): SignaturePackage {
  const allSigned = pkg.signers.length > 0 && pkg.signers.every((s) => s.status === 'signed');
  if (!allSigned && pkg.status !== 'completed') return pkg;
  const next: SignaturePackage = {
    ...pkg,
    status: 'completed',
    certificateOfAuthenticity: buildCertificateOfAuthenticity(pkg),
  };
  persistPackage(next);
  return next;
}
