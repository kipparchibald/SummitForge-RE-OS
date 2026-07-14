'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { setLastSyncTimestamp, getLastSyncTimestamp, formatLastSyncTime, isLastSyncRecent } from '@/lib/import/lastSync';

export default function SummitForgeDashboard() {
  const [lastPull, setLastPull] = useState('');

  useEffect(() => {
    const ts = getLastSyncTimestamp();
    if (ts) setLastPull(formatLastSyncTime(ts));

    const onUpdate = () => {
      const newTs = getLastSyncTimestamp();
      setLastPull(formatLastSyncTime(newTs));
    };
    window.addEventListener('navica-pull-updated', onUpdate);
    return () => window.removeEventListener('navica-pull-updated', onUpdate);
  }, []);

  // Demo stats
  const stats = [
    { label: 'Parcels Monitored', value: '214' },
    { label: 'Active Listings', value: '37' },
    { label: 'Marketing Plans', value: '18' },
    { label: 'AI Interactions', value: '1,284' },
  ];

  const modules = [
    { href: '/monitoring', title: 'GIS Monitoring', desc: 'Live parcel tracking, alerts, zoning & buildability', icon: '🗺️' },
    { href: '/import', title: 'Import Listings', desc: 'MLS, Zillow, LandWatch + auto-analysis', icon: '📥' },
    { href: '/marketing', title: 'Marketing Agent', desc: 'Full plans, content, execution for land & builds', icon: '📣' },
    { href: '/analytics', title: 'Analytics & Forecasting', desc: 'Jefferson-specific trends & pro formas', icon: '📈' },
    { href: '/ai-assistants', title: 'World-Class AI Assistants', desc: 'Valuation • Marketing • Council • Transaction • Lead', icon: '🧠', highlight: true },
    { href: '/portal', title: 'Client Portal', desc: 'Branded buyer/seller experience', icon: '🏠' },
    { href: '/settings/branding', title: 'Branding & White-Label', desc: 'Colors, logo, domain — reseller ready', icon: '🎨' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-8">
      <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tighter">SummitForge RE OS</h1>
          <p className="text-gray-600 mt-1">Jefferson County / Eastern Idaho • Raw Land, Development &amp; AI</p>
        </div>
        <div className="flex items-center gap-3">
          {/* Live status badge on dashboard (shared w/ header + all pages) */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${isLastSyncRecent() ? 'bg-green-50 text-green-700 border-green-200' : lastPull ? 'bg-yellow-50 text-yellow-700 border-yellow-200' : 'bg-gray-100 text-gray-500 border-gray-200'}`}
            title="Live data status. Updates automatically on every Navica pull."
          >
            Live • Last: {lastPull || '—'}
          </span>
          <Link href="/setup" className="px-4 py-2 text-sm rounded-xl border hover:bg-white">Open Setup Guide</Link>
          <Link href="/ai-assistants" className="px-4 py-2 text-sm rounded-xl bg-blue-600 text-white font-medium">Launch AI Assistants</Link>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {stats.map((s, i) => (
          <div key={i} className="card p-4">
            <div className="text-3xl font-semibold">{s.value}</div>
            <div className="text-sm text-gray-500">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Main Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {modules.map((m) => (
          <Link 
            key={m.href} 
            href={m.href}
            className={`block p-6 rounded-2xl border bg-white hover:shadow-md transition group ${m.highlight ? 'ring-1 ring-blue-200' : ''}`}
          >
            <div className="text-3xl mb-3">{m.icon}</div>
            <h3 className="font-semibold text-lg mb-1 group-hover:text-[var(--primary)]">{m.title}</h3>
            <p className="text-sm text-gray-600 leading-snug">{m.desc}</p>
            {m.highlight && <div className="mt-3 text-[10px] uppercase tracking-widest text-blue-600 font-medium">World-class trained agents →</div>}
          </Link>
        ))}
      </div>

      {/* Quick Actions + Onboarding */}
      <div className="mt-10 grid md:grid-cols-2 gap-6">
        <div className="card p-6">
          <div className="font-semibold mb-3">Quick Actions</div>
          <div className="flex flex-wrap gap-2 text-sm">
            <Link href="/monitoring" className="px-4 py-1.5 rounded-lg bg-gray-900 text-white">Open Map</Link>
            <Link href="/marketing" className="px-4 py-1.5 rounded-lg border">Generate Marketing Plan</Link>
            <Link href="/ai-assistants" className="px-4 py-1.5 rounded-lg border">Ask Council</Link>
            <Link href="/import" className="px-4 py-1.5 rounded-lg border">Import New Data</Link>
            <Link href="/settings/branding" className="px-4 py-1.5 rounded-lg border">Brand Your OS</Link>
            <Link href="/pricing" className="px-4 py-1.5 rounded-lg border">See Pricing</Link>
            <button onClick={async () => {
              await fetch('/api/branding/sync');
              const res = await fetch('/api/import/listings?live=navica');
              const data = await res.json().catch(() => ({}));
              const ts = data.lastSync || new Date().toISOString();
              setLastSyncTimestamp(ts);
              if (typeof window !== 'undefined') {
                window.dispatchEvent(new Event('navica-pull-updated'));
                window.location.href = '/import';
              }
            }} className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white text-sm">🚀 Go Fully Live (AB Branding + Data)</button>
          </div>
          <div className="mt-4 text-xs text-gray-500">All features unlocked in Demo. Connect OpenAI + Mapbox for live intelligence.</div>
        </div>

        <div className="card p-6">
          <div className="font-semibold mb-2">First-Run / White-Label Ready</div>
          <p className="text-sm text-gray-600 mb-3">Complete the Setup Guide, apply your branding, and you can hand this to clients or other brokerages as a fully branded RE OS.</p>
          <div className="flex gap-2">
            <Link href="/setup" className="btn-primary px-5 py-2 rounded-xl text-sm font-medium inline-block">Start Setup →</Link>
            <Link href="/portal" className="px-5 py-2 rounded-xl border text-sm">Preview Client Portal</Link>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        Powered for Archibald-Bagley and ready for white-label resellers. Built systematically for production.
      </div>

      {/* Imported non-data branding/content from archibaldbagley.com */}
      <div className="mt-6 card p-6">
        <div className="font-semibold mb-2 text-sm">About Archibald-Bagley Real Estate</div>
        <p className="text-sm text-gray-600">
          Archibald-Bagley Real Estate has built a reputation for integrity, professionalism, and a deep understanding of the local market. With over two decades of experience, we pride ourselves on our personalized approach and commitment to client satisfaction. We specialize in connecting individuals and families with their ideal properties across Rigby, Idaho Falls, and the surrounding regions — with a strong focus on Land &amp; Acreage (rural, agricultural, and investment parcels).
        </p>
        <div className="mt-2 text-xs flex gap-3 text-gray-500">
          <span>📞 (208) 745-5911</span>
          <a href="https://www.facebook.com/archibaldbagleyrealestate" target="_blank" className="underline">Facebook</a>
          <Link href="/settings/branding" className="underline">Customize branding from site →</Link>
        </div>
      </div>

      {/* Monetization / Pricing Teaser */}
      <div className="mt-12 card p-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="font-semibold">Monetization Ready</div>
            <div className="text-sm text-gray-600">Freemium tiers with full AI agents, white-label, GIS, and marketing execution. Stripe integration prepared.</div>
          </div>
          <Link href="/pricing" className="btn-primary px-5 py-2 rounded-xl text-sm font-medium inline-block">View Pricing →</Link>
        </div>
        <div className="mt-4 grid md:grid-cols-3 gap-3 text-sm">
          <div className="p-4 border rounded-xl">Free — Core tools, limited AI</div>
          <div className="p-4 border rounded-xl ring-1 ring-blue-200">Pro — Full AI agents, unlimited plans, branding <span className="font-semibold text-blue-700">(Demo active)</span></div>
          <div className="p-4 border rounded-xl">Enterprise / White-label — Custom domain, team seats, reseller revenue share</div>
        </div>

        {/* Demo Usage Meter */}
        <div className="mt-6 pt-4 border-t">
          <div className="text-xs font-medium mb-1 flex justify-between"><span>Monthly AI Calls (Demo)</span><span>284 / 2000</span></div>
          <div className="usage-bar"><div className="usage-fill" style={{ width: '14%' }} /></div>
          <div className="text-[10px] text-gray-400 mt-1">Pro unlocks unlimited + real Stripe billing. Usage tracked per user/tenant. <Link href="/pricing" className="underline">Compare plans</Link></div>
        </div>
      </div>
    </div>
  )
}
