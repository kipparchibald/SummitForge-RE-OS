/**
 * Client handoff of the selected GIS parcel (including curved boundary ring)
 * into AI Plat Studio — sessionStorage so the real geometry is never lost.
 */

export const PLAT_PARCEL_KEY = 'summitforge_plat_parcel';

export type PlatParcelHandoff = {
  savedAt: string;
  pin: string | null;
  county: string | null;
  address: string | null;
  acres: number | null;
  lat: number | null;
  lng: number | null;
  /** Real tax-lot ring [lng, lat][] */
  ring: [number, number][];
  askPrice?: number | null;
};

export function savePlatParcel(p: Omit<PlatParcelHandoff, 'savedAt'>): void {
  if (typeof window === 'undefined') return;
  try {
    const payload: PlatParcelHandoff = {
      ...p,
      savedAt: new Date().toISOString(),
      ring: (p.ring || []).map(([lng, lat]) => [lng, lat] as [number, number]),
    };
    sessionStorage.setItem(PLAT_PARCEL_KEY, JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function loadPlatParcel(): PlatParcelHandoff | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(PLAT_PARCEL_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PlatParcelHandoff;
    if (!p?.ring || p.ring.length < 3) return null;
    return p;
  } catch {
    return null;
  }
}

export function clearPlatParcel(): void {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(PLAT_PARCEL_KEY);
  } catch {
    /* ignore */
  }
}
