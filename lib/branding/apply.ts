/**
 * Client-side brand application helpers.
 * Keep in sync with the inline bootstrap in app/layout.tsx.
 */

export type BrandPayload = {
  logo?: string;
  primaryColor?: string;
  secondaryColor?: string;
  accentColor?: string;
  companyName?: string;
  customDomain?: string;
  tagline?: string;
  phone?: string;
  facebook?: string;
  aboutBlurb?: string;
};

export const BRANDING_STORAGE_KEY = 'summitforge_branding';

/** Safe value for <input type="color"> — never empty. */
export function colorInputValue(hex: string | undefined, fallback = '#1e40af'): string {
  const h = (hex || '').trim();
  if (/^#[0-9a-fA-F]{6}$/.test(h)) return h.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(h)) {
    return `#${h[1]}${h[1]}${h[2]}${h[2]}${h[3]}${h[3]}`.toLowerCase();
  }
  return fallback;
}

export function applyBrandToDocument(b: BrandPayload) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (b.primaryColor) root.style.setProperty('--primary', b.primaryColor);
  if (b.secondaryColor) root.style.setProperty('--secondary', b.secondaryColor);
  if (b.accentColor) root.style.setProperty('--accent', b.accentColor);

  if (b.companyName) {
    document.querySelectorAll('[data-company-name]').forEach((el) => {
      el.textContent = b.companyName!;
    });
  }
  if (b.tagline) {
    document.querySelectorAll('[data-tagline]').forEach((el) => {
      el.textContent = b.tagline!;
    });
  }
  if (b.phone) {
    document.querySelectorAll('[data-phone]').forEach((el) => {
      el.textContent = b.phone!;
      if (el instanceof HTMLAnchorElement) {
        el.href = 'tel:' + b.phone!.replace(/[^0-9]/g, '');
      }
    });
  }
}

export function persistBranding(b: BrandPayload) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(BRANDING_STORAGE_KEY, JSON.stringify(b));
    window.dispatchEvent(new CustomEvent('summitforge-branding-updated', { detail: b }));
  } catch {
    /* private mode / quota */
  }
}

export function loadPersistedBranding(): BrandPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(BRANDING_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BrandPayload;
  } catch {
    return null;
  }
}
