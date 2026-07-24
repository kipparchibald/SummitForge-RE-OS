import { NextRequest, NextResponse } from 'next/server';
import { matchParcel } from '@/lib/development/parcel';
import { designPlat, type LngLat } from '@/lib/development/plat-geometry';
import { bestDesignWithPattern } from '@/lib/development/comps-design';
import { inferCounty } from '@/lib/development/land-engine';
import {
  applyZoningToDesign,
  resolveZoning,
  rigbyAnnexDesignBase,
  type PlatScenario,
} from '@/lib/development/zoning';
import { infraCostBreakdown, RIGBY_CITY_PRESET, analyzeListing } from '@/lib/development/land-engine';
import { callLLM, SYSTEM_PROMPTS } from '@/lib/ai/client';

export const dynamic = 'force-dynamic';

function normalizeRing(raw: unknown): LngLat[] | undefined {
  if (!Array.isArray(raw) || raw.length < 3) return undefined;
  const out: LngLat[] = [];
  for (const pt of raw) {
    if (!Array.isArray(pt) || pt.length < 2) continue;
    const lng = Number(pt[0]);
    const lat = Number(pt[1]);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    out.push([lng, lat]);
  }
  return out.length >= 3 ? out : undefined;
}

/** Square concept ring centered at lat/lng for AI plat demos when GIS is unavailable. */
function conceptRing(acres: number, lat: number, lng: number): LngLat[] {
  const sideFt = Math.sqrt(Math.max(0.25, acres) * 43560);
  const dLat = sideFt / 2 / 364320;
  const dLng = sideFt / 2 / (364320 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
  return [
    [lng - dLng, lat - dLat],
    [lng + dLng, lat - dLat],
    [lng + dLng, lat + dLat],
    [lng - dLng, lat + dLat],
    [lng - dLng, lat - dLat],
  ];
}

/**
 * POST /api/development/plat
 * Body: { lat?, lng?, apn?, county?, ring?, acres?, concept?, withAi?, zoning?,
 *         scenario?: 'county' | 'rigby_r1_annexed' }
 * Intelligent plat: zoning-aware lot module, nearby subdivision pattern,
 * double-loaded roads, max lots / min road LF. Annexation scenario projects
 * City of Rigby R-1 density with water/sewer/curb & gutter.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    // Prefer explicit ring from GIS selection (curved / irregular tax lot)
    let boundary: LngLat[] | undefined = normalizeRing(body.ring);
    let cty: string | undefined = body.county;
    let cLat = body.lat != null ? Number(body.lat) : null;
    let cLng = body.lng != null ? Number(body.lng) : null;
    let geometrySource: 'gis' | 'provided-ring' | 'concept' = boundary ? 'provided-ring' : 'gis';
    let pin: string | null = body.apn || body.pin || null;
    let zoningCode: string | null = body.zoning || null;
    let parcelAcres: number | null = body.acres != null ? Number(body.acres) : null;

    // Never invent a concept square when caller sent a real ring or forbade concept
    const forceReal = !!boundary || body.concept === false || !!body.apn || !!body.pin;

    if (!boundary) {
      if (!body.concept) {
        try {
          const p = await matchParcel({ apn: body.apn || body.pin, lat: cLat, lng: cLng });
          if (p?.ring?.length) {
            boundary = p.ring as LngLat[];
            cty = cty || p.county || undefined;
            pin = p.pin || pin;
            geometrySource = 'gis';
            if (p.ownership?.zoning) zoningCode = zoningCode || p.ownership.zoning;
            if ((p as { zoning?: string | null }).zoning) {
              zoningCode = zoningCode || (p as { zoning?: string | null }).zoning || null;
            }
            if (p.acres != null) parcelAcres = p.acres;
            if (p.centroid) {
              cLat = p.centroid.lat;
              cLng = p.centroid.lng;
            }
          }
        } catch {
          /* fall through */
        }
      }

      if (!boundary) {
        if (forceReal && !body.concept) {
          return NextResponse.json(
            {
              error:
                'Could not load the selected parcel boundary. Re-select the lot on GIS and use Open in AI Plat Studio, or uncheck concept mode and provide a valid PIN.',
            },
            { status: 404 }
          );
        }
        const acres = Number(body.acres);
        if (!Number.isFinite(acres) || acres <= 0) {
          return NextResponse.json(
            {
              error:
                'No GIS parcel matched. Provide ring/APN/lat/lng for live GIS, or acres for a concept plat.',
            },
            { status: 404 }
          );
        }
        if (cLat == null || cLng == null) {
          cLat = 43.672;
          cLng = -111.915;
        }
        boundary = conceptRing(acres, cLat, cLng);
        geometrySource = 'concept';
      }
    } else {
      // Enrich zoning/owner for provided ring when possible (don't replace geometry)
      try {
        const p = await matchParcel({ apn: pin, lat: cLat, lng: cLng });
        if (p) {
          pin = p.pin || pin;
          cty = cty || p.county || undefined;
          if (p.ownership?.zoning) zoningCode = zoningCode || p.ownership.zoning;
          if ((p as { zoning?: string | null }).zoning) {
            zoningCode = zoningCode || (p as { zoning?: string | null }).zoning || null;
          }
          if (p.acres != null && parcelAcres == null) parcelAcres = p.acres;
        }
      } catch {
        /* keep provided ring */
      }
    }

    if (!boundary || boundary.length < 3) {
      return NextResponse.json({ error: 'Invalid parcel geometry.' }, { status: 422 });
    }
    if (cLat == null || cLng == null) {
      const n = boundary.length;
      cLng = boundary.reduce((s, q) => s + q[0], 0) / n;
      cLat = boundary.reduce((s, q) => s + q[1], 0) / n;
    }

    const countyKey = inferCounty(undefined, cty);
    const scenarioRaw = String(body.scenario || body.platScenario || 'county').toLowerCase();
    const scenario: PlatScenario =
      scenarioRaw === 'rigby_r1_annexed' ||
      scenarioRaw === 'rigby' ||
      scenarioRaw === 'annex_rigby' ||
      body.annexRigbyR1 === true
        ? 'rigby_r1_annexed'
        : 'county';

    const zoning = resolveZoning(countyKey, zoningCode, scenario);
    const annexed = scenario === 'rigby_r1_annexed';

    // County: learn from nearby comps. Annexed Rigby R-1: force city module (ignore rural comps).
    let pattern: Awaited<ReturnType<typeof bestDesignWithPattern>>['pattern'] = null;
    let rawDesign: Awaited<ReturnType<typeof bestDesignWithPattern>>['design'];
    if (annexed) {
      rawDesign = rigbyAnnexDesignBase() as any;
      // Still scan neighborhood for street axis preference only
      try {
        const scanned = await bestDesignWithPattern(cLat, cLng, countyKey);
        pattern = scanned.pattern;
        if (scanned.pattern?.preferredAxis && scanned.pattern.preferredAxis !== 'auto') {
          rawDesign = {
            ...rawDesign,
            preferredAxis: scanned.pattern.preferredAxis,
          };
        }
      } catch {
        /* optional */
      }
    } else {
      const scanned = await bestDesignWithPattern(cLat, cLng, countyKey);
      rawDesign = scanned.design;
      pattern = scanned.pattern;
    }

    const design = applyZoningToDesign(rawDesign, zoning, { forceModule: annexed });
    const plat = designPlat(boundary, countyKey, design);

    // Density cap from zoning (soft — trim note if exceeded)
    const densNotes: string[] = [];
    if (zoning.maxDensityPerAcre != null && plat.metrics.density > zoning.maxDensityPerAcre * 1.05) {
      densNotes.push(
        `Yield ${plat.metrics.density}/ac exceeds zone guide ${zoning.maxDensityPerAcre}/ac — confirm with planning or enlarge lots.`
      );
    }
    if (annexed) {
      densNotes.push(
        'Scenario: ANNEXED into City of Rigby under R-1 — city water/sewer + curb & gutter assumed; higher density than Jefferson County rural.'
      );
      densNotes.push(
        `City module ${design.lotWidthFt}′ × ${design.lotDepthFt}′ (min 8,000 sq ft) · pavement ${design.pavementFt}′ with curb/gutter · ROW ${design.rowFt}′.`
      );
    }

    // Infrastructure cost: city (curb/gutter/water/sewer) vs county rural
    const infra = infraCostBreakdown(
      plat.metrics.roadLF || 0,
      plat.metrics.lots || 0,
      annexed || !!zoning.urban
    );
    densNotes.push(
      `Infrastructure (${infra.profileLabel}): $${infra.total.toLocaleString()} total · $${infra.perLot.toLocaleString()}/lot · $${infra.perRoadLF.toLocaleString()}/LF road.`
    );

    // Optional feasibility re-run with plat yield + scenario infra
    let feasibility: ReturnType<typeof analyzeListing> = null;
    const asking = body.price != null ? Number(body.price) : 0;
    const acresForFeas =
      parcelAcres != null && parcelAcres > 0
        ? parcelAcres
        : plat.metrics.acres > 0
          ? plat.metrics.acres
          : Number(body.acres) || 0;
    if (acresForFeas > 0 && asking > 0) {
      feasibility = analyzeListing(
        { acres: acresForFeas, price: asking, address: body.address },
        {
          county: countyKey,
          scenario: annexed ? 'rigby_r1_annexed' : 'county',
          lots: plat.metrics.lots,
          roadLF: plat.metrics.roadLF,
          lotPrice: annexed ? RIGBY_CITY_PRESET.lotPrice : undefined,
        }
      );
    }

    let aiInsights: string | null = null;
    if (body.withAi) {
      aiInsights = await callLLM(
        SYSTEM_PROMPTS.valuation,
        `You are advising on a preliminary subdivision plat for Eastern Idaho.
County: ${countyKey}. Geometry: ${geometrySource}. PIN: ${pin || 'n/a'}.
Scenario: ${annexed ? 'ANNEXED to City of Rigby R-1 (city density, water/sewer, curb & gutter)' : 'County / current jurisdiction'}.
Zoning (GIS/digest): ${zoning.code} — ${zoning.label}. Min lot ${zoning.minLotAcres.toFixed(3)} ac (${Math.round(zoning.minLotAcres * 43560)} sq ft), min frontage ${zoning.minFrontageFt} ft, ROW ${zoning.rowFt} ft, pavement ${zoning.pavementFt} ft.
Metrics: ${JSON.stringify(plat.metrics)}.
Design: ${JSON.stringify(plat.design)}.
Infrastructure: ${JSON.stringify({
          profile: infra.profileLabel,
          total: infra.total,
          perLot: infra.perLot,
          perRoadLF: infra.perRoadLF,
          topLines: infra.lineItems
            .slice()
            .sort((a, b) => b.total - a.total)
            .slice(0, 6)
            .map((i) => `${i.label}: $${i.total}`),
        })}.
Layout notes: ${(plat.layoutNotes || []).join(' | ')}.
Nearby subdivision pattern: ${pattern ? JSON.stringify(pattern.notes) : 'none — county preset'}.
Address: ${body.address || 'n/a'}. Asking: ${body.price || 'n/a'}.
Give 5 short bullets: (1) yield vs zoning / annexation, (2) double-loaded road efficiency, (3) infrastructure cost drivers (${annexed ? 'city water/sewer/curb' : 'septic/well/rural road'}), (4) neighborhood fit, (5) next entitlement step.
Be specific to ${annexed ? 'City of Rigby R-1 annexation' : `${countyKey} County`}.`
      );
    }

    return NextResponse.json({
      ...plat,
      geometrySource,
      pin,
      county: countyKey,
      center: { lat: cLat, lng: cLng },
      parcelAcres,
      scenario,
      annexation: annexed
        ? {
            active: true,
            city: 'Rigby',
            zone: 'R-1',
            services: ['municipal water', 'municipal sewer', 'curb & gutter', 'city streets'],
            minLotSqFt: 8000,
            minFrontageFt: 80,
          }
        : { active: false },
      infra,
      feasibility,
      zoning: {
        code: zoning.code,
        label: zoning.label,
        minLotAcres: zoning.minLotAcres,
        minFrontageFt: zoning.minFrontageFt,
        minDepthFt: zoning.minDepthFt,
        rowFt: zoning.rowFt,
        pavementFt: zoning.pavementFt,
        maxDensityPerAcre: zoning.maxDensityPerAcre,
        source: zoning.source,
        jurisdiction: zoning.jurisdiction || countyKey,
        urban: !!zoning.urban,
        waterSewer: !!zoning.waterSewer,
        curbGutter: !!zoning.curbGutter,
        notes: [...zoning.notes, ...densNotes],
      },
      neighborhood: pattern
        ? {
            sampleSize: pattern.sampleSize,
            medianLotAcres: pattern.medianLotAcres,
            medianFrontageFt: pattern.medianFrontageFt,
            preferredAxis: pattern.preferredAxis,
            maxBlockFt: pattern.maxBlockFt,
            notes: annexed
              ? [
                  ...(pattern.notes || []),
                  'Lot size ignored rural comps — Rigby R-1 annexation module forced.',
                ]
              : pattern.notes,
          }
        : null,
      layoutNotes: [...(plat.layoutNotes || []), ...densNotes],
      aiInsights,
    });
  } catch (error: any) {
    console.error('[development/plat] error:', error);
    return NextResponse.json({ error: error?.message || 'plat generation failed' }, { status: 500 });
  }
}
