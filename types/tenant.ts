// Summit Forge - Multi-tenant foundation
// Agent-first + Brokerage oversight model

export type UserRole = 'agent' | 'team_lead' | 'broker_admin' | 'owner';

export interface Organization {
  id: string;
  name: string;
  slug: string;                    // e.g. "archibald-bagley"
  branding?: {
    logoUrl?: string;
    primaryColor?: string;
    secondaryColor?: string;
    customDomain?: string;
  };
  createdAt: string;
  plan?: 'free' | 'pro' | 'enterprise' | 'white_label';
}

export interface TenantUser {
  id: string;
  organizationId: string;
  email?: string;
  phone?: string;                  // Primary for SMS-first strategy
  name: string;
  role: UserRole;
  active: boolean;
  createdAt: string;
}

export interface Team {
  id: string;
  organizationId: string;
  name: string;
  leadUserId?: string;
  memberIds: string[];
}

/**
 * Future Supabase RLS notes:
 * - Every table that holds tenant data should have organization_id
 * - Policies: users can only see rows where organization_id matches their membership
 * - Broker admins can see all agents in their org
 * - Agents only see their own alerts, deals, etc. unless elevated
 */
