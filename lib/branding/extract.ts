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
  aboutBlurb: string;
  /** Field names that were genuinely extracted from the page. */
  found: string[];
  /** Field names the caller must fill in — nothing credible was found. */
  missing: string[];
  /** Debug: how colors were found */
  colorSource?: string;
}

const NEUTRAL =
  /^#(fff(fff)?|000(000)?|f{3,6}|e{3,6}|fafafa|fbfbfb|f6f6f6|eeeeee|dddddd|cccccc|999999|888888|666666|333333|111111|1a1a1a|191919)$/i;

/** Expand #rgb → #rrggbb; ensure leading #; lowercase. Returns '' if invalid. */
export function normalizeHex(raw: string | undefined | null): string {
  if (!raw) return '';
  let h = String(raw).trim().toLowerCase();
  if (!h.startsWith('#')) h = `#${h}`;
  if (/^#[0-9a-f]{3}$/.test(h)) {
    h = `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`;
  }
  if (/^#[0-9a-f]{6}$/.test(h) || /^#[0-9a-f]{8}$/.test(h)) return h.slice(0, 7);
  // rgb(r,g,b)
  const rgb = String(raw).match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (rgb) {
    const to = (n: string) =>
      Math.max(0, Math.min(255, parseInt(n, 10)))
        .toString(16)
        .padStart(2, '0');
    return `#${to(rgb[1])}${to(rgb[2])}${to(rgb[3])}`;
  }
  return '';
}

function isNeutral(hex: string): boolean {
  const h = normalizeHex(hex);
  if (!h) return true;
  if (NEUTRAL.test(h)) return true;
  const m = h.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
  if (!m) return false;
  const [r, g, b] = [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max - min < 18;
}

function inlineCss(html: string): string {
  const blocks = html.match(/<style[^>]*>[\s\S]*?<\/style>/gi) || [];
  return blocks.join('\n');
}

/**
 * Theme palettes, best source first:
 *  1. Astra (--ast-global-color-N)
 *  2. theme-color / msapplication-TileColor meta
 *  3. Generic custom properties (--primary / --brand / --accent)
 *  4. Dominant non-neutral colour in inline CSS
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
  for (const m of css.matchAll(/--ast-global-color-(\d)\s*:\s*([^;}+]+)/g)) {
    const hex = normalizeHex(m[2].trim());
    if (hex) astra[Number(m[1])] = hex;
  }
  // Also match #hex form
  for (const m of css.matchAll(/--ast-global-color-(\d)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) {
    const hex = normalizeHex(m[2]);
    if (hex) astra[Number(m[1])] = hex;
  }
  const astraPrimary = [0, 2, 7, 5].map((i) => astra[i]).find((c) => c && !isNeutral(c));
  if (astraPrimary) {
    const secondary = [1, 3, 4]
      .map((i) => astra[i])
      .find((c) => c && !isNeutral(c) && c !== astraPrimary);
    const accent = [6, 4, 8]
      .map((i) => astra[i])
      .find((c) => c && !isNeutral(c) && c !== astraPrimary && c !== secondary);
    return {
      primaryColor: astraPrimary,
      secondaryColor: secondary || astraPrimary,
      accentColor: accent || secondary || astraPrimary,
      source: 'astra-theme-palette',
    };
  }

  // 2. Meta theme-color
  const themeMeta =
    html.match(
      /<meta[^>]+name=["']theme-color["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']theme-color["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+name=["']msapplication-TileColor["'][^>]+content=["']([^"']+)["']/i
    )?.[1];
  const themeHex = normalizeHex(themeMeta || '');
  if (themeHex && !isNeutral(themeHex)) {
    return {
      primaryColor: themeHex,
      secondaryColor: themeHex,
      accentColor: themeHex,
      source: 'meta-theme-color',
    };
  }

  // 3. Generic custom properties
  const named: Record<string, string> = {};
  for (const m of css.matchAll(
    /--([a-z0-9-]*(?:primary|brand|accent|secondary|main)[a-z0-9-]*)\s*:\s*([^;]+)/gi
  )) {
    const hex = normalizeHex(m[2].trim());
    if (hex) named[m[1].toLowerCase()] = hex;
  }
  const pick = (kw: string) =>
    Object.entries(named).find(([k, v]) => k.includes(kw) && !isNeutral(v))?.[1];
  const gPrimary = pick('primary') || pick('brand') || pick('main');
  if (gPrimary) {
    return {
      primaryColor: gPrimary,
      secondaryColor: pick('secondary') || gPrimary,
      accentColor: pick('accent') || pick('secondary') || gPrimary,
      source: 'css-custom-properties',
    };
  }

  // 4. Dominant non-neutral colour
  const counts = new Map<string, number>();
  for (const m of css.matchAll(/#[0-9a-fA-F]{3,8}\b/g)) {
    const h = normalizeHex(m[0]);
    if (!h || isNeutral(h)) continue;
    counts.set(h, (counts.get(h) || 0) + 1);
  }
  const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (ranked.length > 0 && ranked[0][1] >= 2) {
    return {
      primaryColor: ranked[0][0],
      secondaryColor: ranked[1]?.[0] || ranked[0][0],
      accentColor: ranked[2]?.[0] || ranked[1]?.[0] || ranked[0][0],
      source: 'dominant-css-colour',
    };
  }

  return null;
}

// Third-party images that are never the brokerage's own logo.
const NOT_A_LOGO =
  /(\/mls\/|idx_|\/listings?\/|cloudfront\.net\/listings|gravatar|facebook\.com|twitter|instagram|googletagmanager|\/emoji\/|spinner|placeholder|pixel|1x1|tracking)/i;

function absolutize(src: string, siteUrl: URL): string {
  if (src.startsWith('//')) return `${siteUrl.protocol}${src}`;
  if (src.startsWith('/')) return `${siteUrl.origin}${src}`;
  if (/^https?:\/\//i.test(src)) return src;
  try {
    return new URL(src, siteUrl).toString();
  } catch {
    return '';
  }
}

function extractLogo(html: string, siteUrl: URL): string {
  const candidates: { src: string; score: number }[] = [];

  // og:image / apple-touch-icon as weak fallbacks (scored lower)
  const og =
    html.match(
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i
    )?.[1];
  if (og) {
    const src = absolutize(og, siteUrl);
    if (src && !NOT_A_LOGO.test(src)) candidates.push({ src, score: 3 });
  }

  for (const m of html.matchAll(
    /<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon|shortcut icon)[^"']*["'][^>]*>/gi
  )) {
    const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
    if (!href) continue;
    const src = absolutize(href, siteUrl);
    if (!src || NOT_A_LOGO.test(src)) continue;
    if (!/\.(png|svg|jpe?g|webp|ico)(\?|$)/i.test(src) && !src.includes('icon')) continue;
    candidates.push({ src, score: 2 });
  }

  for (const m of html.matchAll(/<img[^>]+>/gi)) {
    const tag = m[0];
    const srcM =
      tag.match(/\ssrc=["']([^"']+)["']/i) ||
      tag.match(/\sdata-src=["']([^"']+)["']/i) ||
      tag.match(/\sdata-lazy-src=["']([^"']+)["']/i);
    if (!srcM) continue;
    const src = absolutize(srcM[1], siteUrl);
    if (!src || !/^https?:\/\//i.test(src)) continue;
    if (NOT_A_LOGO.test(src)) continue;
    if (!/\.(png|svg|jpe?g|webp)(\?|$)/i.test(src) && !/logo/i.test(src)) continue;

    let score = 0;
    if (src.includes(siteUrl.hostname.replace(/^www\./, '')) || src.includes(siteUrl.hostname))
      score += 4;
    if (/wp-content\/uploads/i.test(src)) score += 2;
    if (/logo|brand|site-header/i.test(src)) score += 3;
    const domainWord = siteUrl.hostname.replace(/^www\./, '').split('.')[0];
    if (domainWord.length > 4 && src.toLowerCase().includes(domainWord.slice(0, 6))) score += 4;
    if (m.index != null && m.index < html.length * 0.25) score += 2;
    const w = Number(tag.match(/\swidth=["'](\d+)["']/i)?.[1] || 0);
    const h = Number(tag.match(/\sheight=["'](\d+)["']/i)?.[1] || 0);
    if (w && h && w <= 400 && h <= 200) score += 2;
    if (/class=["'][^"']*(logo|brand|site-title|header|custom-logo)[^"']*["']/i.test(tag))
      score += 3;
    if (/alt=["'][^"']*logo[^"']*["']/i.test(tag)) score += 2;

    candidates.push({ src, score });
  }

  candidates.sort((a, b) => b.score - a.score);
  return candidates.length > 0 && candidates[0].score >= 4 ? candidates[0].src : '';
}

/** tel: hrefs arrive as bare digits — present them the way the site displays them. */
function formatPhone(raw: string): string {
  const d = raw.replace(/[^0-9]/g, '').replace(/^1(?=\d{10}$)/, '');
  if (d.length !== 10) return raw.trim();
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
}

function extractCompanyName(html: string, siteUrl: URL): string {
  // JSON-LD Organization name
  for (const m of html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    try {
      const data = JSON.parse(m[1]);
      const nodes = Array.isArray(data) ? data : data['@graph'] ? data['@graph'] : [data];
      for (const n of nodes) {
        if (!n || typeof n !== 'object') continue;
        const t = String(n['@type'] || '');
        if (/Organization|RealEstate|LocalBusiness/i.test(t) && n.name) {
          return String(n.name).trim();
        }
      }
    } catch {
      /* ignore bad JSON-LD */
    }
  }

  const ogSite =
    html.match(
      /<meta[^>]+property=["']og:site_name["'][^>]+content=["']([^"']+)["']/i
    )?.[1] ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:site_name["']/i
    )?.[1];
  if (ogSite?.trim()) return ogSite.trim();

  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim();
  if (!title) return '';
  const parts = title.split(/\s+[|–—-]\s+/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 1) {
    const domainWord = siteUrl.hostname.replace(/^www\./, '').split('.')[0].toLowerCase();
    const match = parts.find((p) =>
      p.toLowerCase().replace(/[^a-z]/g, '').includes(domainWord.slice(0, 6))
    );
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

  const metaDesc =
    html.match(
      /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i
    )?.[1]?.trim() ||
    html.match(
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i
    )?.[1]?.trim() ||
    '';

  // Short tagline for chrome; full description as about blurb when long
  let tagline = '';
  let aboutBlurb = '';
  if (metaDesc) {
    if (metaDesc.length <= 90) {
      tagline = metaDesc;
      found.push('tagline');
    } else {
      tagline = metaDesc.slice(0, 87).replace(/\s+\S*$/, '') + '…';
      aboutBlurb = metaDesc;
      found.push('tagline');
      found.push('aboutBlurb');
    }
  } else {
    missing.push('tagline');
  }

  const rawPhone =
    html.match(/href=["']tel:([^"']+)["']/i)?.[1]?.trim() ||
    html.match(/\(?\b\d{3}\)?[\s.-]\d{3}[\s.-]\d{4}\b/)?.[0]?.trim() ||
    '';
  const phone = formatPhone(rawPhone);
  phone ? found.push('phone') : missing.push('phone');

  const facebook =
    html.match(/https?:\/\/(?:www\.)?facebook\.com\/[A-Za-z0-9._/-]+/i)?.[0]?.replace(/\/$/, '') ||
    '';
  facebook ? found.push('facebook') : missing.push('facebook');

  const colors = extractColors(html);
  if (colors) found.push('colors');
  else missing.push('colors');

  if (!found.includes('aboutBlurb')) missing.push('aboutBlurb');

  return {
    logo,
    companyName,
    tagline,
    phone,
    facebook,
    customDomain: siteUrl.hostname.replace(/^www\./, ''),
    primaryColor: colors?.primaryColor || '',
    secondaryColor: colors?.secondaryColor || '',
    accentColor: colors?.accentColor || '',
    aboutBlurb,
    found,
    missing,
    colorSource: colors?.source,
  };
}
