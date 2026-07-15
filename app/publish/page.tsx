'use client';

import React, { useState } from 'react';
import Link from 'next/link';

const TENANTS = [
  {
    id: 'archibald',
    name: 'Archibald-Bagley Real Estate',
    domain: 'app.archibaldbagley.com',
    primary: '#0f172a',
    accent: '#10b981',
    tagline: 'Eastern Idaho · Land · New Construction · Homes',
  },
  {
    id: 'generic',
    name: 'Summit Forge White-Label',
    domain: 'yourbrokerage.summitforge.app',
    primary: '#1e3a5f',
    accent: '#3b82f6',
    tagline: 'AI Real Estate OS for modern brokerages',
  },
  {
    id: 'demo',
    name: 'Demo Realty Group',
    domain: 'demo.summitforge.app',
    primary: '#4c1d95',
    accent: '#a78bfa',
    tagline: 'Powered by Summit Forge',
  },
];

export default function PublishPage() {
  const [selected, setSelected] = useState(TENANTS[0]);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [features, setFeatures] = useState({
    alerts: true,
    transactions: true,
    cma: true,
    land: true,
    portal: true,
    forms: true,
    analytics: true,
    marketing: true,
    voice: true,
  });

  const publish = async () => {
    setPublishing(true);
    await new Promise((r) => setTimeout(r, 1800));
    setPublishing(false);
    setPublished(true);
  };

  return (
    <div className="min-h-screen bg-[var(--sf-bg,#f9fafb)]">
      <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
            Publish White-Label Product
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            One-click package for Archibald-Bagley or any brokerage you sell to
          </p>
        </div>
        <Link
          href="/settings/branding"
          className="px-4 py-2 border border-gray-200 text-sm rounded-xl hover:bg-gray-50"
        >
          Branding settings
        </Link>
      </header>

      <div className="p-8 max-w-5xl mx-auto space-y-8">
        <section>
          <h2 className="font-semibold text-gray-900 mb-3">Choose tenant / brand</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {TENANTS.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  setSelected(t);
                  setPublished(false);
                }}
                className={`text-left p-5 rounded-3xl border-2 transition ${
                  selected.id === t.id
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <div
                  className="w-10 h-10 rounded-xl mb-3"
                  style={{ backgroundColor: t.primary }}
                />
                <div className="font-semibold text-gray-900">{t.name}</div>
                <div className="text-xs text-gray-500 mt-1">{t.domain}</div>
                <div className="text-xs text-gray-400 mt-2">{t.tagline}</div>
              </button>
            ))}
          </div>
        </section>

        <section className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
          <h2 className="font-semibold text-gray-900 mb-4">Modules included in this package</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {Object.entries(features).map(([key, on]) => (
              <label
                key={key}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-gray-50 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() =>
                    setFeatures((f) => ({ ...f, [key]: !f[key as keyof typeof f] }))
                  }
                  className="w-4 h-4 rounded border-gray-300 text-emerald-600"
                />
                <span className="text-sm font-medium capitalize text-gray-700">
                  {key === 'cma'
                    ? 'CMA Builder'
                    : key === 'voice'
                      ? 'Voice AI'
                      : key}
                </span>
              </label>
            ))}
          </div>
        </section>

        <section
          className="rounded-3xl p-8 text-white shadow-xl"
          style={{
            background: `linear-gradient(135deg, ${selected.primary} 0%, ${selected.accent} 100%)`,
          }}
        >
          <div className="text-sm opacity-80 mb-2">Live preview</div>
          <h3 className="text-3xl font-bold tracking-tight mb-2">{selected.name}</h3>
          <p className="opacity-90 mb-6">{selected.tagline}</p>
          <div className="flex flex-wrap gap-2">
            {Object.entries(features)
              .filter(([, on]) => on)
              .map(([key]) => (
                <span
                  key={key}
                  className="px-3 py-1 bg-white/20 rounded-full text-xs font-medium capitalize"
                >
                  {key}
                </span>
              ))}
          </div>
          <div className="mt-8 text-sm opacity-80">
            Deploy URL: <span className="font-mono">{selected.domain}</span>
          </div>
        </section>

        <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <button
            onClick={publish}
            disabled={publishing}
            className="px-8 py-4 bg-black text-white font-medium rounded-2xl hover:bg-gray-800 disabled:opacity-50 transition text-lg"
          >
            {publishing ? 'Packaging & deploying…' : 'Publish white-label product'}
          </button>
          {published && (
            <div className="text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-sm">
              <strong>Published</strong> — {selected.name} is live at{' '}
              <span className="font-mono">{selected.domain}</span>
              <br />
              <span className="text-emerald-600 text-xs">
                Marketing site + login + module config generated. Share the link with your client brokerage.
              </span>
            </div>
          )}
        </section>

        <p className="text-xs text-gray-400">
          This simulates multi-tenant deploy. Production would provision a Vercel project,
          inject brand tokens, and create a Supabase tenant row.
        </p>
      </div>
    </div>
  );
}
