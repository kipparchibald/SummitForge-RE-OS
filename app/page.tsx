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
  }, []);

  const toggleAutoImport = () => {
    setAutoImportEnabled(!autoImportEnabled);
    console.log(autoImportEnabled ? 'Auto-import stopped' : 'Auto-import started');
  };

  return (
    <div className="min-h-screen bg-[var(--sf-bg,#f9fafb)]">
      <header className="bg-white border-b border-gray-200 px-8 py-5 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Command Center</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Archibald-Bagley • Eastern Idaho
            <span className="ml-2 text-xs text-gray-400">
              ({storeMode === 'supabase' ? 'Supabase' : 'Local'} store)
            </span>
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-white border border-gray-200 rounded-2xl px-4 py-2 shadow-sm">
            <span className="text-sm font-medium text-gray-700 mr-3">Auto-Import</span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoImportEnabled}
                onChange={toggleAutoImport}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-emerald-300 rounded-full peer peer-checked:bg-emerald-500 transition"></div>
              <div className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition peer-checked:translate-x-5"></div>
            </label>
            <span
              className={`ml-3 text-xs font-medium ${
                autoImportEnabled ? 'text-emerald-600' : 'text-gray-400'
              }`}
            >
              {autoImportEnabled ? 'ON' : 'OFF'}
            </span>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Agent Online
          </span>
          <Link
            href="/alerts"
            className="px-4 py-2 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition"
          >
            + New Alert
          </Link>
        </div>
      </header>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Active Alerts" value={stats.activeAlerts} href="/alerts" accent="emerald" />
          <StatCard label="Total Matches" value={stats.totalMatches} href="/alerts" accent="blue" />
          <StatCard label="Unread Matches" value={stats.unreadMatches} href="/alerts" accent="amber" />
          <StatCard label="Open Transactions" value={3} href="/transactions" accent="purple" />
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <div className="xl:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Matches</h2>
              <Link href="/alerts" className="text-sm text-emerald-600 hover:underline">
                View all →
              </Link>
            </div>
            <RecentMatches limit={8} />
          </div>

          <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <QuickLink href="/import" label="Import Navica CSV" desc="Trigger matching on new listings" />
                <QuickLink href="/transactions" label="Transaction Coordinator" desc="Track deals & generate forms" />
                <QuickLink href="/forms" label="Idaho Forms + E-Sign" desc="Auto-populate RE-21, RE-14, disclosures" />
                <QuickLink href="/portal" label="Client Portal" desc="Personalized buyer dashboard + voice" />
                <QuickLink href="/analytics" label="Market Analytics" desc="Rigby / Ririe predictive charts" />
                <QuickLink href="/publish" label="Publish White-Label" desc="Package for other brokerages" />
                <QuickLink href="/cma" label="CMA Builder" desc="Comparative market analysis" />
                <QuickLink href="/development/land-deals" label="Land Deals Engine" desc="Comps-driven plat design & feasibility" />
                <QuickLink href="/ai-assistants" label="AI Assistants" desc="Valuation, marketing, council, transaction" />
                <QuickLink href="/monitoring" label="GIS Monitoring" desc="Live parcel tracking & zoning alerts" />
                <QuickLink href="/marketing" label="Marketing Agent" desc="Campaign plans & execution" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900 mb-3">System Status</h3>
              <div className="space-y-3 text-sm">
                <StatusRow label="Matching Engine" status="ready" />
                <StatusRow label="SMS Notifications" status="ready" />
                <StatusRow
                  label="Supabase"
                  status={storeMode === 'supabase' ? 'ready' : 'optional'}
                />
                <StatusRow label="Idaho Forms + E-Sign" status="ready" />
                <StatusRow label="Client Portal" status="ready" />
                <StatusRow label="Predictive Analytics" status="ready" />
                <StatusRow label="White-Label Publish" status="ready" />
                <StatusRow label="GIS Monitor" status="ready" />
              </div>
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
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
  };
  return (
    <Link
      href={href}
      className={`block border rounded-3xl p-5 ${colors[accent]} hover:shadow-md transition`}
    >
      <div className="text-3xl font-bold tracking-tight">{value}</div>
      <div className="text-sm mt-1 opacity-80">{label}</div>
    </Link>
  );
}

function QuickLink({ href, label, desc }: { href: string; label: string; desc: string }) {
  return (
    <Link
      href={href}
      className="flex items-start gap-3 p-3 rounded-2xl hover:bg-gray-50 transition group"
    >
      <div className="w-2 h-2 mt-1.5 rounded-full bg-gray-300 group-hover:bg-black transition" />
      <div>
        <div className="font-medium text-gray-900 text-sm">{label}</div>
        <div className="text-xs text-gray-500">{desc}</div>
      </div>
    </Link>
  );
}

function StatusRow({ label, status }: { label: string; status: 'ready' | 'optional' | 'todo' }) {
  const map = {
    ready: { text: 'Ready', class: 'text-emerald-600' },
    optional: { text: 'Optional', class: 'text-amber-600' },
    todo: { text: 'Todo', class: 'text-gray-400' },
  };
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className={`font-medium ${map[status].class}`}>{map[status].text}</span>
    </div>
  );
}
