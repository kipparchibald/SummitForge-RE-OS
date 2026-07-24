/**
 * Marketing campaign domain types for SummitForge.
 * Lifecycle: draft → pending_approval → approved → deploying → deployed | rejected | paused
 */

export type CampaignStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'deploying'
  | 'deployed'
  | 'rejected'
  | 'paused'
  | 'completed';

export type ChannelKey =
  | 'mls_idx'
  | 'meta_ads'
  | 'google_ads'
  | 'email'
  | 'sms'
  | 'direct_mail'
  | 'builder_outreach'
  | 'website'
  | 'open_house'
  | 'referral';

export type AudienceSegment = {
  id: string;
  name: string;
  description: string;
  priority: 'primary' | 'secondary';
  messagingAngle: string;
};

export type CampaignChannel = {
  key: ChannelKey;
  name: string;
  priority: 'high' | 'medium' | 'low';
  enabled: boolean;
  budget: number;
  expectedReach: string;
  cpaTarget?: string;
  tactics: string[];
  complianceNotes?: string[];
};

export type CreativeAsset = {
  id: string;
  type: 'listing_copy' | 'social' | 'email' | 'sms' | 'ad_headline' | 'flyer' | 'video_script';
  channel?: ChannelKey | 'multi';
  title: string;
  body: string;
  cta?: string;
  approved?: boolean;
};

export type CampaignWeek = {
  week: number;
  label: string;
  objectives: string[];
  tasks: string[];
};

export type CampaignKpi = {
  name: string;
  target: string;
  measurement: string;
};

export type CampaignBrief = {
  property: {
    id?: string;
    address: string;
    acres?: number;
    price?: number;
    propertyType?: string;
    city?: string;
    highlights?: string[];
  };
  /** e.g. generate leads, sell lot, attract builders */
  primaryGoal: string;
  secondaryGoals?: string[];
  budgetCap?: number;
  timelineDays?: number;
  tone?: 'premium' | 'friendly' | 'investor' | 'family';
  targetAudienceHints?: string[];
  brokerageName?: string;
  agentName?: string;
  complianceMarket?: string;
};

export type MarketingCampaign = {
  id: string;
  status: CampaignStatus;
  createdAt: string;
  updatedAt: string;
  approvedAt?: string;
  deployedAt?: string;
  brief: CampaignBrief;
  /** One-line campaign concept */
  concept: string;
  /** Positioning statement */
  positioning: string;
  goals: string[];
  audiences: AudienceSegment[];
  channels: CampaignChannel[];
  assets: CreativeAsset[];
  calendar: CampaignWeek[];
  budgetTotal: number;
  budgetBreakdown: { channel: string; amount: number }[];
  kpis: CampaignKpi[];
  fairHousingChecklist: string[];
  risks: string[];
  nextActions: string[];
  /** Freeform AI strategy narrative */
  aiStrategy?: string;
  /** User feedback for revision loop */
  revisionNotes?: string;
  /** Deploy result summary */
  deployLog?: {
    status: string;
    actions: string[];
    channels: string[];
    note: string;
    timestamp: string;
  };
};

export type CampaignBuildResult = {
  campaign: MarketingCampaign;
  summary: string;
  needsApproval: true;
};

export type ApprovalAction = 'approve' | 'reject' | 'request_changes';

export type DeployResult = {
  ok: boolean;
  campaign: MarketingCampaign;
  message: string;
  simulated: boolean;
};

/** Legacy plan shape (AI assistants + older clients) */
export type MarketingPlan = {
  propertyId: string;
  goals: string[];
  channels: Array<{
    name: string;
    priority: 'high' | 'medium' | 'low';
    estimatedCost: number;
    expectedReach: string;
  }>;
  contentStrategy: {
    listingDescription: string;
    socialPosts: string[];
    emailSequence: string[];
    flyerIdeas: string[];
  };
  timeline: {
    week1: string[];
    week2: string[];
    ongoing: string[];
  };
  budgetEstimate: number;
  kpis: string[];
  campaign?: MarketingCampaign;
  aiStrategy?: string;
  error?: string;
  message?: string;
};
