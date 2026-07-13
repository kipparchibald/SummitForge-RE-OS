// Summit Forge - Branding / white-label theme tokens
// Used by settings/branding page and layout for multi-tenant theming

export interface BrandTokens {
  primary: string
  secondary: string
  accent: string
  background: string
  foreground: string
  muted: string
  radius: string
  logoUrl?: string
  appName: string
}

export const DEFAULT_BRAND: BrandTokens = {
  primary: '#000000',
  secondary: '#111111',
  accent: '#10b981', // emerald for positive metrics
  background: '#f9fafb',
  foreground: '#111827',
  muted: '#6b7280',
  radius: '1rem',
  appName: 'Summit Forge',
}

/**
 * Convert brand tokens to CSS variables for runtime theming.
 * Apply via document.documentElement.style or a <style> tag.
 */
export function tokensToCssVars(tokens: BrandTokens): Record<string, string> {
  return {
    '--sf-primary': tokens.primary,
    '--sf-secondary': tokens.secondary,
    '--sf-accent': tokens.accent,
    '--sf-bg': tokens.background,
    '--sf-fg': tokens.foreground,
    '--sf-muted': tokens.muted,
    '--sf-radius': tokens.radius,
  }
}

export function applyBrandTokens(tokens: BrandTokens) {
  if (typeof document === 'undefined') return
  const vars = tokensToCssVars(tokens)
  const root = document.documentElement
  Object.entries(vars).forEach(([key, value]) => {
    root.style.setProperty(key, value)
  })
}
