import './globals.css'
import Link from 'next/link'
import { isDemoMode, validateEnv } from '@/lib/env'

export const metadata = {
  title: 'SummitForge RE OS',
  description: 'Real Estate Operating System for Jefferson County / Eastern Idaho - Raw Land, Development & AI-Powered Tools',
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

  return (
    <html lang="en" data-demo={isDemo ? 'on' : 'off'}>
      <body className="bg-gray-50 min-h-screen">
        {/* Global Branding + Theme Loader (applies saved white-label instantly) */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const saved = localStorage.getItem('summitforge_branding');
                  let appliedBranding = null;

                  if (saved) {
                    const b = JSON.parse(saved);
                    appliedBranding = b;
                    if (b.primaryColor) document.documentElement.style.setProperty('--primary', b.primaryColor);
                    if (b.secondaryColor) document.documentElement.style.setProperty('--secondary', b.secondaryColor);
                    if (b.accentColor) document.documentElement.style.setProperty('--accent', b.accentColor);
                    
                    // Apply company name and contact info from imported site branding
                    const names = document.querySelectorAll('[data-company-name]');
                    names.forEach(el => el.textContent = b.companyName || el.textContent);
                    
                    const phones = document.querySelectorAll('[data-phone]');
                    if (b.phone) phones.forEach(el => { 
                      el.textContent = b.phone; 
                      if (el.tagName === 'A') el.href = 'tel:' + b.phone.replace(/[^0-9]/g,'');
                    });
                    
                    const taglines = document.querySelectorAll('[data-tagline]');
                    if (b.tagline) taglines.forEach(el => el.textContent = b.tagline);
                  } else {
                    // PRODUCTION BRANDING LOCK (seamless): 
                    // If data-demo=off (prod) and no user-saved branding, apply clean professional default.
                    // Hides demo artifacts. User can still customize in /settings/branding.
                    const demoAttr = document.documentElement.getAttribute('data-demo');
                    const isProd = demoAttr === 'off';
                    if (isProd) {
                      const prodDefault = {
                        companyName: 'SummitForge',
                        tagline: 'RE OS • Professional Land & Development',
                        phone: '(208) 745-5911'
                      };
                      const names = document.querySelectorAll('[data-company-name]');
                      names.forEach(el => { if (!el.textContent || el.textContent === 'SummitForge') el.textContent = prodDefault.companyName; });
                      const taglines = document.querySelectorAll('[data-tagline]');
                      taglines.forEach(el => { if (!el.textContent || el.textContent.includes('Jefferson')) el.textContent = prodDefault.tagline; });
                      const phones = document.querySelectorAll('[data-phone]');
                      phones.forEach(el => { if (!el.textContent || el.textContent.includes('745')) { el.textContent = prodDefault.phone; if (el.tagName === 'A') el.href = 'tel:2087455911'; } });
                    }
                  }

                  // Demo flag (client override for testing seamless toggle)
                  if (localStorage.getItem('summitforge_demo') === 'off') {
                    document.documentElement.setAttribute('data-demo', 'off');
                  } else if (localStorage.getItem('summitforge_demo') === 'on') {
                    document.documentElement.setAttribute('data-demo', 'on');
                  }

                  // Live status badge: shared localStorage + recentListings lastSync
                  // "Live • Last: XX:XX" green if recent (<60min)
                  (function initLiveStatusBadge() {
                    function formatTime(iso) {
                      if (!iso) return '--:--';
                      try {
                        const d = new Date(iso);
                        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      } catch { return '--:--'; }
                    }
                    function isRecent(iso) {
                      if (!iso) return false;
                      try {
                        return (Date.now() - new Date(iso).getTime()) < 60 * 60 * 1000;
                      } catch { return false; }
                    }
                    function updateBadge() {
                      const el = document.getElementById('live-status-badge');
                      if (!el) return;
                      let ts = null;
                      try { ts = localStorage.getItem('summitforge_last_navica_pull'); } catch(e){}
                      const timeStr = formatTime(ts);
                      const recent = isRecent(ts);
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
                    // Initial + periodic refresh (every 30s for clock feel)
                    updateBadge();
                    setInterval(updateBadge, 30000);
                    // Listen for cross-tab / same-tab storage updates from pulls
                    window.addEventListener('storage', function(e) {
                      if (e.key === 'summitforge_last_navica_pull') updateBadge();
                    });
                    // Also allow manual trigger via custom event from client pages
                    window.addEventListener('navica-pull-updated', updateBadge);
                  })();
                } catch(e) {}
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

        <div className="flex">
          {/* Sidebar Navigation */}
          <aside className="w-64 bg-white border-r min-h-screen p-6 hidden lg:block">
            <div className="mb-8">
              <Link href="/" className="font-semibold text-2xl tracking-tight" style={{ color: 'var(--primary)' }} data-company-name>SummitForge</Link>
              <div className="text-xs text-gray-500" data-tagline>RE OS • Jefferson County / Eastern Idaho</div>
            </div>
            <nav className="space-y-1 text-sm">
              <Link href="/" className="block px-3 py-2 rounded-lg hover:bg-gray-100 font-medium">Dashboard</Link>
              <Link href="/analytics" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Analytics &amp; Forecasting</Link>
              <Link href="/alerts" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Property Alerts</Link>
              <Link href="/import" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Import Listings</Link>
              <Link href="/monitoring" className="block px-3 py-2 rounded-lg hover:bg-gray-100">GIS Monitoring</Link>
              <Link href="/development/land-deals" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Land Deals</Link>
              <div className="pt-2 mt-2 border-t" />
              <Link href="/transactions" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Transactions</Link>
              <Link href="/forms" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Idaho Forms</Link>
              <Link href="/cma" className="block px-3 py-2 rounded-lg hover:bg-gray-100">CMA Builder</Link>
              <Link href="/mortgage" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Mortgage</Link>
              <Link href="/marketing" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Marketing Agent</Link>
              <div className="pt-2 mt-2 border-t" />
              <Link href="/ai-assistants" className="block px-3 py-2 rounded-lg hover:bg-blue-50 font-semibold text-blue-700">AI Assistants</Link>
              <Link href="/portal" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Client Portal</Link>
              <Link href="/publish" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Publish / White-Label</Link>
              <Link href="/pricing" className="block px-3 py-2 rounded-lg hover:bg-gray-100 font-medium">Pricing &amp; Plans</Link>
              <Link href="/settings/branding" className="block px-3 py-2 rounded-lg hover:bg-gray-100">Branding &amp; White-Label</Link>
            </nav>

            <div className="mt-8 pt-6 border-t">
              <Link href="/pricing" className="block group">
                <div className="text-[10px] uppercase tracking-widest text-gray-400 mb-1 group-hover:text-gray-500">Plan</div>
                <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium group-hover:ring-1 ring-emerald-300">
                  {isDemo ? 'PRO (Demo)' : 'PRO'}
                </div>
                <div className="mt-3 text-[10px] text-gray-400 group-hover:text-gray-500">
                  Strong focus on raw land &amp; development<br />White-label ready — see tiers →
                </div>
              </Link>
            </div>
          </aside>

          {/* Main Content */}
          <div className="flex-1">
            {/* Top Bar */}
            <header className="border-b bg-white px-6 py-3 flex items-center justify-between">
              <div className="flex items-center gap-4 lg:hidden">
                <Link href="/" className="font-semibold" style={{ color: 'var(--primary)' }} data-company-name>SummitForge</Link>
              </div>

              <div className="flex items-center gap-4 text-sm text-gray-500 hidden sm:flex">
                <span className="px-2 py-0.5 rounded bg-gray-100 text-xs">Jefferson County, ID</span>
                <span className="hidden md:inline">Raw Land • Development • AI</span>
                <a href="tel:2087455911" className="font-medium text-gray-700 hover:text-[var(--primary)]" data-phone>(208) 745-5911</a>
                {/* Live status badge (hydrated from localStorage + recentListings lastSync) */}
                <span
                  id="live-status-badge"
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border bg-white text-gray-600"
                  title="Updates on every Navica pull"
                >
                  Live • Last: --:--
                </span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Link href="/setup" className="px-3 py-1.5 text-xs rounded-lg border hover:bg-gray-50">Setup Guide</Link>
                <Link href="/ai-assistants" className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium">AI Assistants</Link>
                <Link href="/settings/branding" className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs">Branding</Link>
                <a href="https://voxli.dev" target="_blank" className="text-gray-400 hover:text-gray-600 px-1">Voxli</a>
                {!isDemo && (
                  <form action="/auth/signout" method="post">
                    <button type="submit" className="px-3 py-1.5 text-xs rounded-lg border text-gray-500 hover:bg-gray-50">
                      Sign out
                    </button>
                  </form>
                )}
              </div>
            </header>

            <main className="min-h-[calc(100vh-60px)]">{children}</main>
          </div>
        </div>
      </body>
    </html>
  )
}
