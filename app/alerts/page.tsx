'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Alert, Location, PropertyType } from '@/types/alerts';
import {
  getAlerts,
  saveAlert,
  deleteAlert,
  getMatches,
  isSupabaseConfigured,
} from '@/lib/alerts/supabase-store';
import RecentMatches from '@/components/RecentMatches';

const LOCATIONS: Location[] = ['Rigby', 'Ririe', 'Roberts', 'Hamer', 'Terreton', 'Idaho Falls Area'];
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

  const [formData, setFormData] = useState({
    name: '',
    locations: [] as Location[],
    minPrice: 300000,
    maxPrice: 700000,
    minAcres: 0.25,
    propertyTypes: [] as PropertyType[],
    newConstructionOnly: false,
    notifyBy: ['sms', 'in-app'] as ('sms' | 'in-app' | 'email')[],
    phone: '',
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    setSupabaseOn(isSupabaseConfigured());
    let list = await getAlerts('user_kipp');
    if (list.length === 0) {
      const seed: Alert = {
        id: 'alert_rigby_nc',
        userId: 'user_kipp',
        brokerageId: 'archibald_bagley',
        name: 'Rigby New Construction',
        locations: ['Rigby'],
        minPrice: 350000,
        maxPrice: 650000,
        minAcres: 0.3,
        propertyTypes: ['Single Family', 'New Construction'],
        newConstructionOnly: true,
        notifyBy: ['sms', 'in-app'],
        frequency: 'instant',
        phone: '',
        active: true,
        createdAt: new Date().toISOString(),
      };
      await saveAlert(seed);
      list = [seed];
    }
    setAlerts(list);
    const matches = await getMatches(100);
    setMatchCount(matches.length);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const resetForm = () => {
    setFormData({
      name: '',
      locations: [],
      minPrice: 300000,
      maxPrice: 700000,
      minAcres: 0.25,
      propertyTypes: [],
      newConstructionOnly: false,
      notifyBy: ['sms', 'in-app'],
      phone: '',
    });
    setEditingAlert(null);
    setShowForm(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newAlert: Alert = {
      id: editingAlert ? editingAlert.id : `alert_${Date.now()}`,
      userId: 'user_kipp',
      brokerageId: 'archibald_bagley',
      name: formData.name,
      locations: formData.locations,
      minPrice: formData.minPrice,
      maxPrice: formData.maxPrice,
      minAcres: formData.minAcres,
      propertyTypes: formData.propertyTypes,
      newConstructionOnly: formData.newConstructionOnly,
      notifyBy: formData.notifyBy,
      frequency: 'instant',
      phone: formData.phone || undefined,
      active: true,
      createdAt: editingAlert ? editingAlert.createdAt : new Date().toISOString(),
    };

    await saveAlert(newAlert);
    await refresh();
    resetForm();
  };

  const toggleAlert = async (id: string) => {
    const alert = alerts.find(a => a.id === id);
    if (!alert) return;
    await saveAlert({ ...alert, active: !alert.active });
    await refresh();
  };

  const editAlert = (alert: Alert) => {
    setEditingAlert(alert);
    setFormData({
      name: alert.name,
      locations: alert.locations,
      minPrice: alert.minPrice || 300000,
      maxPrice: alert.maxPrice || 700000,
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
        // Client also stores (API may run server-side without localStorage)
        const { addMatches } = await import('@/lib/alerts/supabase-store');
        await addMatches(data.matches);
      }
      await refresh();
      setActiveTab('matches');
    } catch (e) {
      console.error(e);
    } finally {
      setRematching(false);
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Property Alerts</h1>
          <p className="text-gray-600 mt-1">
            AI matching + SMS-first notifications
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

      <div className="flex gap-1 mb-8 bg-gray-100 p-1 rounded-2xl w-fit">
        <button
          onClick={() => setActiveTab('alerts')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition ${
            activeTab === 'alerts' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
          }`}
        >
          My Alerts ({alerts.length})
        </button>
        <button
          onClick={() => setActiveTab('matches')}
          className={`px-5 py-2 text-sm font-medium rounded-xl transition ${
            activeTab === 'matches' ? 'bg-white shadow-sm' : 'hover:bg-gray-200'
          }`}
        >
          Recent Matches ({matchCount})
        </button>
      </div>

      <div className="bg-blue-50 border border-blue-100 rounded-3xl p-5 mb-8 text-sm">
        <div className="font-medium text-blue-900 mb-1">AI-Powered Matching Active</div>
        <div className="text-blue-700">
          New Navica imports are scored against your active alerts. SMS is preferred when a phone is
          set on the alert. Matches show address, price, and score instantly.
        </div>
      </div>

      {showForm && (
        <div className="bg-white border border-gray-200 rounded-3xl p-8 mb-8 shadow-sm">
          <h3 className="font-semibold text-xl mb-6">
            {editingAlert ? 'Edit Alert' : 'Create New Alert'}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium mb-2">Alert Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={e => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g. Rigby New Construction Under $550k"
                className="w-full border border-gray-300 rounded-2xl px-4 py-3"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Locations</label>
              <div className="flex flex-wrap gap-2">
                {LOCATIONS.map(loc => (
                  <button
                    key={loc}
                    type="button"
                    onClick={() => {
                      const newLocs = formData.locations.includes(loc)
                        ? formData.locations.filter(l => l !== loc)
                        : [...formData.locations, loc];
                      setFormData({ ...formData, locations: newLocs });
                    }}
                    className={`px-4 py-2 rounded-2xl text-sm border transition ${
                      formData.locations.includes(loc)
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {loc}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium mb-2">Min Price</label>
                <input
                  type="number"
                  value={formData.minPrice}
                  onChange={e => setFormData({ ...formData, minPrice: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-2xl px-4 py-3"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Max Price</label>
                <input
                  type="number"
                  value={formData.maxPrice}
                  onChange={e => setFormData({ ...formData, maxPrice: Number(e.target.value) })}
                  className="w-full border border-gray-300 rounded-2xl px-4 py-3"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Minimum Acres</label>
              <input
                type="number"
                step="0.1"
                value={formData.minAcres}
                onChange={e => setFormData({ ...formData, minAcres: Number(e.target.value) })}
                className="w-full border border-gray-300 rounded-2xl px-4 py-3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Property Types</label>
              <div className="flex flex-wrap gap-2">
                {PROPERTY_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      const newTypes = formData.propertyTypes.includes(type)
                        ? formData.propertyTypes.filter(t => t !== type)
                        : [...formData.propertyTypes, type];
                      setFormData({ ...formData, propertyTypes: newTypes });
                    }}
                    className={`px-4 py-2 rounded-2xl text-sm border transition ${
                      formData.propertyTypes.includes(type)
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="newConstruction"
                checked={formData.newConstructionOnly}
                onChange={e => setFormData({ ...formData, newConstructionOnly: e.target.checked })}
                className="w-4 h-4"
              />
              <label htmlFor="newConstruction" className="text-sm">
                New Construction only
              </label>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">SMS phone (preferred)</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+12085551234"
                className="w-full border border-gray-300 rounded-2xl px-4 py-3"
              />
              <p className="text-xs text-gray-500 mt-1">
                SMS-first: phone is primary. Email can be captured later for richer features.
              </p>
            </div>

            <div className="pt-2">
              <div className="text-xs text-gray-500 mb-2">Notification channels</div>
              <div className="flex gap-2">
                {(['sms', 'in-app', 'email'] as const).map(ch => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => {
                      const next = formData.notifyBy.includes(ch)
                        ? formData.notifyBy.filter(c => c !== ch)
                        : [...formData.notifyBy, ch];
                      setFormData({ ...formData, notifyBy: next });
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs border capitalize ${
                      formData.notifyBy.includes(ch)
                        ? 'bg-black text-white border-black'
                        : 'border-gray-300'
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-4">
              <button
                type="submit"
                className="bg-black text-white px-8 py-3 rounded-2xl font-medium hover:bg-gray-900 transition"
              >
                {editingAlert ? 'Update Alert' : 'Create Alert'}
              </button>
            </div>
          </form>
        </div>
      )}

      {loading && (
        <div className="text-center py-12 text-gray-400">Loading alerts…</div>
      )}

      {!loading && activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.length === 0 && (
            <div className="text-center py-16 text-gray-500 bg-white border border-dashed border-gray-200 rounded-3xl">
              <div className="text-4xl mb-3">🔔</div>
              <div className="font-medium">No alerts yet</div>
              <div className="text-sm mt-1">Create one to start receiving SMS + in-app matches</div>
            </div>
          )}

          {alerts.map(alert => (
            <div
              key={alert.id}
              className="bg-white border border-gray-200 rounded-3xl p-6 flex justify-between items-center shadow-sm"
            >
              <div>
                <div className="font-semibold text-lg">{alert.name}</div>
                <div className="text-sm text-gray-500 mt-1">
                  {alert.locations.join(', ')} • {alert.minAcres}+ acres •{' '}
                  {alert.newConstructionOnly ? 'New Construction Only' : 'Any Type'}
                </div>
                <div className="text-xs text-gray-400 mt-1 flex items-center gap-2 flex-wrap">
                  <span>
                    ${alert.minPrice?.toLocaleString()} – ${alert.maxPrice?.toLocaleString()}
                  </span>
                  {alert.phone && <span className="text-emerald-600">SMS: {alert.phone}</span>}
                  <span className="inline-flex gap-1">
                    {alert.notifyBy.map(ch => (
                      <span
                        key={ch}
                        className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wide ${
                          ch === 'sms'
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ch}
                      </span>
                    ))}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className={`text-xs px-3 py-1 rounded-full font-medium ${
                    alert.active
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {alert.active ? 'Active' : 'Paused'}
                </div>
                <button
                  onClick={() => toggleAlert(alert.id)}
                  className="text-sm px-4 py-2 border rounded-2xl hover:bg-gray-50"
                >
                  {alert.active ? 'Pause' : 'Activate'}
                </button>
                <button
                  onClick={() => editAlert(alert)}
                  className="text-sm px-4 py-2 border rounded-2xl hover:bg-gray-50"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(alert.id)}
                  className="text-sm text-red-500 px-3 hover:text-red-600"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {!loading && activeTab === 'matches' && (
        <div className="space-y-4">
          <div className="text-sm text-gray-500 mb-2">
            Matches from Navica imports and re-runs. SMS preferred when phone is set.
          </div>
          <RecentMatches limit={30} />
        </div>
      )}
    </div>
  );
}
