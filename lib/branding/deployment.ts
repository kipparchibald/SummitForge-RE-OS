// lib/branding/deployment.ts
// Per-deployment default branding, read from env at build time.
//
// This is what makes a white-label deployment actually white-label. Branding set
// in /settings/branding lives in the visitor's own localStorage, so a prospect
// opening a tenant's URL for the first time has nothing saved and would see
// stock SummitForge colours. These env vars give each deployment its own
// defaults, rendered server-side so the first paint is already branded.
//
// A visitor's saved branding still wins — these are defaults, not a lock.
//
// Set per Vercel project:
//   NEXT_PUBLIC_COMPANY_NAME    e.g. "Archibald-Bagley Real Estate"
//   NEXT_PUBLIC_BRAND_TAGLINE   e.g. "Your Eastern Idaho Realtors"
//   NEXT_PUBLIC_BRAND_PRIMARY   e.g. "#46237a"
//   NEXT_PUBLIC_BRAND_SECONDARY e.g. "#673da6"
//   NEXT_PUBLIC_BRAND_ACCENT    e.g. "#f6bc98"
//   NEXT_PUBLIC_BRAND_LOGO      absolute URL
//   NEXT_PUBLIC_BRAND_PHONE     e.g. "(208) 745-5911"
//   NEXT_PUBLIC_BRAND_DOMAIN    e.g. "archibaldbagley.com"

export interface DeploymentBranding {
  companyName?: string;
  tagline?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  logo?: string;
  phone?: string;
  domain?: string;
}

const HEX = /^#[0-9a-fA-F]{3,8}$/;

/** Only colours that parse are emitted — a typo must not inject CSS. */
function colour(value?: string): string | undefined {
  const v = value?.trim();
  return v && HEX.test(v) ? v : undefined;
}

export function deploymentBranding(): DeploymentBranding {
  return {
    companyName: process.env.NEXT_PUBLIC_COMPANY_NAME?.trim() || undefined,
    tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE?.trim() || undefined,
    primaryColor: colour(process.env.NEXT_PUBLIC_BRAND_PRIMARY),
    secondaryColor: colour(process.env.NEXT_PUBLIC_BRAND_SECONDARY),
    accentColor: colour(process.env.NEXT_PUBLIC_BRAND_ACCENT),
    logo: process.env.NEXT_PUBLIC_BRAND_LOGO?.trim() || undefined,
    phone: process.env.NEXT_PUBLIC_BRAND_PHONE?.trim() || undefined,
    domain: process.env.NEXT_PUBLIC_BRAND_DOMAIN?.trim() || undefined,
  };
}

export function hasDeploymentBranding(b: DeploymentBranding = deploymentBranding()): boolean {
  return Object.values(b).some(Boolean);
}

/** Inline CSS vars for the server-rendered <html>, so first paint is branded. */
export function deploymentBrandStyle(b: DeploymentBranding = deploymentBranding()): Record<string, string> {
  const style: Record<string, string> = {};
  if (b.primaryColor) style['--primary'] = b.primaryColor;
  if (b.secondaryColor) style['--secondary'] = b.secondaryColor;
  if (b.accentColor) style['--accent'] = b.accentColor;
  return style;
}
