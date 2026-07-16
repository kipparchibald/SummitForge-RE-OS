// lib/branding/extract.ts
// Pulls real branding out of a brokerage's public website HTML.
//
// This is the white-label on-ramp: point it at any brokerage's site and it
// returns their actual colors, logo, and contact details — nothing invented.
// Every field reports whether it was extracted or left empty, so the UI can be
// honest about what it actually found (see ExtractedBranding.found).
//
// Pure string parsing, no DOM/cheerio dependency.

export interface ExtractedBranding {
  logo: string;
  companyName: string;
  tagline: string;
  phone: string;
  facebook: string;
  customDomain: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  /** Field names that were genuinely extracted from the page. */
  found: string[];
  /** Field names the caller must fill in — nothing credible was found. */
  missing: string[];
}

const NEUTRAL = /^#(fff(fff)?|000(000)?|f{3,6}|e{3,6}|fafafa|fbfbfb|f6f6f6|eeeeee|dddddd|cccccc|999999|888888|666666|333333|111111|1a1a1a|191919)$/i;

function isNeutral(hex: string): boolean {
  const h = hex.toLowerCase();
  if (NEUTRAL.test(h)) return true;
  // Greys: R≈G≈B
  const m = h.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (!m) return false;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 18; // low saturation => grey/near-white/near-black
}

function inlineCss(html: string): string {
  const blocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  return blocks.join('\n');
}

/**
 * Theme palettes, best source first:
 *  1. Astra (--ast-global-color-N) — very common on brokerage WordPress sites
 *  2. Generic custom properties (--primary / --brand / --accent)
 *  3. Dominant non-neutral colour in the page's own CSS
 */
function extractColors(html: string): {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  source: string;
} | null {
  const css = inlineCss(html);

  // 1. Astra global palette
  const astra: Record<number, string> = {};
  for (const m of css.matchAll(/--ast-global-color-(\d)\s*:\s*(#[0-9a-fA-F]{3,6})/g)) {
    astra[Number(m[1])] = m[2].toLowerCase();
  }
  const astraPrimary = [0, 2, 7].map((i) => astra[i]).find((c) => c && !isNeutral(c));
  if (astraPrimary) {
    const secondary = [1, 3].map((i) => astra[i]).find((c) => c && !isNeutral(c) && c !== astraPrimary);
    const accent = [6, 4].map((i) => astra[i]).find((c) => c && !isNeutral(c) && c !== astraPrimary && c !== secondary);
    return {
      primaryColor: astraPrimary,
      secondaryColor: secondary || astraPrimary,
      accentColor: accent || secondary || astraPrimary,
      source: 'astra-theme-palette',
    };
  }

  // 2. Generic custom properties
  const named: Record<string, string> = {};
  for (const m of css.matchAll(/--([a-z0-9-]*(?:primary|brand|accent|secondary)[a-z0-9-]*)\s*:\s*(#[0-9a-fA-F]{3,6})/gi)) {
    named[m[1].toLowerCase()] = m[2].toLowerCase();
  }
  const pick = (kw: string) =>
    Object.entries(named).find(([k, v]) => k.includes(kw) && !isNeutral(v))?.[1];
  const gPrimary = pick('primary') || pick('brand');
  if (gPrimary) {
    return {
      primaryColor: gPrimary,
      secondaryColor: pick('secondary') || gPrimary,
      accentColor: pick('accent') || pick('secondary') || gPrimary,
      source: 'css-custom-properties',
    };
  }

  // 3. Dominant non-neutral colour
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/#[0-9a-fA-F]{6}/g)) {
    const h = m[0].toLowerCase();
    if (isNeutral(h)) continue;
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0 && ranked[0][1] >= 3) {
    return {
      primaryColor: ranked[0][0],
      secondaryColor: ranked[1]?.[0] || ranked[0][0],
      accentColor: ranked[2]?.[0] || ranked[1]?.[0] || ranked[0][0],
      source: 'dominant-css-colour',
    };
  }

  return null;
}

// Third-party images that are never the brokerage's own logo. MLS/IDX
// compliance logos are the trap here: their URLs contain "logos", so a naive
// /logo/ match grabs the MLS mark instead of the brokerage's.
const NOT_A_LOGO = /(\/mls\/|idx_|\/listings?\/|cloudfront\.net\/listings|gravatar|facebook|twitter|instagram|googletagmanager|\/emoji\/|spinner|placeholder)/i;

function extractLogo(html: string, siteUrl: URL): string {
  const candidates: { src: string; score: number }[] = [];

  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const srcM = tag.match(/\ssrc=["']([^"']+)["']/i);
    if (!srcM) continue;
    let src = srcM[1];
    if (src.startsWith('//')) src = `${siteUrl.protocol}${src}`;
    else if (src.startsWith('/')) src = `${siteUrl.origin}${src}`;
    if (!/^https?:\/\//i.test(src)) continue;
    if (NOT_A_LOGO.test(src)) continue;
    if (!/\.(png|svg|jpe?g|webp)(\?|$)/i.test(src)) continue;

    let score = 0;
    // Hosted by the brokerage itself, not a listing CDN.
    if (src.includes(siteUrl.hostname)) score += 4;
    if (/wp-content\/uploads/i.test(src)) score += 2;
    if (/logo|brand/i.test(src)) score += 3;
    // Filename echoing the domain, e.g. archibald-bagley-150x65.png
    const domainWord = siteUrl.hostname.replace(/^www\./, '').split('.')[0];
    if (domainWord.length > 4 && src.toLowerCase().includes(domainWord.slice(0, 6))) score += 4;
    // Logos sit near the top of the document.
    if (m.index != null && m.index < html.length * 0.2) score += 2;
    // Logos are small and wide.
    const w = Number(tag.match(/\swidth=["'](\d+)["']/i)?.[1] || 0);
    const h = Number(tag.match(/\sheight=["'](\d+)["']/i)?.[1] || 0);
    if (w && h && w <= 400 && h <= 200) score += 2;
    if (/class=["'][^"']*(logo|brand|site-title|header)[^"']*["']/i.test(tag)) score += 3;

    candidates.push({ src, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  // Require real evidence rather than returning the first image on the page.
  return candidates.length > 0 && candidates[0].score >= 5 ? candidates[0].src : '';
}

/** tel: hrefs arrive as bare digits — present them the way the site displays them. */
function formatPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').replace(/^1(?=\d{10}$)/, '');
  if (d.length !== 10) return raw.trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function extractCompanyName(html: string, siteUrl: URL): string {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  if (!title) return '';
  // "East Idaho Real Estate Agency - Archibald-Bagley Real Estate" -> last segment
  const parts = title.split(/\s+[|–—-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const domainWord = siteUrl.hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
    const match = parts.find((p) => p.toLowerCase().replace(/[^a-z]/g, '').includes(domainWord.slice(0, 6)));
    if (match) return match;
    return parts[parts.length - 1];
  }
  return title;
}

export function extractBranding(html: string, rawUrl: string): ExtractedBranding {
  const siteUrl = new URL(rawUrl);
  const found: string[] = [];
  const missing: string[] = [];

  const logo = extractLogo(html, siteUrl);
  logo ? found.push('logo') : missing.push('logo');

  const companyName = extractCompanyName(html, siteUrl);
  companyName ? found.push('companyName') : missing.push('companyName');

  const tagline =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)?.[1]?.trim() || '';
  tagline ? found.push('tagline') : missing.push('tagline');

  const rawPhone =
    html.match(/href=["']tel:([^"']+)["']/i)?.[1]?.trim() ||
    html.match(/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/)?.[0]?.trim() ||
    '';
  const phone = formatPhone(rawPhone);
  phone ? found.push('phone') : missing.push('phone');

  const facebook =
    html.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._-]+/i)?.[0] || '';
  facebook ? found.push('facebook') : missing.push('facebook');

  const colors = extractColors(html);
  if (colors) found.push('colors');
  else missing.push('colors');

  return {
    logo,
    companyName,
    tagline,
    phone,
    facebook,
    customDomain: siteUrl.hostname.replace(/^www\./, ''),
    // Empty rather than a made-up palette: the UI shows what was found, and the
    // user picks anything we could not read off the site.
    primaryColor: colors?.primaryColor || '',
    secondaryColor: colors?.secondaryColor || '',
    accentColor: colors?.accentColor || '',
    found,
    missing,
  };
}
