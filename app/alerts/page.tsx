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
    const payload: Alert = {
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
    };
    await saveAlert(payload);
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
        // Client also stores (API may run server-side without localStorage)
        const { addMatches } = await import('@/lib/alerts/supabase-store');
        await addMatches(data.matches);
        // Zillow-style: surface matches in the buyer client portal
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

  // Need rest of original file - load from surgical file instead
  return null;
}
