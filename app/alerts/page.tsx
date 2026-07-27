'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Location, PropertyType } from '@/types/alerts';
import { COUNTIES } from '@/lib/geo/counties';
import {
  getAlerts,
  saveAlert,
  deleteAlert,
  getMatches,
  isSupabaseConfigured,
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
  const [rematching, setRematching] = useState(false);

  const [form, setForm] = useState({
    name: '',
    locations: [] as Location[],
    minPrice: 0,
    maxPrice: 600000,
    minAcres: 0.25,
    propertyTypes: ['Single Family', 'New Construction'] as PropertyType[],
    newConstructionOnly: false,
    notifyBy: 'sms' as 'sms' | 'email' | 'both',
    phone: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setSupabaseOn(isSupabaseConfigured());
      const [a, m] = await Promise.all([getAlerts(), getMatches()]);
      setAlerts(a);
      setMatchCount(m.length);
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
    await saveAlert({
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
      notifyBy: form.notifyBy,
      phone: form.phone || undefined,
      createdAt: editingAlert?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as Alert);
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
      notifyBy: alert.notifyBy,
      phone: alert.phone || '',
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this alert?')) return;
    await deleteAlert(id);
    await refresh();
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
        } catch (err) {
          console.warn('Portal ingest failed', err);
        }
      }
      await refresh();
      setActiveTab('matches');
    } catch (e) {
      console.error(e);
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
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Property Alerts</h1>
          <p className="text-gray-600 mt-1">
            AI matching + SMS-first notifications · matches push to client portal
            {supabaseOn ? (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                Supabase connected
              </span>
            ) : (
              <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                Local storage mode
              </span>
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleRematch}
            disabled={rematching || alerts.length === 0}
            className="border border-gray-300 text-gray-800 px-4 py-2.5 rounded-2xl text-sm font-medium hover:bg-gray-50 transition disabled:opacity-50"
          >
            {rematching ? 'Re-matching…' : 'Re-run Matching'}
          </button>
          <button
            onClick={() => {
              resetForm();
              setShowForm(!showForm);
            }}
            className="bg-black text-white px-6 py-2.5 rounded-2xl text-sm font-medium hover:bg-gray-900 transition"
          >
            {showForm ? 'Cancel' : '+ New Alert'}
          </button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${
            activeTab === 'alerts' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-4 py-2 rounded-xl text-sm font-medium ${
            activeTab === 'matches' ? 'bg-black text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          Matches ({matchCount})
        </button>
        <a
          href="/portal"
          className="px-4 py-2 rounded-xl text-sm font-medium bg-emerald-50 text-emerald-800 border border-emerald-100 hover:bg-emerald-100"
        >
          Client portal →
        </a>
      </div>

      {showForm && (
        <div className="bg-white border rounded-3xl p-6 mb-6 shadow-sm space-y-4">
          <h2 className="font-semibold">{editingAlert ? 'Edit alert' : 'Create alert'}</h2>
          <input
            className="w-full border rounded-xl px-3 py-2 text-sm"
            placeholder="Alert name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div>
            <div className="text-xs text-gray-500 mb-2">Locations</div>
            <div className="space-y-3">
              {COUNTIES.map(({ county, locations }) => (
                <div key={county}>
                  <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">{county}</div>
                  <div className="flex flex-wrap gap-2">
                    {locations.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => toggleLocation(loc)}
                        className={`px-3 py-1.5 rounded-full text-xs border ${
                          form.locations.includes(loc)
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-gray-600'
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
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-500">
              Min $
              <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" value={form.minPrice} onChange={(e) => setForm((f) => ({ ...f, minPrice: Number(e.target.value) }))} />
            </label>
            <label className="text-xs text-gray-500">
              Max $
              <input type="number" className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" value={form.maxPrice} onChange={(e) => setForm((f) => ({ ...f, maxPrice: Number(e.target.value) }))} />
            </label>
            <label className="text-xs text-gray-500">
              Min acres
              <input type="number" step="0.01" className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" value={form.minAcres} onChange={(e) => setForm((f) => ({ ...f, minAcres: Number(e.target.value) }))} />
            </label>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-2">Property types</div>
            <div className="flex flex-wrap gap-2">
              {PROPERTY_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => toggleType(t)} className={`px-3 py-1.5 rounded-full text-xs border ${form.propertyTypes.includes(t) ? 'bg-black text-white border-black' : 'bg-white text-gray-600'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={form.newConstructionOnly} onChange={(e) => setForm((f) => ({ ...f, newConstructionOnly: e.target.checked }))} />
            New construction only
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="text-xs text-gray-500">
              Notify by
              <select className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" value={form.notifyBy} onChange={(e) => setForm((f) => ({ ...f, notifyBy: e.target.value as 'sms' | 'email' | 'both' }))}>
                <option value="sms">SMS</option>
                <option value="email">Email</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="text-xs text-gray-500">
              Phone
              <input className="mt-1 w-full border rounded-xl px-3 py-2 text-sm" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="(208) 555-0100" />
            </label>
          </div>
          <button type="button" onClick={handleSave} className="w-full py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-medium hover:bg-emerald-500">
            Save alert
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Loading…</div>
      ) : activeTab === 'matches' ? (
        <div className="space-y-4">
          <div className="text-sm text-gray-500 mb-2">
            Matches from Navica imports and re-runs. New hits also appear in the{' '}
            <a href="/portal" className="text-emerald-700 underline">client portal</a>.
          </div>
          <RecentMatches limit={30} />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 border border-dashed rounded-3xl text-gray-400">
          No alerts yet — create one to start matching Jefferson County inventory.
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <div key={alert.id} className="bg-white border rounded-2xl p-5 flex flex-wrap items-start justify-between gap-4 shadow-sm">
              <div>
                <div className="font-semibold text-gray-900">{alert.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {alert.locations.join(', ')} · {alert.propertyTypes.join(', ')}
                  {alert.maxPrice ? ` · up to $${alert.maxPrice.toLocaleString()}` : ''}
                </div>
                <div className="text-xs text-gray-400 mt-1">
                  Notify: {alert.notifyBy}
                  {alert.phone ? ` · ${alert.phone}` : ''}
                  {alert.newConstructionOnly ? ' · new construction only' : ''}
                </div>
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => handleEdit(alert)} className="px-3 py-1.5 text-sm border rounded-xl hover:bg-gray-50">Edit</button>
                <button type="button" onClick={() => handleDelete(alert.id)} className="px-3 py-1.5 text-sm border border-rose-200 text-rose-700 rounded-xl hover:bg-rose-50">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
