'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl';
import type { MapLayerMouseEvent, MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  setLastSyncTimestamp,
  getLastSyncTimestamp,
  formatLastSyncTime,
  isLastSyncRecent,
} from '@/lib/import/lastSync';
import DevelopmentPotential from '@/components/development/DevelopmentPotential';
import { applyParcelToCma, saveGisCmaHandoff } from '@/lib/cma/from-gis';
import { savePlatParcel } from '@/lib/development/plat-handoff';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type SizeVerification = {
  acres: number;
  acresRounded: number;
  areaSqFt: number;
  areaSqM: number;
  legalAcres: number | null;
  idwrStAreaAcres: number | null;
  geodesicAcres: number;
  primarySource: string;
  variancePct: number | null;
  verified: boolean;
  notes: string[];
};

type OwnershipInfo = {
  owner: string | null;
  owner2: string | null;
  mailingAddress: string | null;
  situsAddress: string | null;
  situsCity: string | null;
  landValue: number | null;
  improvementValue: number | null;
  totalValue: number | null;
  yearBuilt: number | null;
  improvements: string | null;
  legalDescription: string | null;
  assessmentCategory: string | null;
  zoning?: string | null;
  source: string | null;
};

type SosPrincipal = { role: string; name: string; address?: string | null };

type SosInfo = {
  matched: boolean;
  query?: string;
  entity?: {
    id: number;
    title: string;
    status: string | null;
    entityType: string | null;
  } | null;
  registeredAgent: string | null;
  status: string | null;
  entityType: string | null;
  principals: SosPrincipal[];
  beneficialNames: string[];
  sosUrl: string | null;
  notes: string[];
  source?: string;
} | null;

type GisParcel = {
  pin: string | null;
  county: string | null;
  owner: string | null;
  owner2?: string | null;
  acres: number | null;
  areaSqFt: number | null;
  perimeterFt: number | null;
  centroid: { lat: number; lng: number } | null;
  ring: [number, number][];
  geojson: GeoJSON.Feature | null;
  source: string;
  unavailable: string[];
  size: SizeVerification | null;
  ownership: OwnershipInfo | null;
  yearBuilt: number | null;
  improvements: string | null;
  assessedValue: number | null;
  landValue?: number | null;
  improvementValue?: number | null;
  /** Full parcel / situs (property) address */
  parcelAddress?: string | null;
  situsAddress: string | null;
  situsCity?: string | null;
  /** Owner mailing / tax-bill address */
  mailingAddress?: string | null;
  legalDescription?: string | null;
  landUse: string | null;
  zoning: string | null;
  notes: string;
  sos?: SosInfo;
};

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export default function MonitoringDashboard() {
  const mapRef = useRef<MapRef>(null);
  const [mapViewState, setMapViewState] = useState({
    longitude: -111.915,
    latitude: 43.672,
    zoom: 13,
  });
  const [selected, setSelected] = useState<GisParcel | null>(null);
  const [outlineFc, setOutlineFc] = useState<GeoJSON.FeatureCollection | null>(null);
  const [pinQuery, setPinQuery] = useState('');
  const [identifying, setIdentifying] = useState(false);
  const [loadingOutlines, setLoadingOutlines] = useState(false);
  const [banner, setBanner] = useState(
    'Click any tax lot on the map to load its boundary, ownership (when available), and acreage from Idaho statewide parcels.'
  );
  const [lastPull, setLastPull] = useState('');
  const [syncIsRecent, setSyncIsRecent] = useState(false);
  const [cursor, setCursor] = useState<'grab' | 'pointer' | 'progress'>('pointer');
  const [askPrice, setAskPrice] = useState('');
  const [platOpen, setPlatOpen] = useState(false);
  /** Default: pure aerial photo (satellite) for parcel review */
  const [mapBasemap, setMapBasemap] = useState<'aerial' | 'hybrid' | 'streets'>('aerial');
  const mapStyle =
    mapBasemap === 'aerial'
      ? 'mapbox://styles/mapbox/satellite-v9'
      : mapBasemap === 'hybrid'
        ? 'mapbox://styles/mapbox/satellite-streets-v12'
        : 'mapbox://styles/mapbox/streets-v12';

  useEffect(() => {
    const ts = getLastSyncTimestamp();
    if (ts) setLastPull(formatLastSyncTime(ts));
    setSyncIsRecent(isLastSyncRecent());
    const onUpdate = () => {
      const newTs = getLastSyncTimestamp();
      setLastPull(formatLastSyncTime(newTs));
      setSyncIsRecent(isLastSyncRecent());
    };
    window.addEventListener('navica-pull-updated', onUpdate);
    return () => window.removeEventListener('navica-pull-updated', onUpdate);
  }, []);

  const selectedGeoJson = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!selected?.geojson) return null;
    return { type: 'FeatureCollection', features: [selected.geojson] };
  }, [selected]);

  const identifyAt = useCallback(async (lat: number, lng: number) => {
    setIdentifying(true);
    setCursor('progress');
    setBanner(`Looking up parcel at ${lat.toFixed(5)}, ${lng.toFixed(5)}…`);
    setPlatOpen(false);
    try {
      const res = await fetch(
        `/api/gis/parcel?lat=${encodeURIComponent(String(lat))}&lng=${encodeURIComponent(String(lng))}`
      );
      const data = await res.json();
      if (!res.ok || !data.parcel) {
        setSelected(null);
        setBanner(data.error || 'No parcel found at this location.');
        return;
      }
      const p = data.parcel as GisParcel;
      setSelected(p);
      const sizeNote =
        p.size?.verified === false
          ? ' · size needs review'
          : p.size?.verified
            ? ' · size verified'
            : '';
      setBanner(
        `Selected PIN ${p.pin || '—'} · ${p.county || '—'} County` +
          (p.owner ? ` · ${p.owner}` : ' · owner via county layer when available') +
          (p.acres != null ? ` · ${p.acres} ac` : '') +
          sizeNote
      );
      if (p.centroid) {
        setMapViewState((v) => ({
          ...v,
          longitude: p.centroid!.lng,
          latitude: p.centroid!.lat,
          zoom: Math.max(v.zoom, 15),
        }));
      }
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Parcel lookup failed');
      setSelected(null);
    } finally {
      setIdentifying(false);
      setCursor('pointer');
    }
  }, []);

  const lookupPin = async () => {
    const pin = pinQuery.trim();
    if (!pin) return;
    setIdentifying(true);
    setBanner(`Looking up PIN ${pin}…`);
    setPlatOpen(false);
    try {
      const res = await fetch(`/api/gis/parcel?pin=${encodeURIComponent(pin)}`);
      const data = await res.json();
      if (!res.ok || !data.parcel) {
        setBanner(data.error || 'PIN not found');
        return;
      }
      const p = data.parcel as GisParcel;
      setSelected(p);
      setBanner(`Found PIN ${p.pin} · ${p.acres ?? '—'} ac · ${p.county}`);
      if (p.centroid) {
        setMapViewState({
          longitude: p.centroid.lng,
          latitude: p.centroid.lat,
          zoom: 16,
        });
      }
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Lookup failed');
    } finally {
      setIdentifying(false);
    }
  };

  const loadOutlines = useCallback(async () => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const b = map.getBounds();
    if (!b) return;
    const zoom = map.getZoom();
    if (zoom < 13) {
      setOutlineFc(null);
      setBanner('Zoom in to z13+ to load parcel outlines, or click the map to identify a lot.');
      return;
    }
    setLoadingOutlines(true);
    try {
      const bbox = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()].join(',');
      const res = await fetch(`/api/gis/parcel?bbox=${encodeURIComponent(bbox)}`);
      const data = await res.json();
      if (!res.ok) {
        setOutlineFc(null);
        if (data.error) setBanner(data.error);
        return;
      }
      setOutlineFc(data.geojson);
      setBanner(
        `Loaded ${data.count} parcel outlines in view. Click a lot for full details + platting.`
      );
    } catch {
      setOutlineFc(null);
    } finally {
      setLoadingOutlines(false);
    }
  }, []);

  const onMapClick = (e: MapLayerMouseEvent) => {
    const { lng, lat } = e.lngLat;
    void identifyAt(lat, lng);
  };

  const listingForPlat = useMemo(() => {
    if (!selected) return null;
    const price = askPrice ? Number(askPrice) : undefined;
    return {
      address: selected.situsAddress || selected.pin || 'GIS parcel',
      acres: selected.acres ?? undefined,
      price: price && price > 0 ? price : undefined,
      lat: selected.centroid?.lat,
      lng: selected.centroid?.lng,
      apn: selected.pin ?? undefined,
      county: selected.county ?? undefined,
      ring: selected.ring,
    };
  }, [selected, askPrice]);

  const openPlatStudio = () => {
    if (!selected?.centroid) return;
    // Persist REAL boundary ring so AI Plat Studio never falls back to a concept square
    if (selected.ring?.length >= 3) {
      savePlatParcel({
        pin: selected.pin,
        county: selected.county,
        address: selected.situsAddress || selected.pin || 'GIS parcel',
        acres: selected.acres,
        lat: selected.centroid.lat,
        lng: selected.centroid.lng,
        ring: selected.ring,
        askPrice: askPrice ? Number(askPrice) : null,
      });
    }
    const q = new URLSearchParams({
      pin: selected.pin || '',
      lat: String(selected.centroid.lat),
      lng: String(selected.centroid.lng),
      acres: String(selected.acres || ''),
      county: selected.county || '',
      address: selected.situsAddress || selected.pin || 'GIS parcel',
      from: 'gis',
    });
    window.location.href = `/development/plat?${q.toString()}`;
  };

  /** Persist full assessor snapshot and open CMA with subject hydrated. */
  const sendToCma = () => {
    if (!selected) return;
    const { handoff } = applyParcelToCma(selected);
    saveGisCmaHandoff(handoff);
    const q = new URLSearchParams({ from: 'gis' });
    if (selected.pin) q.set('pin', selected.pin);
    window.location.href = `/cma?${q.toString()}`;
  };

  return (
    <div className="p-4 sm:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight">GIS Parcel Explorer</h1>
          <p className="text-sm text-gray-600 mt-1">
            Click a tax lot → ownership, year built, assessed value &amp; acres → Send to CMA or plat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-3 py-1 text-xs rounded-full border font-medium ${
              syncIsRecent
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : lastPull
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-gray-100 text-gray-500'
            }`}
          >
            Navica · Last: {lastPull || '—'}
          </span>
          <Link
            href="/development/plat"
            className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500"
          >
            AI Plat Studio
          </Link>
        </div>
      </div>

      <div
        className={`mb-3 text-sm px-4 py-2.5 rounded-xl border ${
          identifying
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-slate-50 border-slate-200 text-slate-700'
        }`}
      >
        {banner}
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          value={pinQuery}
          onChange={(e) => setPinQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookupPin()}
          placeholder="Search PIN / APN (e.g. RP04N34E360000)"
          className="border rounded-xl px-3 py-2 text-sm flex-1 min-w-[200px] font-mono"
        />
        <button
          type="button"
          onClick={lookupPin}
          disabled={identifying}
          className="px-4 py-2 rounded-xl bg-slate-900 text-white text-sm disabled:opacity-50"
        >
          Lookup PIN
        </button>
        <button
          type="button"
          onClick={loadOutlines}
          disabled={loadingOutlines}
          className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50 disabled:opacity-50"
        >
          {loadingOutlines ? 'Loading outlines…' : 'Load outlines in view'}
        </button>
        <button
          type="button"
          onClick={() => identifyAt(43.672, -111.915)}
          className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50"
        >
          Sample: Jefferson (Rigby)
        </button>
        <button
          type="button"
          onClick={() => identifyAt(43.826, -111.79)}
          className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50"
        >
          Sample: Madison (Rexburg)
        </button>
        <button
          type="button"
          onClick={() => identifyAt(43.49, -112.04)}
          className="px-4 py-2 rounded-xl border text-sm hover:bg-gray-50"
        >
          Sample: Bonneville (IF)
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4">
        {/* Map */}
        <div className="xl:col-span-3">
          <div className="h-[min(640px,70vh)] rounded-2xl border overflow-hidden shadow-sm bg-slate-100 relative">
            {MAPBOX_TOKEN ? (
              <Map
                ref={mapRef}
                {...mapViewState}
                onMove={(evt) => setMapViewState(evt.viewState)}
                onClick={onMapClick}
                cursor={cursor}
                style={{ width: '100%', height: '100%' }}
                mapStyle={mapStyle}
                mapboxAccessToken={MAPBOX_TOKEN}
                attributionControl
              >
                <NavigationControl position="top-right" />

                {outlineFc && outlineFc.features.length > 0 && (
                  <Source id="parcel-outlines" type="geojson" data={outlineFc}>
                    <Layer
                      id="parcel-outlines-line"
                      type="line"
                      paint={{
                        'line-color': '#94a3b8',
                        'line-width': 1,
                        'line-opacity': 0.85,
                      }}
                    />
                  </Source>
                )}

                {selectedGeoJson && (
                  <Source id="selected-parcel" type="geojson" data={selectedGeoJson}>
                    <Layer
                      id="selected-parcel-fill"
                      type="fill"
                      paint={{
                        'fill-color': '#10b981',
                        'fill-opacity': 0.35,
                      }}
                    />
                    <Layer
                      id="selected-parcel-line"
                      type="line"
                      paint={{
                        'line-color': '#047857',
                        'line-width': 3,
                      }}
                    />
                  </Source>
                )}

                {selected?.centroid && (
                  <Marker
                    longitude={selected.centroid.lng}
                    latitude={selected.centroid.lat}
                    anchor="center"
                  >
                    <div className="w-3 h-3 rounded-full bg-emerald-500 border-2 border-white shadow" />
                  </Marker>
                )}
              </Map>
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center gap-3">
                <p className="font-semibold text-gray-800">Mapbox token required for interactive map</p>
                <p className="text-sm text-gray-500 max-w-md">
                  Set <code className="bg-gray-200 px-1 rounded text-xs">NEXT_PUBLIC_MAPBOX_TOKEN</code> in
                  .env.local. PIN lookup and API identify still work without the basemap.
                </p>
                <button
                  type="button"
                  onClick={() => identifyAt(43.672, -111.915)}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm"
                >
                  Identify sample parcel (Rigby)
                </button>
              </div>
            )}
            {MAPBOX_TOKEN && (
              <div className="absolute top-2 left-2 z-10 flex gap-1">
                {(
                  [
                    ['aerial', 'Aerial'],
                    ['hybrid', 'Hybrid'],
                    ['streets', 'Streets'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMapBasemap(id)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shadow border backdrop-blur-sm ${
                      mapBasemap === id
                        ? 'bg-emerald-700 text-white border-emerald-800'
                        : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
            {identifying && (
              <div className="absolute inset-x-0 top-0 bg-amber-500/90 text-white text-center text-xs py-1.5 font-medium">
                Querying Idaho parcel GIS…
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Boundary: IDWR statewide parcels. Ownership: Jefferson Property Information, Madison
            MRGIS, Bonneville assessor, Public Idaho (Teton+). LLC/corp owners checked against Idaho
            SOSBiz for members/managers. Size verified with geodesic + STArea (m²).
          </p>
        </div>

        {/* Info panel */}
        <div className="xl:col-span-2 space-y-4">
          {!selected ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500 text-sm">
              <div className="text-3xl mb-2">🗺</div>
              <p className="font-medium text-slate-700">No parcel selected</p>
              <p className="mt-2">
                Click a lot on the map, search by PIN, or use “Sample: Rigby center” to pull boundary
                + county ownership when available.
              </p>
            </div>
          ) : (
            <>
              <div className="rounded-2xl border bg-white shadow-sm overflow-hidden">
                <div className="bg-emerald-700 text-white px-4 py-3">
                  <div className="text-xs uppercase tracking-wide text-emerald-100">Selected parcel</div>
                  <div className="font-semibold text-lg font-mono">{selected.pin || 'Unknown PIN'}</div>
                  <div className="text-sm text-emerald-100">
                    {selected.county || '—'} County, Idaho
                    {selected.ownership?.source ? ` · ${selected.ownership.source}` : ''}
                  </div>
                </div>
                <dl className="divide-y text-sm">
                  <Row
                    label="Owner of record"
                    value={
                      selected.owner || (
                        <span className="text-amber-700">
                          Not found on county assessor layer
                        </span>
                      )
                    }
                  />
                  {selected.owner2 && <Row label="Additional owner" value={selected.owner2} />}
                  <Row
                    label="Parcel address"
                    value={
                      selected.parcelAddress ||
                      selected.situsAddress ||
                      selected.ownership?.situsAddress || (
                        <span className="text-amber-700 font-normal">
                          Not on county layer
                        </span>
                      )
                    }
                  />
                  <Row
                    label="Mailing address"
                    value={
                      selected.mailingAddress ||
                      selected.ownership?.mailingAddress || (
                        <span className="text-amber-700 font-normal">
                          Not on county layer
                        </span>
                      )
                    }
                  />
                  {selected.sos?.matched && (
                    <>
                      <Row
                        label="SOS entity"
                        value={
                          <span className="text-right">
                            <span className="font-medium">
                              {selected.sos.entity?.title || selected.owner}
                            </span>
                            {selected.sos.status ? (
                              <span className="block text-[11px] text-slate-500 font-normal">
                                {selected.sos.entityType || 'Entity'} · {selected.sos.status}
                              </span>
                            ) : null}
                          </span>
                        }
                      />
                      {selected.sos.beneficialNames?.length > 0 && (
                        <Row
                          label="Owners / principals (SOS)"
                          value={
                            <ul className="text-right space-y-0.5">
                              {selected.sos.principals.map((p, i) => (
                                <li key={i}>
                                  <span className="font-semibold">{p.name}</span>
                                  <span className="text-[11px] text-slate-500 font-normal">
                                    {' '}
                                    · {p.role}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          }
                        />
                      )}
                      {selected.sos.registeredAgent && (
                        <Row label="Registered agent (SOS)" value={selected.sos.registeredAgent} />
                      )}
                      {selected.sos.sosUrl && (
                        <Row
                          label="Idaho SOS"
                          value={
                            <a
                              href={selected.sos.sosUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sky-700 hover:underline font-medium"
                            >
                              Open SOSBiz record →
                            </a>
                          }
                        />
                      )}
                    </>
                  )}
                  {selected.owner &&
                    /llc|inc|corp|llp|company|holdings|properties|trust/i.test(selected.owner) &&
                    !selected.sos?.matched && (
                      <Row
                        label="Idaho SOS"
                        value={
                          <span className="text-amber-700 text-xs font-normal">
                            Entity-style name — SOS match not found or lookup pending. Try{' '}
                            <a
                              href={`https://sosbiz.idaho.gov/search/business`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="underline"
                            >
                              SOSBiz search
                            </a>
                            .
                          </span>
                        }
                      />
                    )}
                  <Row
                    label="Land size (verified)"
                    value={
                      selected.acres != null ? (
                        <span>
                          <span className="font-semibold">{selected.acres.toLocaleString()} ac</span>
                          {selected.areaSqFt
                            ? ` · ${selected.areaSqFt.toLocaleString()} sq ft`
                            : ''}
                          {selected.size && (
                            <span
                              className={`ml-2 text-[10px] uppercase font-semibold px-1.5 py-0.5 rounded ${
                                selected.size.verified
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {selected.size.verified ? 'Verified' : 'Review'}
                            </span>
                          )}
                        </span>
                      ) : (
                        '—'
                      )
                    }
                  />
                  {selected.size && (
                    <Row
                      label="Size breakdown"
                      value={
                        <span className="text-xs text-slate-600 text-right leading-relaxed">
                          GIS geodesic: {selected.size.geodesicAcres} ac
                          {selected.size.legalAcres != null
                            ? ` · Legal (assessor): ${selected.size.legalAcres} ac`
                            : ''}
                          {selected.size.idwrStAreaAcres != null
                            ? ` · IDWR STArea: ${selected.size.idwrStAreaAcres} ac`
                            : ''}
                          {selected.size.variancePct != null
                            ? ` · Δ ${selected.size.variancePct > 0 ? '+' : ''}${selected.size.variancePct}%`
                            : ''}
                          <br />
                          <span className="text-slate-400">
                            Source: {selected.size.primarySource.replace(/_/g, ' ')}
                          </span>
                        </span>
                      }
                    />
                  )}
                  <Row
                    label="Perimeter"
                    value={
                      selected.perimeterFt != null
                        ? `${selected.perimeterFt.toLocaleString()} ft`
                        : '—'
                    }
                  />
                  <Row
                    label="Year built"
                    value={fmtMissing(selected.yearBuilt ?? selected.ownership?.yearBuilt)}
                  />
                  <Row label="Improvements" value={fmtMissing(selected.improvements)} />
                  <Row
                    label="Land value"
                    value={fmtMoney(selected.landValue ?? selected.ownership?.landValue)}
                  />
                  <Row
                    label="Improvement value"
                    value={fmtMoney(
                      selected.improvementValue ?? selected.ownership?.improvementValue
                    )}
                  />
                  <Row label="Total assessed" value={fmtMoney(selected.assessedValue)} />
                  <Row
                    label="Legal description"
                    value={fmtMissing(
                      selected.legalDescription || selected.ownership?.legalDescription
                    )}
                  />
                  <Row
                    label="Land use / category"
                    value={fmtMissing(selected.landUse || selected.ownership?.assessmentCategory)}
                  />
                  <Row
                    label="Zoning"
                    value={fmtMissing(selected.zoning || selected.ownership?.zoning)}
                  />
                  <Row
                    label="Centroid"
                    value={
                      selected.centroid
                        ? `${selected.centroid.lat.toFixed(6)}, ${selected.centroid.lng.toFixed(6)}`
                        : '—'
                    }
                  />
                  <Row label="GIS source" value={selected.source} />
                </dl>
                <div className="text-[11px] text-slate-500 px-4 py-3 bg-slate-50 border-t leading-relaxed space-y-1">
                  <p>{selected.notes}</p>
                  {selected.size?.notes?.map((n, i) => (
                    <p key={i} className="text-slate-400">
                      · {n}
                    </p>
                  ))}
                </div>
                <div className="p-3 border-t bg-sky-50/80 flex flex-col sm:flex-row gap-2">
                  <button
                    type="button"
                    onClick={sendToCma}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-sky-700 text-white text-sm font-semibold hover:bg-sky-600"
                  >
                    📊 Send to CMA
                  </button>
                  <p className="text-[11px] text-sky-900/80 sm:max-w-[14rem] leading-snug self-center">
                    Imports year built, assessed value, ownership, and the parcel map with aerial
                    photo into CMA.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border bg-white p-4 shadow-sm space-y-3">
                <h3 className="font-semibold text-slate-800">Platting & feasibility</h3>
                <p className="text-xs text-slate-500">
                  Uses the real parcel boundary ring for on-parcel lot layout. Optional asking price
                  for Offer/Pass scoring.
                </p>
                <label className="block text-xs text-slate-500">
                  Asking / list price $ (optional)
                  <input
                    type="number"
                    className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                    value={askPrice}
                    onChange={(e) => setAskPrice(e.target.value)}
                    placeholder="e.g. 650000"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setPlatOpen(true)}
                    className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500"
                  >
                    🗺 Plat this parcel
                  </button>
                  <button
                    type="button"
                    onClick={openPlatStudio}
                    className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50"
                  >
                    Open in AI Plat Studio →
                  </button>
                </div>

                {platOpen && listingForPlat && (
                  <div className="pt-2 border-t">
                    <DevelopmentPotential listing={listingForPlat} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 px-4 py-2.5">
      <dt className="text-slate-500 shrink-0">{label}</dt>
      <dd className="text-right font-medium text-slate-900 break-words">{value}</dd>
    </div>
  );
}

function fmtMissing(v: string | number | null | undefined) {
  if (v == null || v === '') {
    return <span className="text-slate-400 font-normal">Not in county / statewide layer</span>;
  }
  if (typeof v === 'number') {
    // Year built and similar non-currency integers
    if (v >= 1800 && v <= 2100) return String(v);
    return money(v);
  }
  return v;
}

function fmtMoney(v: number | null | undefined) {
  if (v == null) {
    return <span className="text-slate-400 font-normal">Not in county / statewide layer</span>;
  }
  return money(v);
}
