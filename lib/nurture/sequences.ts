/**
 * Automated nurture sequences — MoxiWorks / Compass style drips.
 * SMS-first (phone primary), email secondary when captured.
 * Sequences are pure data + generators; delivery hooks into notifications.
 */

export type NurtureChannel = 'sms' | 'email' | 'in-app';

export type NurtureStep = {
  dayOffset: number; // days after enrollment
  channel: NurtureChannel;
  subject?: string; // email only
  body: string;
  /** Template tokens: {{name}}, {{agent}}, {{area}}, {{budget}}, {{interest}} */
};

export type NurtureSequence = {
  id: string;
  name: string;
  description: string;
  triggerStage: 'lead' | 'qualified' | 'nurture' | 'active' | 'under_contract' | 'closed';
  steps: NurtureStep[];
};

export type NurtureEnrollment = {
  id: string;
  contactId: string;
  sequenceId: string;
  enrolledAt: string;
  nextStepIndex: number;
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  lastSentAt?: string;
};

export type ContactContext = {
  name: string;
  firstName?: string;
  agent?: string;
  area?: string;
  budget?: number;
  interest?: string;
  phone?: string;
  email?: string;
};

export const NURTURE_SEQUENCES: NurtureSequence[] = [
  {
    id: 'new-lead-welcome',
    name: 'New Lead Welcome',
    description: '3-touch intro over 7 days for fresh web / portal leads',
    triggerStage: 'lead',
    steps: [
      {
        dayOffset: 0,
        channel: 'sms',
        body: 'Hi {{firstName}} — this is {{agent}} with Archibald-Bagley. Got your interest in {{interest}}. Happy to text options in {{area}} or jump on a quick call. Reply STOP to opt out.',
      },
      {
        dayOffset: 2,
        channel: 'sms',
        body: '{{firstName}}, a few new {{area}} listings matched what you described. Want me to send 2–3 links, or schedule a drive-by this weekend?',
      },
      {
        dayOffset: 7,
        channel: 'email',
        subject: 'Still looking in {{area}}?',
        body: 'Hi {{name}},\n\nJust checking in — the {{area}} market moves quickly under {{budget}}. I can set a private alert so new matches hit your phone the same day.\n\n— {{agent}}\nArchibald-Bagley Real Estate',
      },
    ],
  },
  {
    id: 'active-search-weekly',
    name: 'Active Search Weekly',
    description: 'Keep active buyers warm with weekly value touches',
    triggerStage: 'active',
    steps: [
      {
        dayOffset: 0,
        channel: 'sms',
        body: '{{firstName}} — your SummitForge portal is live. New MLS matches for {{area}} will show up there first. Text me anytime to request a showing.',
      },
      {
        dayOffset: 7,
        channel: 'sms',
        body: 'Weekly pulse: inventory in {{area}} shifted this week. I flagged anything under {{budget}} that fits {{interest}}. Open your portal or reply YES for a recap.',
      },
      {
        dayOffset: 14,
        channel: 'email',
        subject: 'Your {{area}} market brief',
        body: 'Hi {{name}},\n\nHere is a short brief on pricing and days-on-market for homes matching {{interest}}.\n\nOpen your client portal anytime for live matches, or reply to this email if you want a CMA on a specific address.\n\n— {{agent}}',
      },
    ],
  },
  {
    id: 'under-contract-care',
    name: 'Under Contract Care',
    description: 'Inspection → appraisal → closing cadence',
    triggerStage: 'under_contract',
    steps: [
      {
        dayOffset: 0,
        channel: 'sms',
        body: 'Congrats {{firstName}} — we are under contract. I will text deadlines (inspection, appraisal, closing) so nothing sneaks up. Portal has your checklist.',
      },
      {
        dayOffset: 3,
        channel: 'sms',
        body: 'Reminder: inspection window is active. Tell me if you want vendor recommendations in Jefferson County.',
      },
      {
        dayOffset: 10,
        channel: 'email',
        subject: 'Closing week checklist',
        body: 'Hi {{name}},\n\nWe are approaching closing. Confirm wire instructions only with your title company, and review the final walk-through list in your portal.\n\nI am a text away.\n\n— {{agent}}',
      },
    ],
  },
  {
    id: 'past-client-sphere',
    name: 'Past Client Sphere',
    description: 'Quarterly stay-in-touch for closed clients',
    triggerStage: 'closed',
    steps: [
      {
        dayOffset: 30,
        channel: 'sms',
        body: 'Hi {{firstName}} — {{agent}} here. Hope the new place is feeling like home. If a neighbor ever asks who to call, I would be honored. Enjoy!',
      },
      {
        dayOffset: 90,
        channel: 'email',
        subject: 'How is the home treating you?',
        body: 'Hi {{name}},\n\nQuick note from {{agent}} at Archibald-Bagley. If you need a contractor referral, a market update, or help for family relocating to Eastern Idaho, I am here.\n\nThank you again for trusting us.',
      },
    ],
  },
];

export function renderTemplate(template: string, ctx: ContactContext): string {
  const first =
    ctx.firstName ||
    (ctx.name || '').split(/\s+/)[0] ||
    'there';
  const budget =
    ctx.budget != null
      ? `$${ctx.budget.toLocaleString()}`
      : 'your budget';

  return template
    .replace(/\{\{name\}\}/g, ctx.name || 'there')
    .replace(/\{\{firstName\}\}/g, first)
    .replace(/\{\{agent\}\}/g, ctx.agent || 'Kipp Archibald')
    .replace(/\{\{area\}\}/g, ctx.area || 'Eastern Idaho')
    .replace(/\{\{budget\}\}/g, budget)
    .replace(/\{\{interest\}\}/g, ctx.interest || 'your home search');
}

export function getSequence(id: string): NurtureSequence | undefined {
  return NURTURE_SEQUENCES.find((s) => s.id === id);
}

export function sequencesForStage(
  stage: NurtureSequence['triggerStage']
): NurtureSequence[] {
  return NURTURE_SEQUENCES.filter((s) => s.triggerStage === stage);
}

/**
 * Given enrollment + contact, return the next message that is due (or null).
 */
export function nextDueStep(
  enrollment: NurtureEnrollment,
  sequence: NurtureSequence,
  now = new Date()
): { step: NurtureStep; index: number; rendered: (ctx: ContactContext) => { subject?: string; body: string } } | null {
  if (enrollment.status !== 'active') return null;
  const idx = enrollment.nextStepIndex;
  if (idx >= sequence.steps.length) return null;

  const step = sequence.steps[idx];
  const enrolled = new Date(enrollment.enrolledAt);
  const due = new Date(enrolled);
  due.setDate(due.getDate() + step.dayOffset);

  if (now < due) return null;

  return {
    step,
    index: idx,
    rendered: (ctx: ContactContext) => ({
      subject: step.subject ? renderTemplate(step.subject, ctx) : undefined,
      body: renderTemplate(step.body, ctx),
    }),
  };
}

const ENROLL_KEY = 'sf_nurture_enrollments';

export function loadEnrollments(): NurtureEnrollment[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ENROLL_KEY);
    return raw ? (JSON.parse(raw) as NurtureEnrollment[]) : [];
  } catch {
    return [];
  }
}

export function saveEnrollments(list: NurtureEnrollment[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(ENROLL_KEY, JSON.stringify(list));
}

export function enrollContact(
  contactId: string,
  sequenceId: string
): NurtureEnrollment {
  const enrollment: NurtureEnrollment = {
    id: `nurture_${Date.now()}`,
    contactId,
    sequenceId,
    enrolledAt: new Date().toISOString(),
    nextStepIndex: 0,
    status: 'active',
  };
  const all = loadEnrollments().filter(
    (e) => !(e.contactId === contactId && e.sequenceId === sequenceId && e.status === 'active')
  );
  all.push(enrollment);
  saveEnrollments(all);
  return enrollment;
}
