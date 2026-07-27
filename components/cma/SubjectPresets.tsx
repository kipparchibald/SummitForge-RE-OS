'use client';

import type { SubjectProperty } from '@/lib/cma/engine';

export const PRESET_LAND: SubjectProperty = {
  address: '12.5 acres near Rigby, ID',
  listPrice: 650000,
  acres: 12.5,
  propertyType: 'Land',
  city: 'Rigby',
};

export const PRESET_HOME: SubjectProperty = {
  address: '789 Lindy Lane, Rigby, ID',
  listPrice: 489000,
  sqft: 1680,
  beds: 3,
  baths: 2,
  propertyType: 'Single Family',
  city: 'Rigby',
  yearBuilt: 2018,
};

export const PRESET_NC: SubjectProperty = {
  address: '172 Kiana Dr, Rigby, ID',
  listPrice: 512000,
  sqft: 1850,
  beds: 4,
  baths: 2.5,
  propertyType: 'New Construction',
  city: 'Rigby',
  yearBuilt: 2026,
};

export type SubjectPresetId = 'land' | 'home' | 'nc';

export function subjectMatchesPreset(s: SubjectProperty, id: SubjectPresetId): boolean {
  const p = id === 'land' ? PRESET_LAND : id === 'home' ? PRESET_HOME : PRESET_NC;
  return s.address === p.address && s.propertyType === p.propertyType;
}

/** One-click demo subjects — land, existing home, new construction. */
export default function SubjectPresets({
  subject,
  onSelect,
}: {
  subject: SubjectProperty;
  onSelect: (next: SubjectProperty) => void;
}) {
  const active: SubjectPresetId | null = subjectMatchesPreset(subject, 'land')
    ? 'land'
    : subjectMatchesPreset(subject, 'home')
      ? 'home'
      : subjectMatchesPreset(subject, 'nc')
        ? 'nc'
        : null;

  const btn = (id: SubjectPresetId, label: string, preset: SubjectProperty) => (
    <button
      key={id}
      type="button"
      onClick={() => onSelect({ ...preset })}
      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
        active === id
          ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] uppercase tracking-wider text-slate-400">Demo subject</div>
      <div className="flex flex-wrap gap-1.5">
        {btn('land', 'Land · 12.5 ac', PRESET_LAND)}
        {btn('home', 'Home · Lindy', PRESET_HOME)}
        {btn('nc', 'NC · Kiana', PRESET_NC)}
      </div>
    </div>
  );
}
