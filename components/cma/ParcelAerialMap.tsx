'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Map, { Layer, Marker, NavigationControl, Source } from 'react-map-gl';
import type { MapRef } from 'react-map-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import {
  MAPBOX_STYLES,
  boundsFromRing,
  ringToFeature,
  type GisCmaHandoff,
  type GisMapBasemap,
} from '@/lib/cma/from-gis';

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

type Props = {
  handoff: GisCmaHandoff;
  className?: string;
  /** Default height of the map panel */
  heightClass?: string;
};

/**
 * Parcel boundary over Mapbox aerial (satellite) basemap — used on CMA after GIS Send.
 */
export default function ParcelAerialMap({
  handoff,
  className = '',
  heightClass = 'h-[320px] sm:h-[380px]',
}: Props) {
  const mapRef = useRef<MapRef>(null);
  const [basemap, setBasemap] = useState<GisMapBasemap>(handoff.mapBasemap || 'aerial');

  const feature = useMemo((): GeoJSON.Feature | null => {
    if (handoff.geojson?.geometry) return handoff.geojson as GeoJSON.Feature;
    return ringToFeature(handoff.ring, {
      pin: handoff.pin,
      acres: handoff.acres,
      yearBuilt: handoff.yearBuilt,
      assessedValue: handoff.assessedValue,
    });
  }, [handoff]);

  const fc = useMemo((): GeoJSON.FeatureCollection | null => {
    if (!feature) return null;
    return { type: 'FeatureCollection', features: [feature] };
  }, [feature]);

  const ring = useMemo((): [number, number][] => {
    if (handoff.ring && handoff.ring.length >= 3) return handoff.ring;
    const g = feature?.geometry;
    if (g?.type === 'Polygon' && g.coordinates?.[0]) {
      return g.coordinates[0] as [number, number][];
    }
    if (g?.type === 'MultiPolygon' && g.coordinates?.[0]?.[0]) {
      return g.coordinates[0][0] as [number, number][];
    }
    return [];
  }, [handoff.ring, feature]);

  const center = useMemo(() => {
    if (handoff.lng != null && handoff.lat != null) {
      return { longitude: handoff.lng, latitude: handoff.lat };
    }
    if (ring.length) {
      const s = ring.reduce(
        (acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }),
        { lng: 0, lat: 0 }
      );
      return { longitude: s.lng / ring.length, latitude: s.lat / ring.length };
    }
    return { longitude: -111.9, latitude: 43.6 };
  }, [handoff.lat, handoff.lng, ring]);

  const fitParcel = useCallback(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;
    const b = boundsFromRing(ring);
    if (b) {
      map.fitBounds(b, { padding: 48, duration: 600, maxZoom: 19 });
    } else if (handoff.lat != null && handoff.lng != null) {
      map.flyTo({ center: [handoff.lng, handoff.lat], zoom: 17, duration: 500 });
    }
  }, [ring, handoff.lat, handoff.lng]);

  useEffect(() => {
    // Fit after style/load when basemap or parcel changes
    const t = window.setTimeout(fitParcel, 280);
    return () => window.clearTimeout(t);
  }, [fitParcel, basemap, handoff.pin]);

  if (!MAPBOX_TOKEN) {
    return (
      <div
        className={`${heightClass} rounded-xl border border-dashed border-slate-300 bg-slate-50 flex flex-col items-center justify-center p-6 text-center ${className}`}
      >
        <p className="text-sm font-medium text-slate-700">Parcel map needs Mapbox token</p>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Set <code className="bg-slate-200 px-1 rounded">NEXT_PUBLIC_MAPBOX_TOKEN</code> to show
          aerial photo + boundary. Assessor fields still apply without the map.
        </p>
        {handoff.pin && (
          <p className="text-xs font-mono text-slate-600 mt-3">PIN {handoff.pin}</p>
        )}
      </div>
    );
  }

  if (!fc && handoff.lat == null) {
    return (
      <div
        className={`${heightClass} rounded-xl border bg-slate-100 flex items-center justify-center text-sm text-slate-500 ${className}`}
      >
        No parcel geometry in this GIS handoff.
      </div>
    );
  }

  return (
    <div className={`relative rounded-xl overflow-hidden border border-sky-200 shadow-sm ${className}`}>
      <div className="absolute top-2 left-2 z-10 flex flex-wrap gap-1">
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
            onClick={() => setBasemap(id)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold shadow-sm border backdrop-blur-sm transition ${
              basemap === id
                ? 'bg-sky-700 text-white border-sky-800'
                : 'bg-white/90 text-slate-700 border-slate-200 hover:bg-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="absolute top-2 right-2 z-10">
        <button
          type="button"
          onClick={fitParcel}
          className="px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-white/90 border border-slate-200 text-slate-700 shadow-sm hover:bg-white"
        >
          Fit parcel
        </button>
      </div>
      <div className={heightClass}>
        <Map
          ref={mapRef}
          initialViewState={{
            ...center,
            zoom: 17,
          }}
          style={{ width: '100%', height: '100%' }}
          mapStyle={MAPBOX_STYLES[basemap]}
          mapboxAccessToken={MAPBOX_TOKEN}
          attributionControl
          onLoad={fitParcel}
          reuseMaps
        >
          <NavigationControl position="bottom-right" showCompass={false} />
          {fc && (
            <Source id="cma-parcel" type="geojson" data={fc}>
              <Layer
                id="cma-parcel-fill"
                type="fill"
                paint={{
                  'fill-color': '#38bdf8',
                  'fill-opacity': basemap === 'streets' ? 0.28 : 0.32,
                }}
              />
              <Layer
                id="cma-parcel-line"
                type="line"
                paint={{
                  'line-color': '#f8fafc',
                  'line-width': 3,
                  'line-opacity': 0.95,
                }}
              />
              <Layer
                id="cma-parcel-outline"
                type="line"
                paint={{
                  'line-color': '#0369a1',
                  'line-width': 1.5,
                  'line-opacity': 0.9,
                }}
              />
            </Source>
          )}
          {handoff.lng != null && handoff.lat != null && (
            <Marker longitude={handoff.lng} latitude={handoff.lat} anchor="center">
              <div className="w-2.5 h-2.5 rounded-full bg-sky-400 border-2 border-white shadow" />
            </Marker>
          )}
        </Map>
      </div>
      <div className="absolute bottom-2 left-2 z-10 max-w-[85%] pointer-events-none">
        <div className="px-2 py-1 rounded-lg bg-black/55 text-white text-[10px] sm:text-xs backdrop-blur-sm">
          {handoff.pin && <span className="font-mono font-semibold">{handoff.pin}</span>}
          {handoff.acres != null && <span> · {handoff.acres} ac</span>}
          {handoff.yearBuilt != null && <span> · built {handoff.yearBuilt}</span>}
          {basemap === 'aerial' && <span className="opacity-80"> · aerial</span>}
        </div>
      </div>
    </div>
  );
}
