'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import RecentMatches from '@/components/RecentMatches';
import { getAlerts, getMatches, isSupabaseConfigured } from '@/lib/alerts/supabase-store';
import { applyBrandTokens, DEFAULT_BRAND } from '@/lib/theme/tokens';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    activeAlerts: 0,
    totalMatches: 0,
    unreadMatches: 0,
  });
  const [storeMode, setStoreMode] = useState<'local' | 'supabase'>('local');
  const [health, setHealth] = useState<any>(null);
  const [autoImportEnabled, setAutoImportEnabled] = useState(false);

  useEffect(() => {
    try {
      applyBrandTokens(DEFAULT_BRAND);
    } catch {
      /* theme optional */
    }
    try {
      setStoreMode(isSupabaseConfigured() ? 'supabase' : 'local');
    } catch {
      setStoreMode('local');
    }

    (async () => {
      try {
        const alerts = await getAlerts('user_kipp');
        const matches = await getMatches(100);
        setStats({
          activeAlerts: alerts.filter((a: { active: boolean }) => a.active).length,
          totalMatches: matches.length,
          unreadMatches: matches.filter((m: { notified?: boolean }) => !m.notified).length,
        });
      } catch {
        /* offline demo */
      }
    })();

    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  const toggleAutoImport = () => setAutoImportEnabled(!autoImportEnabled);

  const navicaConfigured = health?.navica?.configured;
  const schemaOk = health?.supabase?.schemaOk;

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur sticky top-0 z-20">
        <div className="px-6 lg:px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600 flex items-center justify-center font-bold text-lg">
              SF
            </div>
            <div>
              <h1 className="text-xl font-semibold tracking-tight">SummitForge Command Center</h1>
              <p className="text-sm text-zinc-400">
                Archibald-Bagley · Jefferson County / Eastern Idaho
                <span className="ml-2 text-xs text-zinc-500">
                  ({storeMode === 'supabase' ? 'Supabase' : 'Local'} store)
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-wrap justify-end">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                navicaConfigured
                  ? 'bg-emerald-950/60 text-emerald-400 border-emerald-800'
                  : 'bg-zinc-900 text-zinc-400 border-zinc-700'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  navicaConfigured ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-500'
                }`}
              />
              {navicaConfigured ? 'Navica Live' : 'Navica Demo'}
            </span>

            {health && (
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                  schemaOk
                    ? 'bg-emerald-950/40 text-emerald-400 border-emerald-900'
                    : 'bg-amber-950/40 text-amber-400 border-amber-900'
                }`}
              >
                Schema {schemaOk ? 'OK' : 'Needs Migration'}
              </span>
            )}

            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-1.5">
              <span className="text-xs text-zinc-400 mr-2">Auto-Import</span>
              <button
                onClick={toggleAutoImport}
                className={`relative w-10 h-5 rounded-full transition ${
                  autoImportEnabled ? 'bg-emerald-600' : 'bg-zinc-700'
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition ${
                    autoImportEnabled ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>

            <Link
              href="/alerts"
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition"
            >
              + New Alert
            </Link>
          </div>
        </div>
      </header>

      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">Good evening, Kipp</h2>
            <p className="text-zinc-400 mt-1">
              Land deals · Alerts · Transactions · GIS — one command center for Eastern Idaho.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/monitoring"
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-medium transition"
            >
              GIS Monitoring
            </Link>
            <Link
              href="/development/land-deals"
              className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition"
            >
              Land Deals Engine
            </Link>
            <Link
              href="/import"
              className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition"
            >
              Pull Navica
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Alerts" value={stats.activeAlerts} href="/alerts" accent="emerald" />
          <StatCard label="Total Matches" value={stats.totalMatches} href="/alerts" accent="blue" />
          <StatCard label="Unread Matches" value={stats.unreadMatches} href="/alerts" accent="amber" />
          <StatCard label="Open Transactions" value={3} href="/transactions" accent="purple" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-600/40 via-transparent to-transparent" />
              <div className="relative">
                <p className="text-emerald-400 text-sm font-medium mb-1">Jefferson County GIS</p>
                <h3 className="text-2xl font-semibold">Monitor parcels · Run pro-formas · Draw plats</h3>
                <p className="text-zinc-400 mt-2 max-w-xl">
                  Click parcels on the map, score raw land feasibility, and generate entitlement-ready
                  development packets for Rigby, Ririe, and surrounding counties.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/monitoring"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition"
                  >
                    Open GIS Map
                  </Link>
                  <Link
                    href="/development/land-deals"
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition"
                  >
                    Land Feasibility
                  </Link>
                  <Link
                    href="/reports/land-analysis"
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition"
                  >
                    Land Reports
                  </Link>
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold">Recent Matches</h3>
                <Link href="/alerts" className="text-sm text-emerald-400 hover:underline">
                  View all →
                </Link>
              </div>
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/50 overflow-hidden">
                <RecentMatches limit={8} />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-1">
                <QuickLink href="/import" label="Import / Navica Pull" desc="Live IDX + CSV + matching" />
                <QuickLink href="/transactions" label="Transaction Coordinator" desc="Deals, timelines, Idaho forms" />
                <QuickLink href="/forms" label="Idaho Forms + E-Sign" desc="RE-21, RE-14, disclosures" />
                <QuickLink href="/analytics" label="Market Analytics" desc="Rigby / Ririe trends & forecast" />
                <QuickLink href="/ai-assistants" label="AI Assistants" desc="Valuation, marketing, council" />
                <QuickLink href="/portal" label="Client Portal" desc="Buyer dashboard + voice" />
                <QuickLink href="/marketing" label="Marketing Agent" desc="Plans & execution" />
                <QuickLink href="/publish" label="White-Label Publish" desc="Package for other brokerages" />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h3 className="font-semibold mb-4">System Status</h3>
              <div className="space-y-3 text-sm">
                <StatusRow label="Matching Engine" status="ready" />
                <StatusRow label="SMS Notifications" status="ready" />
                <StatusRow label="Supabase" status={storeMode === 'supabase' ? 'ready' : 'optional'} />
                <StatusRow label="Navica Feed" status={navicaConfigured ? 'ready' : 'optional'} />
                <StatusRow
                  label="Schema (visibility)"
                  status={schemaOk === false ? 'todo' : schemaOk ? 'ready' : 'optional'}
                />
                <StatusRow label="Idaho Forms" status="ready" />
                <StatusRow label="GIS Monitor" status="ready" />
                <StatusRow label="Land Engine" status="ready" />
              </div>
              <Link
                href="/api/health"
                className="mt-4 block text-center text-xs text-zinc-500 hover:text-emerald-400 transition"
              >
                View /api/health JSON →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: number;
  href: string;
  accent: 'emerald' | 'blue' | 'amber' | 'purple';
}) {
  const colors = {
    emerald: 'from-emerald-950/80 to-zinc-900 border-emerald-900/50 text-emerald-300',
    blue: 'from-blue-950/80 to-zinc-900 border-blue-900/50 text-blue-300',
    amber: 'from-amber-950/80 to-zinc-900 border-amber-900/50 text-amber-300',
    purple: 'from-purple-950/80 to-zinc-900 border-purple-900/50 text-purple-300',
  };
  return (
    <Link
      href={href}
      className={`block rounded-3xl border bg-gradient-to-br p-5 hover:scale-[1.02] transition ${colors[accent]}`}
    >
      <div className="text-3xl font-bold tracking-tight text-white">{value}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </Link>
  );
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-zinc-800/80 transition group"
    >
      <div className="w-2 h-2 mt-1.5 rounded-full bg-zinc-600 group-hover:bg-emerald-400 transition" />
      <div>
        <div className="font-medium text-sm text-zinc-100">{label}</div>
        <div className="text-xs text-zinc-500">{desc}</div>
      </div>
    </Link>
  );
}

function StatusRow({ label, status }: { label: string; status: 'ready' | 'optional' | 'todo' }) {
  const map = {
    ready: { text: 'Ready', class: 'text-emerald-400' },
    optional: { text: 'Optional', class: 'text-amber-400' },
    todo: { text: 'Action needed', class: 'text-rose-400' },
  };
  return (
    <div className="flex justify-between items-center">
      <span className="text-zinc-400">{label}</span>
      <span className={`font-medium ${map[status].class}`}>{map[status].text}</span>
    </div>
  );
}
