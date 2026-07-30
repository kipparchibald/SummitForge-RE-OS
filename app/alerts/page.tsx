'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Alert, Location, PropertyType } from '@/types/alerts';
import { COUNTIES } from '@/lib/geo/counties';
import {
  getAlerts,
  saveAlert,
  deleteAlert,
  getMatches,
  getStorageMode,
  isSupabaseConfigured,
  migrateLocalAlertsToCloud,
  type AlertStorageMode,
} from '@/lib/alerts/supabase-store';
import RecentMatches from '@/components/RecentMatches';
import { ingestAlertMatches } from '@/lib/portal/matches';

const PROPERTY_TYPES: PropertyType[] = ['Single Family', 'New Construction', 'Land', 'Farm/Ranch'];

export default function PropertyAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingAlert, setEditingAlert] = useState<Alert | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'matches'>('alerts');
  const [matchCount, setMatchCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [supabaseOn, setSupabaseOn] = useState(false);
  const [storageMode, setStorageMode] = useState<AlertStorageMode>('local');
  const [rematching, setRematching] = useState(false);
  const [syncing, setSyncing] = useState(false);

  type NotifyChoice = 'sms' | 'email' | 'both';
  const notifyChoiceToChannels = (c: NotifyChoice): ('email' | 'sms' | 'in-app')[] => {
    if (c === 'both') return ['sms', 'email'];
    if (c === 'email') return ['email'];
    return ['sms'];
  };
  const channelsToNotifyChoice = (
    channels: ('email' | 'sms' | 'in-app')[] | undefined
  ): NotifyChoice => {
    const list = channels || [];
    const hasSms = list.includes('sms');
    const hasEmail = list.includes('email');
    if (hasSms && hasEmail) return 'both';
    if (hasEmail && !hasSms) return 'email';
    return 'sms';
  };

  const [form, setForm] = useState({
    name: '',
    locations: [] as Location[],
    minPrice: 0,
    maxPrice: 600000,
    minAcres: 0.25,
    propertyTypes: ['Single Family', 'New Construction'] as PropertyType[],
    newConstructionOnly: false,
    notifyBy: 'sms' as NotifyChoice,
    phone: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSupabaseOn(isSupabaseConfigured());
      const [a, m, mode] = await Promise.all([getAlerts(), getMatches(), getStorageMode()]);
      setAlerts(a);
      setMatchCount(m.length);
      setStorageMode(mode);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetForm = () => {
    setEditingAlert(null);
    setForm({
      name: '',
      locations: [],
      minPrice: 0,
      maxPrice: 600000,
      minAcres: 0.25,
      propertyTypes: ['Single Family', 'New Construction'],
      newConstructionOnly: false,
      notifyBy: 'sms',
      phone: '',
    });
  };

  const handleSave = async () => {
    if (!form.name.trim() || form.locations.length === 0) {
      alert('Name and at least one location are required');
      return;
    }
    const mode = await saveAlert({
      ...(editingAlert || ({} as Alert)),
      id: editingAlert?.id || `alert_${Date.now()}`,
      name: form.name.trim(),
      active: editingAlert?.active ?? true,
      locations: form.locations,
      minPrice: form.minPrice || undefined,
      maxPrice: form.maxPrice || undefined,
      minAcres: form.minAcres || undefined,
      propertyTypes: form.propertyTypes,
      newConstructionOnly: form.newConstructionOnly,
      notifyBy: notifyChoiceToChannels(form.notifyBy),
      frequency: editingAlert?.frequency || 'instant',
      userId: editingAlert?.userId || 'local',
      brokerageId: editingAlert?.brokerageId || 'archibald-bagley',
      phone: form.phone || undefined,
      createdAt: editingAlert?.createdAt || new Date().toISOString(),
    } as Alert);
    setStorageMode(mode);
    resetForm();
    setShowForm(false);
    await refresh();
  };

  const handleEdit = (alert: Alert) => {
    setEditingAlert(alert);
    setForm({
      name: alert.name,
      locations: alert.locations,
      minPrice: alert.minPrice || 0,
      maxPrice: alert.maxPrice || 600000,
      minAcres: alert.minAcres || 0.25,
      propertyTypes: alert.propertyTypes,
      newConstructionOnly: alert.newConstructionOnly,
      notifyBy: channelsToNotifyChoice(alert.notifyBy),
      phone: alert.phone || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    await deleteAlert(id);
    await refresh();
  };

  const handleSyncCloud = async () => {
    setSyncing(true);
    try {
      const result = await migrateLocalAlertsToCloud();
      setStorageMode(result.mode);
      if (result.error) {
        alert(result.error);
      } else if (result.mode === 'cloud') {
        alert(`Synced ${result.alerts} alerts and ${result.matches} matches to Supabase`);
        await refresh();
      }
    } finally {
      setSyncing(false);
    }
  };

  const handleRematch = async () => {
    setRematching(true);
    try {
      const res = await fetch('/api/alerts/rematch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alerts }),
      });
      const data = await res.json();
      if (data.matches?.length) {
        const { addMatches } = await import('@/lib/alerts/supabase-store');
        await addMatches(data.matches);
        try {
          ingestAlertMatches(data.matches);
        } catch {
          /* */
        }
      }
      await refresh();
      setActiveTab('matches');
    } finally {
      setRematching(false);
    }
  };

  const toggleLocation = (loc: Location) => {
    setForm((f) => ({
      ...f,
      locations: f.locations.includes(loc)
        ? f.locations.filter((l) => l !== loc)
        : [...f.locations, loc],
    }));
  };

  const toggleType = (t: PropertyType) => {
    setForm((f) => ({
      ...f,
      propertyTypes: f.propertyTypes.includes(t)
        ? f.propertyTypes.filter((x) => x !== t)
        : [...f.propertyTypes, t],
    }));
  };

  return (
    <div className="p-6 sm:p-10 max-w-5xl mx-auto">
      <div className="page-header flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-6 mb-6 border-b">
        <div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-neutral-500 font-semibold mb-2">
            Inventory
          </div>
          <h1 className="text-3xl font-medium tracking-tight font-serif">Property Alerts</h1>
          <p className="text-neutral-500 mt-2 text-sm max-w-xl">
            SMS-first matching on every MLS import. Cloud-synced when signed in.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span
              className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border ${
                storageMode === 'cloud'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-slate-50 text-slate-600 border-slate-200'
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  storageMode === 'cloud' ? 'bg-emerald-500' : 'bg-slate-400'
                }`}
              />
              {storageMode === 'cloud' ? 'Supabase · brokerage synced' : 'This device only'}
              {loading ? ' · loading…' : ''}
            </span>
            {supabaseOn && storageMode === 'local' && (
              <button
                type="button"
                onClick={handleSyncCloud}
                disabled={syncing}
                className="text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full border hover:border-slate-900 disabled:opacity-50"
              >
                {syncing ? 'Syncing…' : 'Sync device → cloud'}
              </button>
            )}
            {!supabaseOn && (
              <Link href="/setup" className="text-[11px] text-slate-500 underline">
                Configure Supabase
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleRematch}
            disabled={rematching || alerts.length === 0}
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold border rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            {rematching ? 'Matching…' : 'Re-match board'}
          </button>
          <button
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(true);
            }}
            className="px-3 py-2 text-[11px] uppercase tracking-wider font-semibold bg-slate-900 text-white rounded-lg"
          >
            New alert
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <Tab
          active={activeTab === 'alerts'}
          onClick={() => setActiveTab('alerts')}
          label={`Alerts (${alerts.length})`}
        />
        <Tab
          active={activeTab === 'matches'}
          onClick={() => setActiveTab('matches')}
          label={`Matches (${matchCount})`}
        />
      </div>

      {activeTab === 'matches' ? (
        <RecentMatches />
      ) : (
        <div className="space-y-3">
          {showForm && (
            <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-4">
              <div className="text-sm font-semibold">
                {editingAlert ? 'Edit alert' : 'New property alert'}
              </div>
              <input
                className="w-full border rounded-xl px-3 py-2 text-sm"
                placeholder="Alert name (e.g. Rigby land under 200k)"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <div>
                <div className="text-xs font-semibold text-slate-500 mb-2">Locations</div>
                <div className="space-y-3 max-h-48 overflow-y-auto">
                  {COUNTIES.map(({ county, locations }) => (
                    <div key={county}>
                      <div className="text-[10px] uppercase tracking-wider text-slate-400 mb-1">
                        {county}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {locations.map((loc) => (
                          <button
                            key={loc}
                            type="button"
                            onClick={() => toggleLocation(loc)}
                            className={`px-2 py-1 text-[11px] rounded-full border ${
                              form.locations.includes(loc)
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-600'
                            }`}
                          >
                            {loc}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <input
                  type="number"
                  className="border rounded-xl px-3 py-2 text-sm"
                  placeholder="Min price"
                  value={form.minPrice || ''}
                  onChange={(e) => setForm({ ...form, minPrice: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  className="border rounded-xl px-3 py-2 text-sm"
                  placeholder="Max price"
                  value={form.maxPrice || ''}
                  onChange={(e) => setForm({ ...form, maxPrice: Number(e.target.value) || 0 })}
                />
                <input
                  type="number"
                  step="0.1"
                  className="border rounded-xl px-3 py-2 text-sm"
                  placeholder="Min acres"
                  value={form.minAcres || ''}
                  onChange={(e) => setForm({ ...form, minAcres: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PROPERTY_TYPES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => toggleType(t)}
                    className={`px-2.5 py-1 text-[11px] rounded-full border ${
                      form.propertyTypes.includes(t)
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <select
                  className="border rounded-xl px-3 py-2 text-sm"
                  value={form.notifyBy}
                  onChange={(e) =>
                    setForm({ ...form, notifyBy: e.target.value as NotifyChoice })
                  }
                >
                  <option value="sms">SMS first</option>
                  <option value="email">Email</option>
                  <option value="both">SMS + Email</option>
                </select>
                <input
                  className="border rounded-xl px-3 py-2 text-sm"
                  placeholder="Phone for SMS"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={form.newConstructionOnly}
                  onChange={(e) =>
                    setForm({ ...form, newConstructionOnly: e.target.checked })
                  }
                />
                New construction only
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="btn-primary px-4 py-2 rounded-xl text-sm font-semibold"
                >
                  Save alert
                </button>
                <button
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                  className="px-4 py-2 rounded-xl text-sm border"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {alerts.map((a) => (
            <div
              key={a.id}
              className="bg-white border rounded-2xl p-4 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div>
                <div className="font-medium text-slate-900 flex items-center gap-2">
                  {a.name}
                  {!a.active && (
                    <span className="text-[10px] uppercase text-slate-400">Paused</span>
                  )}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {a.locations.join(', ')} ·{' '}
                  {a.minPrice || a.maxPrice
                    ? `$${(a.minPrice || 0).toLocaleString()}–$${(a.maxPrice || 0).toLocaleString()}`
                    : 'Any price'}{' '}
                  · {a.propertyTypes.join(', ')}
                </div>
                <div className="text-[11px] text-slate-400 mt-1">
                  Notify: {(a.notifyBy || []).join(', ')}
                  {a.phone ? ` · ${a.phone}` : ''}
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleEdit(a)}
                  className="px-3 py-1.5 text-xs font-semibold border rounded-lg"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(a.id)}
                  className="px-3 py-1.5 text-xs font-semibold border border-rose-200 text-rose-700 rounded-lg"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}

          {!loading && alerts.length === 0 && !showForm && (
            <div className="text-center py-12 text-slate-400 text-sm border rounded-2xl bg-white">
              No alerts yet — create one to start SMS matching on import.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Tab({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 text-xs font-semibold rounded-full border ${
        active ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600'
      }`}
    >
      {label}
    </button>
  );
}
