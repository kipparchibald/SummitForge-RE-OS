import './globals.css'
import Link from 'next/link'
import { Inter } from 'next/font/google'
import { isDemoMode, validateEnv } from '@/lib/env'
import {
  deploymentBranding,
  deploymentBrandCssText,
} from '@/lib/branding/deployment'
import MobileNav from '@/components/MobileNav'
import { AppNavLinks } from '@/components/AppNavLinks'
import GlobalToasts from '@/components/GlobalToasts'
import { BrandPhone, BrandText } from '@/components/BrandText'
import { PRODUCT_BRAND, PRODUCT_DESCRIPTION, PRODUCT_NAME, PRODUCT_TAGLINE } from '@/lib/product'

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
})

export const metadata = {
  title: `${PRODUCT_BRAND} · RE OS`,
  description: PRODUCT_DESCRIPTION,
  icons: { icon: '/favicon.ico' },
  robots: {
    index: true,
    follow: true,
  },
}

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#1e3a5f',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const isDemo = isDemoMode();
  const envStatus = validateEnv();
  const brand = deploymentBranding();
  const brandCss = deploymentBrandCssText(brand);
  const companyFallback = brand.companyName || PRODUCT_BRAND;
  const taglineFallback = brand.tagline || PRODUCT_TAGLINE;
  const phoneFallback = brand.phone || '(208) 745-5911';

  return (
    <html lang="en" data-demo={isDemo ? 'on' : 'off'} className={inter.variable} suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 min-h-screen`} suppressHydrationWarning>
        {brandCss ? (
          <style
            id="sf-deployment-brand"
            dangerouslySetInnerHTML={{ __html: brandCss }}
          />
        ) : null}
        {/*
          Pre-hydration script: CSS vars + live badge only.
          Do NOT mutate company/tagline/phone text here — that races React hydration
          when localStorage branding differs from server env (tenant vs Voxli.dev).
          Text labels are applied after mount via BrandText / BrandPhone.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var root = document.documentElement;
                  try {
                    var saved = localStorage.getItem('summitforge_branding');
                    if (saved) {
                      var b = JSON.parse(saved);
                      if (b.primaryColor) root.style.setProperty('--primary', b.primaryColor);
                      if (b.secondaryColor) root.style.setProperty('--secondary', b.secondaryColor);
                      if (b.accentColor) root.style.setProperty('--accent', b.accentColor);
                    }
                  } catch (e) {}

                  try {
                    var demoOverride = localStorage.getItem('summitforge_demo');
                    if (demoOverride === 'off' || demoOverride === 'on') {
                      root.setAttribute('data-demo', demoOverride);
                    }
                  } catch (e) {}

                  function formatTime(iso) {
                    if (!iso) return '--:--';
                    try {
                      return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                    } catch (e) { return '--:--'; }
                  }
                  function isRecent(iso) {
                    if (!iso) return false;
                    try {
                      return (Date.now() - new Date(iso).getTime()) < 60 * 60 * 1000;
                    } catch (e) { return false; }
                  }
                  function updateBadge() {
                    var el = document.getElementById('live-status-badge');
                    if (!el) return;
                    var ts = null;
                    try { ts = localStorage.getItem('summitforge_last_navica_pull'); } catch (e) {}
                    el.textContent = 'Live • Last: ' + formatTime(ts);
                    if (isRecent(ts)) {
                      el.style.color = '#166534';
                      el.style.borderColor = '#86efac';
                      el.style.background = '#f0fdf4';
                    } else if (ts) {
                      el.style.color = '#854d0e';
                      el.style.borderColor = '#fde047';
                      el.style.background = '#fefce8';
                    } else {
                      el.style.color = '#4b5563';
                      el.style.borderColor = '#e5e7eb';
                      el.style.background = '#fff';
                    }
                  }
                  // Badge has suppressHydrationWarning; update after first paint
                  if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(function() { requestAnimationFrame(updateBadge); });
                  } else {
                    setTimeout(updateBadge, 0);
                  }
                  setInterval(updateBadge, 30000);
                  window.addEventListener('storage', function(e) {
                    if (e.key === 'summitforge_last_navica_pull') updateBadge();
                  });
                  window.addEventListener('navica-pull-updated', updateBadge);
                } catch (e) {}
              })();
            `,
          }}
        />

        {isDemo && (
          <div className="demo-banner flex flex-wrap items-center justify-center gap-x-2 gap-y-1 font-medium">
            <span>
              <strong>DEMO MODE</strong> — Full access for preview. No limits.
            </span>
            <a href="/settings/branding" className="underline underline-offset-2">
              Branding
            </a>
            <span className="text-amber-700/50" aria-hidden>
              ·
            </span>
            <a href="/ai-assistants" className="underline underline-offset-2">
              AI Assistants
            </a>
            <span className="text-amber-700/50" aria-hidden>
              ·
            </span>
            <a href="/setup" className="underline underline-offset-2">
              Setup
            </a>
          </div>
        )}

        {isDemo && envStatus.warnings.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1.5 text-center">
            Env notes: {envStatus.warnings.slice(0, 2).join(' · ')}
            {envStatus.warnings.length > 2 ? ' …' : ''} (see /setup)
          </div>
        )}

        <div className="flex min-h-screen">
          <aside className="w-[272px] bg-slate-50/95 border-r border-slate-200/80 hidden lg:flex flex-col sticky top-0 h-screen backdrop-blur-sm">
            <div className="px-5 pt-6 pb-4 border-b border-slate-200/80">
              <Link
                href="/"
                className="font-semibold text-xl tracking-tight block"
                style={{ color: 'var(--primary)' }}
              >
                <BrandText field="companyName" fallback={companyFallback} />
              </Link>
              <BrandText
                field="tagline"
                fallback={taglineFallback}
                as="div"
                className="text-[11px] text-slate-500 mt-0.5 leading-snug"
              />
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <AppNavLinks />
            </div>
            <div className="px-5 py-4 border-t border-slate-200/80 bg-white/60">
              <Link href="/pricing" className="block group">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                  Workspace
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold ring-1 ring-emerald-100 group-hover:ring-emerald-300 transition">
                  {isDemo ? 'PRO · Demo' : 'PRO'}
                </div>
                <div className="mt-2 text-[10px] text-slate-400 leading-relaxed group-hover:text-slate-500 transition">
                  Full MLS · Land · GIS · AI · White-label
                </div>
              </Link>
            </div>
          </aside>

          <div className="flex-1 min-w-0 flex flex-col">
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="lg:hidden flex items-center gap-2">
                  <MobileNav
                    companyName={companyFallback}
                    tagline={taglineFallback}
                    isDemo={isDemo}
                  />
                  <Link
                    href="/"
                    className="font-semibold truncate"
                    style={{ color: 'var(--primary)' }}
                  >
                    <BrandText field="companyName" fallback={companyFallback} />
                  </Link>
                </div>
                <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-medium">
                    Eastern Idaho · 7 counties
                  </span>
                  <span className="hidden md:inline text-slate-400">MLS · Land · GIS · AI</span>
                </div>
              </div>

              <div className="flex items-center gap-2 sm:gap-3 text-sm shrink-0">
                <BrandPhone
                  fallback={phoneFallback}
                  className="hidden md:inline font-medium text-slate-700 hover:text-[var(--primary)] text-xs"
                />
                <span
                  id="live-status-badge"
                  suppressHydrationWarning
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border bg-white text-slate-600"
                  title="Updates on every Navica pull"
                >
                  Live · Last: --:--
                </span>
                <Link
                  href="/import"
                  className="hidden sm:inline-flex px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 font-medium transition"
                >
                  MLS Import
                </Link>
                <Link
                  href="/ai-assistants"
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800 transition"
                >
                  AI
                </Link>
                {!isDemo && (
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 text-xs rounded-lg border text-slate-500 hover:bg-slate-50 transition"
                    >
                      Sign out
                    </button>
                  </form>
                )}
              </div>
            </header>

            <main className="flex-1 min-h-[calc(100vh-52px)] bg-slate-50/40">{children}</main>
          </div>
        </div>

        <GlobalToasts />
      </body>
    </html>
  )
}
