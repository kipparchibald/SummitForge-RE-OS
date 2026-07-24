/**
 * Best-practice marketing campaign engine for Eastern Idaho real estate.
 *
 * Principles encoded here:
 * 1. Goal → audience → message → channel → creative → calendar → KPI
 * 2. Fair Housing / truth-in-advertising guardrails on every plan
 * 3. Budget allocation by priority (not equal-split vanity)
 * 4. Human approval gate before any deploy
 * 5. Land vs residential playbooks (builders, plats, legacy story)
 */

import type {
  AudienceSegment,
  CampaignBrief,
  CampaignChannel,
  CampaignKpi,
  CampaignWeek,
  CreativeAsset,
  MarketingCampaign,
} from './types';

function uid(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function money(n: number) {
  return Math.round(n);
}

function isLand(brief: CampaignBrief): boolean {
  const t = (brief.property.propertyType || '').toLowerCase();
  if (/land|vacant|farm|ranch|acreage/.test(t)) return true;
  return (brief.property.acres || 0) >= 2 && !(t.includes('single') || t.includes('home'));
}

function defaultBudget(brief: CampaignBrief, land: boolean): number {
  if (brief.budgetCap && brief.budgetCap > 0) return brief.budgetCap;
  const price = brief.property.price || 0;
  // Industry rule of thumb: ~0.5–1% of list for aggressive land push, floor for local
  const pct = land ? 0.006 : 0.004;
  const fromPrice = price > 0 ? price * pct : land ? 1200 : 800;
  return money(Math.min(Math.max(fromPrice, land ? 750 : 500), 5000));
}

function buildAudiences(brief: CampaignBrief, land: boolean): AudienceSegment[] {
  const hints = brief.targetAudienceHints || [];
  if (land) {
    return [
      {
        id: 'aud_builders',
        name: 'Local builders & small developers',
        description: 'Volume and custom builders seeking shovel-ready or subdivisible ground in Jefferson / Madison / Bonneville.',
        priority: 'primary',
        messagingAngle: 'Yield, absorption, and entitlement path — numbers first, story second.',
      },
      {
        id: 'aud_endbuyers',
        name: 'End buyers building a home',
        description: 'Families and professionals wanting acreage near Rigby, Ririe, Rexburg, Idaho Falls.',
        priority: 'primary',
        messagingAngle: 'Coming home — place for kids, quiet, legacy.',
      },
      {
        id: 'aud_investors',
        name: 'Land investors / 1031',
        description: 'Regional capital looking for hold or light-entitlement plays.',
        priority: 'secondary',
        messagingAngle: 'Scarcity of titled inventory + growth corridor fundamentals.',
      },
      ...(hints.length
        ? [
            {
              id: 'aud_custom',
              name: 'Brief-specified segment',
              description: hints.join('; '),
              priority: 'secondary' as const,
              messagingAngle: 'Speak directly to stated buyer needs.',
            },
          ]
        : []),
    ];
  }
  return [
    {
      id: 'aud_local_buyers',
      name: 'Move-up / first-time local buyers',
      description: 'Eastern Idaho households pre-approved or near pre-approval.',
      priority: 'primary',
      messagingAngle: 'Lifestyle fit, schools/commute, transparent pricing.',
    },
    {
      id: 'aud_relocators',
      name: 'Relocators (out of market)',
      description: 'Inbound from higher-cost states seeking Idaho quality of life.',
      priority: 'secondary',
      messagingAngle: 'Value vs coastal markets + community welcome.',
    },
  ];
}

function buildChannels(brief: CampaignBrief, land: boolean, budget: number): CampaignChannel[] {
  // Weighted allocation: high-intent + owned first
  const weights: { key: CampaignChannel['key']; name: string; w: number; priority: CampaignChannel['priority']; reach: string; tactics: string[]; compliance?: string[] }[] = land
    ? [
        {
          key: 'mls_idx',
          name: 'MLS + IDX / brokerage site',
          w: 0.05,
          priority: 'high',
          reach: 'All co-op agents + public IDX',
          tactics: ['Full remarks + media', 'Agent blast day 1', 'Featured on brokerage land search'],
        },
        {
          key: 'builder_outreach',
          name: 'Builder / developer outreach',
          w: 0.15,
          priority: 'high',
          reach: '15–30 warm builder relationships',
          tactics: ['Personal email + PDF packet', 'Plat concept one-pager', 'Offer window for bulk pricing'],
          compliance: ['No exclusivity claims without written agreement'],
        },
        {
          key: 'meta_ads',
          name: 'Meta (FB/IG) ads',
          w: 0.28,
          priority: 'high',
          reach: 'Geo: 40mi + lookalikes builders',
          tactics: ['Carousel drone + map', 'Lead form to CRM', 'Retarget site visitors 14d'],
          compliance: ['No demographic exclusion by protected class', 'Use location + interest not familial status'],
        },
        {
          key: 'google_ads',
          name: 'Google Search ads',
          w: 0.2,
          priority: 'high',
          reach: 'High-intent “land for sale [city]”',
          tactics: ['Exact + phrase match', 'Landing page with pro forma teaser', 'Call extensions'],
        },
        {
          key: 'email',
          name: 'Email nurture',
          w: 0.12,
          priority: 'high',
          reach: 'Buyer + builder lists',
          tactics: ['3-touch sequence', 'Segment builders vs end-buyers', 'Soft CTA to showing/plat call'],
        },
        {
          key: 'website',
          name: 'Landing page / rigby lots style',
          w: 0.08,
          priority: 'high',
          reach: 'Direct + campaign traffic',
          tactics: ['Single CTA', 'Mobile-first', 'Embed map + acres + price'],
        },
        {
          key: 'direct_mail',
          name: 'Direct mail / flyer drop',
          w: 0.07,
          priority: 'medium',
          reach: 'Neighboring parcels + builder offices',
          tactics: ['QR to landing page', '“Build your legacy” creative'],
        },
        {
          key: 'sms',
          name: 'SMS alerts (opt-in)',
          w: 0.05,
          priority: 'medium',
          reach: 'Warm CRM opt-ins only',
          tactics: ['Price drop / open house / plat ready'],
          compliance: ['TCPA: only consented numbers'],
        },
      ]
    : [
        {
          key: 'mls_idx',
          name: 'MLS + IDX',
          w: 0.1,
          priority: 'high',
          reach: 'Co-op + public',
          tactics: ['Professional photos day 0', 'Coming soon window if strategy fits'],
        },
        {
          key: 'meta_ads',
          name: 'Meta ads',
          w: 0.3,
          priority: 'high',
          reach: 'Geo + housing interest',
          tactics: ['Video walkthrough', 'Lead gen form'],
          compliance: ['Fair Housing: no exclusion by protected class'],
        },
        {
          key: 'google_ads',
          name: 'Google ads',
          w: 0.15,
          priority: 'medium',
          reach: 'Brand + neighborhood search',
          tactics: ['Remarketing', 'Call now'],
        },
        {
          key: 'email',
          name: 'Email nurture',
          w: 0.15,
          priority: 'high',
          reach: 'CRM matches',
          tactics: ['3-email sequence', 'Open house invite'],
        },
        {
          key: 'open_house',
          name: 'Open house / private tour',
          w: 0.15,
          priority: 'high',
          reach: 'Local walk-ins + booked tours',
          tactics: ['Signage', 'Agent open house', 'Feedback loop to CRM'],
        },
        {
          key: 'website',
          name: 'Listing site',
          w: 0.1,
          priority: 'medium',
          reach: 'SEO + paid landers',
          tactics: ['Virtual tour embed'],
        },
        {
          key: 'referral',
          name: 'Agent / sphere referral',
          w: 0.05,
          priority: 'medium',
          reach: 'Sphere + co-op',
          tactics: ['Broker open', 'Commission clarity'],
        },
      ];

  // Normalize weights to budget (min $0 for free channels)
  const freeKeys = new Set(['mls_idx', 'website', 'referral']);
  let remaining = budget;
  const channels: CampaignChannel[] = weights.map((w) => {
    let amount = 0;
    if (!freeKeys.has(w.key)) {
      amount = money(budget * w.w);
      remaining -= amount;
    }
    return {
      key: w.key,
      name: w.name,
      priority: w.priority,
      enabled: true,
      budget: Math.max(0, amount),
      expectedReach: w.reach,
      tactics: w.tactics,
      complianceNotes: w.compliance,
      cpaTarget: land ? '$45–90 / qualified lead' : '$35–75 / showing',
    };
  });

  // Dump rounding remainder into highest paid channel
  if (remaining !== 0) {
    const top = channels.find((c) => c.key === 'meta_ads') || channels.find((c) => c.budget > 0);
    if (top) top.budget = money(top.budget + remaining);
  }

  return channels;
}

function buildAssets(brief: CampaignBrief, land: boolean): CreativeAsset[] {
  const addr = brief.property.address || 'this property';
  const acres = brief.property.acres;
  const price = brief.property.price
    ? `$${brief.property.price.toLocaleString()}`
    : 'price upon request';
  const agent = brief.agentName || 'your Archibald-Bagley agent';
  const brokerage = brief.brokerageName || 'Archibald-Bagley Real Estate';
  const acresStr = acres ? `${acres} acres` : 'a special parcel';

  const listing = land
    ? `Exceptional ${acresStr} in Eastern Idaho — ${addr}. More than dirt: a canvas for the life (or project) you've been planning. Strong access, clear pricing at ${price}, and room to build with intention. ${brokerage} is ready with feasibility context and next steps. Equal Housing Opportunity.`
    : `Thoughtfully positioned home at ${addr}. Listed at ${price}. Schedule a private tour with ${agent}. Equal Housing Opportunity.`;

  const socialLand = [
    {
      title: 'Awareness — legacy',
      body: `${acresStr} near the Teton corridor. Quiet. Buildable. Ready for the right steward. DM for details on ${addr}.`,
      cta: 'Message us',
    },
    {
      title: 'Builders — yield',
      body: `Builders: ${acresStr} with subdivision upside potential. Ask for the concept plat & max-offer framing. ${addr} · ${price}.`,
      cta: 'Request packet',
    },
    {
      title: 'Proof / urgency',
      body: `Eastern Idaho land inventory is tight in the pockets that matter. ${addr} is live. Tour this week with ${agent}.`,
      cta: 'Book tour',
    },
  ];

  const socialHome = [
    {
      title: 'Lifestyle',
      body: `Coming home looks like this — ${addr}. Private tours this week.`,
      cta: 'Schedule tour',
    },
    {
      title: 'Value',
      body: `New to market: ${addr} at ${price}. See why locals are paying attention.`,
      cta: 'View details',
    },
  ];

  const social = land ? socialLand : socialHome;

  const emails = [
    {
      title: 'Email 1 — Introduce',
      body: `Subject: New ${land ? 'land' : 'listing'} opportunity — ${addr}\n\nHi {{first_name}},\n\nWe just brought ${land ? acresStr + ' ' : ''}${addr} to market at ${price}. ${land ? 'Happy to share a quick feasibility snapshot or plat concept if you are evaluating for build or hold.' : 'Would love to walk you through the home this week.'}\n\n— ${agent}\n${brokerage}`,
      cta: 'Reply to this email',
    },
    {
      title: 'Email 2 — Value',
      body: `Subject: Why ${addr} stands out\n\nQuick update: ${land ? 'Comparable acreage in this corridor has been moving when the numbers pencil — happy to compare comps and residual value.' : 'Showings are starting; feedback so far has been strong on layout and light.'}\n\nOpen to a 15-minute call?\n\n— ${agent}`,
      cta: 'Book a call',
    },
    {
      title: 'Email 3 — Soft close',
      body: `Subject: Still exploring land/homes in Eastern Idaho?\n\nIf ${addr} is still on your shortlist, let's get you on site before the weekend. I can also connect you with ${land ? 'plat/feasibility context' : 'lender options'}.\n\n— ${agent}`,
      cta: 'Confirm a time',
    },
  ];

  const assets: CreativeAsset[] = [
    {
      id: uid('asset'),
      type: 'listing_copy',
      channel: 'mls_idx',
      title: 'MLS / IDX remarks',
      body: listing,
      cta: 'Contact listing agent',
    },
    ...social.map((s, i) => ({
      id: uid('asset'),
      type: 'social' as const,
      channel: 'meta_ads' as const,
      title: s.title,
      body: s.body,
      cta: s.cta,
    })),
    ...emails.map((e) => ({
      id: uid('asset'),
      type: 'email' as const,
      channel: 'email' as const,
      title: e.title,
      body: e.body,
      cta: e.cta,
    })),
    {
      id: uid('asset'),
      type: 'ad_headline',
      channel: 'google_ads',
      title: 'Google RSA headlines',
      body: land
        ? [
            `${acresStr} for Sale | Eastern Idaho`,
            `Buildable Land near Rigby / IF`,
            `Land for Builders & Families`,
            `Tour ${addr.split(',')[0]}`,
            `Priced at ${price}`,
          ].join('\n')
        : [
            `Homes for Sale | ${addr.split(',')[0]}`,
            `Tour This Week`,
            `Listed at ${price}`,
          ].join('\n'),
    },
    {
      id: uid('asset'),
      type: 'flyer',
      channel: 'direct_mail',
      title: 'Flyer / one-pager concept',
      body: land
        ? `Hero: drone + simple plat concept. Headline: “Build Your Legacy Here.” Stats: acres, price, county, utilities notes. QR → landing page. EHO logo.`
        : `Hero photo. Headline: “Come Home to ${addr.split(',')[0]}.” Beds/baths/price. QR to listing. EHO logo.`,
    },
    {
      id: uid('asset'),
      type: 'sms',
      channel: 'sms',
      title: 'Opt-in SMS blast',
      body: `${brokerage}: ${land ? acresStr + ' land' : 'New listing'} at ${addr} now live (${price}). Reply YES for details. Msg&data rates may apply. STOP to opt out.`,
      cta: 'Reply YES',
    },
    {
      id: uid('asset'),
      type: 'video_script',
      channel: 'meta_ads',
      title: '15s vertical video script',
      body: land
        ? `0–3s: aerial over parcel. VO: “This is ${acresStr} of Eastern Idaho possibility.” 3–10s: ground access + map pin. 10–15s: price + CTA “DM for plat packet.”`
        : `0–3s: curb appeal. 3–12s: key rooms. 12–15s: address + “Book a tour.”`,
    },
  ];

  return assets;
}

function buildCalendar(brief: CampaignBrief, land: boolean): CampaignWeek[] {
  const days = brief.timelineDays || 21;
  const weeks = Math.max(2, Math.ceil(days / 7));
  const cal: CampaignWeek[] = [
    {
      week: 1,
      label: 'Launch',
      objectives: ['Go live on owned + paid', 'Seed CRM + builder lists', 'Baseline creative live'],
      tasks: [
        'Publish MLS / IDX with full media',
        'Launch landing page + tracking UTM',
        'Activate Meta + Google with dayparting',
        'Send Email 1 to warm segments',
        land ? 'Personal outreach to top 10 builders' : 'Agent open / private tours booked',
      ],
    },
    {
      week: 2,
      label: 'Optimize',
      objectives: ['Double down on winners', 'Kill underperforming ads', 'Deepen conversations'],
      tasks: [
        'Review CTR / CPL; pause weak creatives',
        'Boost best social post + lookalike',
        'Send Email 2 (value / comps)',
        land ? 'Share plat/feasibility packet on request' : 'Collect showing feedback → CRM notes',
        'Retarget website visitors',
      ],
    },
  ];
  if (weeks >= 3) {
    cal.push({
      week: 3,
      label: 'Convert & expand',
      objectives: ['Convert warm leads', 'Expand reach if needed', 'Report ROI'],
      tasks: [
        'Email 3 soft close + SMS to opted-in',
        'Price / terms strategy check with seller',
        'Publish testimonial / social proof if available',
        'Weekly KPI report to stakeholder',
      ],
    });
  }
  if (weeks >= 4) {
    cal.push({
      week: 4,
      label: 'Sustain',
      objectives: ['Maintain pipeline', 'Refresh creative'],
      tasks: ['Creative refresh', 'Lookalike expansion', 'Sphere / referral push'],
    });
  }
  return cal;
}

function buildKpis(land: boolean): CampaignKpi[] {
  return land
    ? [
        { name: 'Qualified leads', target: '12+ in 21 days', measurement: 'CRM stage ≥ qualified' },
        { name: 'Builder conversations', target: '5 meaningful', measurement: 'Logged calls / meetings' },
        { name: 'Cost per qualified lead', target: '< $90', measurement: 'Ad spend / qualified' },
        { name: 'Showing or site tours', target: '4+', measurement: 'Calendar events' },
        { name: 'Offer trajectory', target: '1 serious path', measurement: 'LOI / offer received' },
      ]
    : [
        { name: 'Showings', target: '8+ in 14 days', measurement: 'Showing calendar' },
        { name: 'Qualified buyers', target: '6+', measurement: 'CRM active search' },
        { name: 'Cost per lead', target: '< $75', measurement: 'Ad spend / lead' },
        { name: 'Online engagement', target: '3%+ CTR on ads', measurement: 'Ad platform' },
      ];
}

const FAIR_HOUSING = [
  'Equal Housing Opportunity statement on public creatives and landing pages',
  'No preference/limitation by race, color, religion, sex, handicap, familial status, or national origin',
  'Avoid school-district or “family-friendly” coded language that implies familial status preference',
  'Use location radius and interest targeting — never protected-class exclusions',
  'All claims (views, buildability, utilities) must be supportable; use “buyer to verify” where needed',
  'SMS only to TCPA-consented contacts; include STOP language',
  'Idaho brokerage identification on ads as required (agent + brokerage name)',
];

/**
 * Build a complete campaign ready for human review (status: pending_approval).
 */
export function buildCampaignFromBrief(brief: CampaignBrief, aiStrategy?: string): MarketingCampaign {
  const land = isLand(brief);
  const budget = defaultBudget(brief, land);
  const channels = buildChannels(brief, land, budget);
  const assets = buildAssets(brief, land);
  const calendar = buildCalendar(brief, land);
  const audiences = buildAudiences(brief, land);
  const kpis = buildKpis(land);
  const now = new Date().toISOString();

  const concept = land
    ? `“Land with a future” — dual-track campaign for builders (yield) and end buyers (legacy), anchored on ${brief.property.address}.`
    : `“Come home here” — lifestyle-led campaign for ${brief.property.address} with strong local + inbound reach.`;

  const positioning = land
    ? `Position as scarce Eastern Idaho ground with clear next steps (tour, numbers, tour) — premium but practical, never hype.`
    : `Position as the clear best fit for the target buyer’s stage of life — warm, specific, low-pressure.`;

  const goals = [
    brief.primaryGoal || (land ? 'Generate qualified land leads and builder interest' : 'Generate showings and a clean offer path'),
    ...(brief.secondaryGoals || []),
    land ? 'Educate market with feasibility/plat context' : 'Protect seller timeline with consistent feedback',
  ];

  const risks = [
    land ? 'Over-promising on entitlements without PLS/P&Z verification' : 'Under-pricing competitive pressure in first 10 days',
    'Ad fatigue after day 10 without creative refresh',
    'Leads stalling without CRM follow-up SLA (< 5 minutes ideal)',
    brief.budgetCap && brief.budgetCap < 400 ? 'Budget may be too low for paid channels — lean into outreach + MLS' : 'Channel overspend if CPL not monitored weekly',
  ];

  return {
    id: uid('camp'),
    status: 'pending_approval',
    createdAt: now,
    updatedAt: now,
    brief,
    concept,
    positioning,
    goals,
    audiences,
    channels,
    assets,
    calendar,
    budgetTotal: budget,
    budgetBreakdown: channels
      .filter((c) => c.budget > 0)
      .map((c) => ({ channel: c.name, amount: c.budget })),
    kpis,
    fairHousingChecklist: FAIR_HOUSING,
    risks,
    nextActions: [
      'Review concept, budget, and creatives below',
      'Toggle off any channels you do not want',
      'Approve to unlock Deploy — or request changes with notes',
      'After deploy, monitor KPIs in week-1 checklist',
    ],
    aiStrategy,
  };
}

export function campaignSummary(c: MarketingCampaign): string {
  const enabled = c.channels.filter((ch) => ch.enabled).length;
  return `${c.concept} · $${c.budgetTotal.toLocaleString()} budget · ${enabled} channels · ${c.assets.length} assets · status: ${c.status}`;
}
