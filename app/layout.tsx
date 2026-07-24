import './globals.css'
import Link from 'next/link'
import { isDemoMode, validateEnv } from '@/lib/env'
import {
  deploymentBranding,
  deploymentBrandCssText,
  hasDeploymentBranding,
} from '@/lib/branding/deployment'
import MobileNav from '@/components/MobileNav'
import { AppNavLinks } from '@/components/AppNavLinks'

export const metadata = {
  title: 'SummitForge RE OS',
  description: 'Real Estate Operating System for Eastern Idaho - Raw Land, Development & AI-Powered Tools',
  icons: { icon: '/favicon.ico' },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Centralized: respects NEXT_PUBLIC_DEMO_MODE (default false = production locked)
  const isDemo = isDemoMode();
  const envStatus = validateEnv();
  // Per-deployment defaults so a first-time visitor to a tenant's URL sees that
  // tenant's brand immediately, before any localStorage exists.
  const brand = deploymentBranding();
  const hasEnvBrand = hasDeploymentBranding(brand);
  const brandCss = deploymentBrandCssText(brand);

  return (
    // suppressHydrationWarning: theme/demo attrs + localStorage brand script may
    // differ from SSR before React attaches (same pattern as next-themes).
    <html lang="en" data-demo={isDemo ? 'on' : 'off'} suppressHydrationWarning>
      <body className="bg-gray-50 min-h-screen" suppressHydrationWarning>
        {/* Brand tokens as a style tag — NOT html[style] — so React never hydrates
            a style prop that the FOUC / localStorage script also mutates. */}
        {brandCss ? (
          <style
            id="sf-deployment-brand"
            dangerouslySetInnerHTML={{ __html: brandCss }}
          />
        ) : null}
        {/*
          Brand bootstrap:
          1) Sync: only CSS vars on <html> (prevents flash; html has suppressHydrationWarning)
          2) After paint: text content, demo flag, live badge (avoids text hydration mismatches)
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var root = document.documentElement;
                  // --- sync: CSS only (FOUC) ---
                  try {
                    var saved = localStorage.getItem('summitforge_branding');
                    if (saved) {
                      var b = JSON.parse(saved);
                      if (b.primaryColor) root.style.setProperty('--primary', b.primaryColor);
                      if (b.secondaryColor) root.style.setProperty('--secondary', b.secondaryColor);
                      if (b.accentColor) root.style.setProperty('--accent', b.accentColor);
                    }
                  } catch (e) {}

                  // --- after hydration: DOM text + badge ---
                  function applyAfterHydrate() {
                    try {
                      var saved2 = localStorage.getItem('summitforge_branding');
                      if (saved2) {
                        var b2 = JSON.parse(saved2);
                        if (b2.companyName) {
                          document.querySelectorAll('[data-company-name]').forEach(function(el) {
                            el.textContent = b2.companyName;
                          });
                        }
                        if (b2.phone) {
                          document.querySelectorAll('[data-phone]').forEach(function(el) {
                            el.textContent = b2.phone;
                            if (el.tagName === 'A') el.href = 'tel:' + String(b2.phone).replace(/[^0-9]/g, '');
                          });
                        }
                        if (b2.tagline) {
                          document.querySelectorAll('[data-tagline]').forEach(function(el) {
                            el.textContent = b2.tagline;
                          });
                        }
                      } else if (!${JSON.stringify(hasEnvBrand)}) {
                        var demoAttr = root.getAttribute('data-demo');
                        if (demoAttr === 'off') {
                          var prodDefault = {
                            companyName: 'SummitForge',
                            tagline: 'RE OS • Professional Land & Development',
                            phone: '(208) 745-5911'
                          };
                          document.querySelectorAll('[data-company-name]').forEach(function(el) {
                            if (!el.textContent || el.textContent === 'SummitForge') el.textContent = prodDefault.companyName;
                          });
                          document.querySelectorAll('[data-tagline]').forEach(function(el) {
                            if (!el.textContent || el.textContent.indexOf('Jefferson') !== -1) el.textContent = prodDefault.tagline;
                          });
                          document.querySelectorAll('[data-phone]').forEach(function(el) {
                            if (!el.textContent || el.textContent.indexOf('745') !== -1) {
                              el.textContent = prodDefault.phone;
                              if (el.tagName === 'A') el.href = 'tel:2087455911';
                            }
                          });
                        }
                      }

                      var demoOverride = localStorage.getItem('summitforge_demo');
                      if (demoOverride === 'off' || demoOverride === 'on') {
                        root.setAttribute('data-demo', demoOverride);
                      }

                      (function initLiveStatusBadge() {
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
                          var timeStr = formatTime(ts);
                          var recent = isRecent(ts);
                          el.textContent = 'Live • Last: ' + timeStr;
                          if (recent) {
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
                        updateBadge();
                        setInterval(updateBadge, 30000);
                        window.addEventListener('storage', function(e) {
                          if (e.key === 'summitforge_last_navica_pull') updateBadge();
                        });
                        window.addEventListener('navica-pull-updated', updateBadge);
                        window.addEventListener('summitforge-branding-updated', applyAfterHydrate);
                      })();
                    } catch (e) {}
                  }

                  // Defer past React hydration (setTimeout 0 is enough in practice;
                  // rAF double-buffer is belt-and-suspenders for slow devices).
                  if (typeof requestAnimationFrame === 'function') {
                    requestAnimationFrame(function() {
                      requestAnimationFrame(applyAfterHydrate);
                    });
                  } else {
                    setTimeout(applyAfterHydrate, 0);
                  }
                } catch (e) {}
              })();
            `,
          }}
        />

        {/* Demo Banner - ONLY visible in DEMO. Hidden seamlessly in production. */}
        {isDemo && (
          <div className="demo-banner flex items-center justify-center gap-2 font-medium">
            🚀 <strong>DEMO MODE</strong> — Full access enabled for preview. No limits. Ready for real keys &amp; production.
            <a href="/settings/branding" className="underline ml-2">Customize branding</a>
            <span className="mx-1">•</span>
            <a href="/ai-assistants" className="underline">Talk to AI Assistants</a>
          </div>
        )}

        {/* Env validation warnings (DEMO only, non-blocking) */}
        {isDemo && envStatus.warnings.length > 0 && (
          <div className="bg-amber-50 border-b border-amber-200 text-amber-800 text-xs px-4 py-1 text-center">
            Env notes: {envStatus.warnings.slice(0, 2).join(' • ')}{envStatus.warnings.length > 2 ? ' …' : ''} (see console or /setup)
          </div>
        )}

        <div className="flex min-h-screen">
          {/* Desktop rail — world-class grouped IA */}
          <aside className="w-[272px] bg-slate-50 border-r border-slate-200/80 hidden lg:flex flex-col sticky top-0 h-screen">
            <div className="px-5 pt-6 pb-4 border-b border-slate-200/80">
              <Link
                href="/"
                className="font-semibold text-xl tracking-tight block"
                style={{ color: 'var(--primary)' }}
                data-company-name
              >
                {brand.companyName || 'SummitForge'}
              </Link>
              <div className="text-[11px] text-slate-500 mt-0.5 leading-snug" data-tagline>
                {brand.tagline || 'RE OS · Eastern Idaho'}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-4">
              <AppNavLinks />
            </div>
            <div className="px-5 py-4 border-t border-slate-200/80 bg-white/60">
              <Link href="/pricing" className="block group">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">
                  Workspace
                </div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-xs font-semibold ring-1 ring-emerald-100 group-hover:ring-emerald-300">
                  {isDemo ? 'PRO · Demo' : 'PRO'}
                </div>
                <div className="mt-2 text-[10px] text-slate-400 leading-relaxed group-hover:text-slate-500">
                  Full MLS · Land · GIS · AI · White-label
                </div>
              </Link>
            </div>
          </aside>

          {/* Main */}
          <div className="flex-1 min-w-0 flex flex-col">
            <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur sticky top-0 z-30 px-4 sm:px-6 py-2.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="lg:hidden flex items-center gap-2">
                  <MobileNav
                    companyName={brand.companyName || 'SummitForge'}
                    tagline={brand.tagline || 'RE OS · Eastern Idaho'}
                    isDemo={isDemo}
                  />
                  <Link
                    href="/"
                    className="font-semibold truncate"
                    style={{ color: 'var(--primary)' }}
                    data-company-name
                  >
                    {brand.companyName || 'SummitForge'}
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
                <a
                  href={`tel:${(brand.phone || '(208) 745-5911').replace(/[^0-9]/g, '')}`}
                  className="hidden md:inline font-medium text-slate-700 hover:text-[var(--primary)] text-xs"
                  data-phone
                >
                  {brand.phone || '(208) 745-5911'}
                </a>
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
                  className="hidden sm:inline-flex px-3 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50 font-medium"
                >
                  MLS Import
                </Link>
                <Link
                  href="/ai-assistants"
                  className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium hover:bg-slate-800"
                >
                  AI
                </Link>
                {!isDemo && (
                  <form action="/auth/signout" method="post">
                    <button
                      type="submit"
                      className="px-2.5 py-1.5 text-xs rounded-lg border text-slate-500 hover:bg-slate-50"
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
      </body>
    </html>
  )
}
