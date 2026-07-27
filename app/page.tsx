'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import RecentMatches from '@/components/RecentMatches';
import DashboardHealthBar from '@/components/DashboardHealthBar';
import StatusRow from '@/components/ui/StatusRow';
import { getAlerts, getMatches, isSupabaseConfigured } from '@/lib/alerts/supabase-store';
import { applyBrandTokens, DEFAULT_BRAND } from '@/lib/theme/tokens';
import { startRealtime } from '@/lib/realtime/client';

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function openTransactionCount(): number {
  try {
    const raw =
      localStorage.getItem('sf_transactions_v2') || localStorage.getItem('sf_transactions');
    if (!raw) return 0;
    const list = JSON.parse(raw) as { status?: string }[];
    return list.filter((t) => t.status && t.status !== 'closed').length;
  } catch {
    return 0;
  }
}

export default function DashboardPage() {
  const [stats, setStats] = useState({
    activeAlerts: 0,
    totalMatches: 0,
    unreadMatches: 0,
    openTransactions: 0,
  });
  const [storeMode, setStoreMode] = useState<'local' | 'supabase'>('local');
  const [health, setHealth] = useState<any>(null);
  const [autoImportEnabled, setAutoImportEnabled] = useState(false);
  const [greeting, setGreeting] = useState('Welcome');
  const [clock, setClock] = useState('');

  useEffect(() => {
    try {
      applyBrandTokens(DEFAULT_BRAND);
    } catch {
      /* */
    }
    try {
      startRealtime();
    } catch {
      /* */
    }
    try {
      setStoreMode(isSupabaseConfigured() ? 'supabase' : 'local');
    } catch {
      setStoreMode('local');
    }
    try {
      setAutoImportEnabled(localStorage.getItem('sf_auto_import') === '1');
    } catch {
      /* */
    }

    const tick = () => {
      const now = new Date();
      setGreeting(greetingForHour(now.getHours()));
      setClock(
        now.toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        })
      );
    };
    tick();
    const id = setInterval(tick, 60_000);

    (async () => {
      try {
        const alerts = await getAlerts('user_kipp');
        const matches = await getMatches(100);
        setStats({
          activeAlerts: alerts.filter((a: { active: boolean }) => a.active).length,
          totalMatches: matches.length,
          unreadMatches: matches.filter((m: { notified?: boolean }) => !m.notified).length,
          openTransactions: openTransactionCount(),
        });
      } catch {
        setStats((s) => ({ ...s, openTransactions: openTransactionCount() }));
      }
    })();

    fetch('/api/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));

    return () => clearInterval(id);
  }, []);

  const toggleAutoImport = () => {
    setAutoImportEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('sf_auto_import', next ? '1' : '0');
      } catch {
        /* */
      }
      return next;
    });
  };

  const navicaConfigured = health?.navica?.configured;
  const schemaOk = health?.supabase?.schemaOk;
  const twilioOk = health?.twilio?.configured;
  const aiLive = health?.ai?.live;

  const statusItems = useMemo(
    () => [
      {
        label: 'Navica Feed',
        status: (navicaConfigured ? 'ready' : 'optional') as 'ready' | 'optional',
        detail: navicaConfigured ? 'Live IDX' : 'Demo board',
      },
      {
        label: 'SMS / Twilio',
        status: (twilioOk ? 'ready' : 'optional') as 'ready' | 'optional',
        detail: twilioOk ? 'Live send' : 'Simulated',
      },
      {
        label: 'Supabase',
        status: (storeMode === 'supabase' ? 'ready' : 'optional') as 'ready' | 'optional',
        detail: storeMode === 'supabase' ? 'Connected' : 'Local mode',
      },
      {
        label: 'Schema (visibility)',
        status: (schemaOk === false ? 'todo' : schemaOk ? 'ready' : 'optional') as
          | 'ready'
          | 'optional'
          | 'todo',
        detail: schemaOk === false ? 'Migration needed' : schemaOk ? 'OK' : 'Unknown',
      },
      {
        label: 'AI Assistants',
        status: (aiLive ? 'ready' : 'optional') as 'ready' | 'optional',
        detail: aiLive ? health?.ai?.provider || 'Live' : 'Demo responses',
      },
      { label: 'Matching Engine', status: 'ready' as const, detail: 'Ready' },
      { label: 'Idaho Forms', status: 'ready' as const, detail: 'Ready' },
      { label: 'GIS Monitor', status: 'ready' as const, detail: 'Ready' },
      { label: 'Land Engine', status: 'ready' as const, detail: 'Ready' },
    ],
    [storeMode, navicaConfigured, schemaOk, twilioOk, aiLive, health?.ai?.provider]
  );

  return (
    <div className="min-h-[calc(100vh-60px)] bg-zinc-950 text-white">
      <div className="p-6 lg:p-8 space-y-8 max-w-[1600px] mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <DashboardHealthBar />
            {clock && (
              <span className="hidden sm:inline text-zinc-600 text-xs px-2">{clock}</span>
            )}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded-2xl px-3 py-1.5">
              <span className="text-xs text-zinc-400 mr-2">Auto-Import</span>
              <button
                type="button"
                role="switch"
                aria-checked={autoImportEnabled}
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

        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-semibold mb-2">
              Voxli.dev · Command
            </p>
            <h2 className="text-3xl lg:text-4xl font-semibold tracking-tight">
              {greeting}, Kipp
            </h2>
            <p className="text-zinc-400 mt-1">
              Land · GIS · CMA · Offers · Pipeline — one command center for Eastern Idaho.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/development/plat"
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 font-medium transition"
            >
              AI Plat Studio
            </Link>
            <Link
              href="/monitoring"
              className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition"
            >
              GIS Map
            </Link>
            <Link
              href="/cma"
              className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition"
            >
              CMA
            </Link>
            <Link
              href="/offer"
              className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition"
            >
              Offer Engine
            </Link>
            <Link
              href="/crm"
              className="px-5 py-3 rounded-2xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 font-medium transition"
            >
              CRM
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Active Alerts" value={stats.activeAlerts} href="/alerts" accent="emerald" />
          <StatCard label="Total Matches" value={stats.totalMatches} href="/alerts" accent="blue" />
          <StatCard label="Unread Matches" value={stats.unreadMatches} href="/alerts" accent="amber" />
          <StatCard
            label="Open Transactions"
            value={stats.openTransactions}
            href="/transactions"
            accent="purple"
          />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-gradient-to-br from-zinc-900 to-zinc-950 p-6 relative overflow-hidden">
              <div className="absolute inset-0 opacity-20 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-600/40 via-transparent to-transparent" />
              <div className="relative">
                <p className="text-emerald-400 text-sm font-medium mb-1">AI Plat · GIS · CRM · CMA</p>
                <h3 className="text-2xl font-semibold">
                  Plat land · Score deals · Run CMAs · Work the pipeline
                </h3>
                <p className="text-zinc-400 mt-2 max-w-xl">
                  Flagship tools for Eastern Idaho brokerage: intelligent plats, land Offer/Pass,
                  GIS monitoring, agent CRM, and adjusted comps — all on Navica-ready data.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Link
                    href="/development/plat"
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-sm font-medium transition"
                  >
                    Open AI Plat Studio
                  </Link>
                  <Link
                    href="/monitoring"
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition"
                  >
                    GIS Map
                  </Link>
                  <Link
                    href="/crm"
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition"
                  >
                    CRM
                  </Link>
                  <Link
                    href="/transactions"
                    className="px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-sm font-medium transition"
                  >
                    Transactions
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
                <RecentMatches limit={8} variant="dark" />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h3 className="font-semibold mb-4">Quick Actions</h3>
              <div className="space-y-1">
                <QuickLink href="/development/plat" label="AI Plat Studio" desc="Feasibility + intelligent lot layout" />
                <QuickLink href="/development/land-deals" label="Land Deals Engine" desc="Offer/Pass pipeline scores" />
                <QuickLink href="/monitoring" label="GIS Monitoring" desc="Map parcels · pro formas" />
                <QuickLink href="/crm" label="CRM Pipeline" desc="Leads, nurture, AI qualify" />
                <QuickLink href="/cma" label="CMA Builder" desc="Adjusted comps + export PDF" />
                <QuickLink href="/offer" label="Offer Engine" desc="Win probability + terms score" />
                <QuickLink href="/mortgage" label="Payment estimator" desc="PITI · taxes · PMI planning" />
                <QuickLink href="/analytics" label="Market Analytics" desc="Rigby / Ririe trends & forecast" />
                <QuickLink href="/import" label="Import / Navica Pull" desc="Live IDX + CSV + matching" />
                <QuickLink href="/marketing" label="Marketing Agent" desc="Build · approve · deploy campaigns" />
                <QuickLink href="/ai-assistants" label="AI Assistants" desc="Valuation, marketing, council" />
                <QuickLink href="/transactions" label="Transaction Coordinator" desc="Deals, checklists, Idaho forms" />
                <QuickLink href="/portal" label="Client Portal" desc="Buyer dashboard + showings" />
              </div>
            </div>

            <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-5">
              <h3 className="font-semibold mb-4">System Status</h3>
              <div className="space-y-3 text-sm">
                {statusItems.map((item) => (
                  <StatusRow
                    key={item.label}
                    label={item.label}
                    status={item.status}
                    detail={item.detail}
                  />
                ))}
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
