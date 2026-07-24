/**
 * Eastern Idaho zoning rules for preliminary plat sizing.
 * Planning-grade digests of common county/city residential & ag districts —
 * not a substitute for the official ordinance or a surveyor.
 */

export type ZoningRules = {
  code: string;
  county: string;
  label: string;
  minLotAcres: number;
  minFrontageFt: number;
  minDepthFt: number;
  rowFt: number;
  pavementFt: number;
  /** Soft max lots/acre when ordinance states density */
  maxDensityPerAcre: number | null;
  exteriorSetbackFt: number;
  source: string;
  notes: string[];
  /** City services scenario (annexation projection) */
  urban?: boolean;
  waterSewer?: boolean;
  curbGutter?: boolean;
  jurisdiction?: string;
};

/** Plat density scenario toggles (UI / API). */
export type PlatScenario = 'county' | 'rigby_r1_annexed';

/**
 * City of Rigby R-1 after annexation — higher density with full city utilities.
 * Source: Rigby City Code 10-4-5 (min 8,000 sq ft, min width 80', min depth 60').
 * Practical module: 80′ × 100′ = 8,000 sq ft with city street section (curb & gutter).
 */
export const RIGBY_CITY_R1: ZoningRules = {
  code: 'R-1',
  county: 'Jefferson',
  jurisdiction: 'City of Rigby',
  label: 'City of Rigby R-1 (annexed · city density)',
  minLotAcres: 8000 / 43560, // ≈ 0.1837 ac
  minFrontageFt: 80,
  minDepthFt: 100, // ordinance min depth 60'; area forces ~100' at 80' frontage
  rowFt: 60,
  pavementFt: 36, // city local street with curb/gutter face-to-face wider than rural
  maxDensityPerAcre: 4.5, // theoretical ≈ 5.4 gross; use 4.5 after ROW
  exteriorSetbackFt: 20,
  urban: true,
  waterSewer: true,
  curbGutter: true,
  source: 'City of Rigby Code 10-4-5 R-1 (planning digest)',
  notes: [
    'Annexation projection: City of Rigby R-1 single-family.',
    'Min lot 8,000 sq ft · min width 80′ · min depth 60′ (module 80′×100′).',
    'Assumes municipal water, sewer, curb & gutter, and city street standards.',
    'Annexation + zone map amendment required — confirm with Rigby Planning & Public Works.',
    'Not a substitute for the official ordinance or a surveyor.',
  ],
};

type ZoneDef = Omit<ZoningRules, 'county' | 'code'> & { match: RegExp };

/** Per-county zone tables (matched by GIS zoning string). */
const BY_COUNTY: Record<string, ZoneDef[]> = {
  Madison: [
    {
      match: /^(R-?1|RES|RESIDENTIAL|LDR)/i,
      label: 'Madison residential (R-1 class)',
      minLotAcres: 0.2,
      minFrontageFt: 70,
      minDepthFt: 90,
      rowFt: 60,
      pavementFt: 32,
      maxDensityPerAcre: 4,
      exteriorSetbackFt: 25,
      source: 'Madison County / Rexburg planning norms (digest)',
      notes: ['Typical urban/suburban single-family; verify city vs county jurisdiction.'],
    },
    {
      match: /^(R-?2|MDR|MULTI)/i,
      label: 'Madison medium density',
      minLotAcres: 0.12,
      minFrontageFt: 50,
      minDepthFt: 80,
      rowFt: 60,
      pavementFt: 32,
      maxDensityPerAcre: 8,
      exteriorSetbackFt: 20,
      source: 'Madison County / Rexburg planning norms (digest)',
      notes: ['Higher density — confirm utilities and PUD path.'],
    },
    {
      match: /^(CC|C-?1|C-?2|COMM|GC)/i,
      label: 'Madison commercial',
      minLotAcres: 0.15,
      minFrontageFt: 60,
      minDepthFt: 80,
      rowFt: 66,
      pavementFt: 36,
      maxDensityPerAcre: null,
      exteriorSetbackFt: 15,
      source: 'Madison commercial (digest)',
      notes: ['Commercial — residential subdivision may need rezone.'],
    },
    {
      match: /^(AG|A-?1|A-?2|TAG|AGR)/i,
      label: 'Madison agricultural',
      minLotAcres: 1.0,
      minFrontageFt: 150,
      minDepthFt: 150,
      rowFt: 60,
      pavementFt: 30,
      maxDensityPerAcre: 1,
      exteriorSetbackFt: 40,
      source: 'Madison AG (digest)',
      notes: ['Ag district — cluster / rezone often required for urban lot sizes.'],
    },
  ],
  Bonneville: [
    {
      match: /^(R-?1|RES|SFR|DWELL)/i,
      label: 'Bonneville R-1 residential',
      minLotAcres: 0.25,
      minFrontageFt: 75,
      minDepthFt: 100,
      rowFt: 60,
      pavementFt: 32,
      maxDensityPerAcre: 4,
      exteriorSetbackFt: 25,
      source: 'Bonneville County residential (digest)',
      notes: ['Idaho Falls city lots may be smaller — check city limits.'],
    },
    {
      match: /^(A-?1|AG|AGR)/i,
      label: 'Bonneville agricultural',
      minLotAcres: 1.0,
      minFrontageFt: 150,
      minDepthFt: 150,
      rowFt: 60,
      pavementFt: 30,
      maxDensityPerAcre: 1,
      exteriorSetbackFt: 40,
      source: 'Bonneville AG (digest)',
      notes: ['Rural density — confirm septic/well constraints.'],
    },
  ],
  Jefferson: [
    {
      match: /^(R-?1|RES)/i,
      label: 'Jefferson R-1 residential',
      minLotAcres: 1.0,
      minFrontageFt: 150,
      minDepthFt: 150,
      rowFt: 60,
      pavementFt: 30,
      maxDensityPerAcre: 1,
      exteriorSetbackFt: 40,
      source: 'Jefferson County R-1 (digest; 60′ ROW / 30′ pavement common)',
      notes: ['Rural residential character; 1 ac lots typical outside city.'],
    },
    {
      match: /^(A-?1|AG)/i,
      label: 'Jefferson agricultural',
      minLotAcres: 5.0,
      minFrontageFt: 200,
      minDepthFt: 200,
      rowFt: 60,
      pavementFt: 28,
      maxDensityPerAcre: 0.2,
      exteriorSetbackFt: 50,
      source: 'Jefferson AG (digest)',
      notes: ['Large-lot ag — subdivision may require zone change.'],
    },
  ],
  Bingham: [
    {
      match: /^(R|RES)/i,
      label: 'Bingham residential',
      minLotAcres: 1.0,
      minFrontageFt: 150,
      minDepthFt: 150,
      rowFt: 60,
      pavementFt: 30,
      maxDensityPerAcre: 1,
      exteriorSetbackFt: 40,
      source: 'Bingham residential (digest)',
      notes: [],
    },
  ],
  Teton: [
    {
      match: /^(R|RES)/i,
      label: 'Teton residential',
      minLotAcres: 1.0,
      minFrontageFt: 150,
      minDepthFt: 150,
      rowFt: 60,
      pavementFt: 28,
      maxDensityPerAcre: 1,
      exteriorSetbackFt: 40,
      source: 'Teton County residential (digest)',
      notes: ['Resort market — check scenic corridors and hillside overlays.'],
    },
  ],
  Fremont: [
    {
      match: /^(R|RES)/i,
      label: 'Fremont residential',
      minLotAcres: 1.0,
      minFrontageFt: 150,
      minDepthFt: 150,
      rowFt: 60,
      pavementFt: 30,
      maxDensityPerAcre: 1,
      exteriorSetbackFt: 40,
      source: 'Fremont residential (digest)',
      notes: [],
    },
  ],
  Bannock: [
    {
      match: /^(R-?1|RES)/i,
      label: 'Bannock / Pocatello R-1',
      minLotAcres: 0.2,
      minFrontageFt: 70,
      minDepthFt: 90,
      rowFt: 60,
      pavementFt: 32,
      maxDensityPerAcre: 5,
      exteriorSetbackFt: 25,
      source: 'Bannock residential (digest)',
      notes: [],
    },
  ],
};

/** County default when zoning string missing — aligns with land-engine presets. */
const COUNTY_DEFAULT: Record<string, ZoneDef> = {
  Madison: {
    match: /.*/,
    label: 'Madison default R-1 class',
    minLotAcres: 0.33,
    minFrontageFt: 100,
    minDepthFt: 100,
    rowFt: 60,
    pavementFt: 32,
    maxDensityPerAcre: 3,
    exteriorSetbackFt: 30,
    source: 'County default (no GIS zone string)',
    notes: ['No assigned zoning on parcel layer — used county R-1 class defaults.'],
  },
  Bonneville: {
    match: /.*/,
    label: 'Bonneville default R-1 class',
    minLotAcres: 0.33,
    minFrontageFt: 100,
    minDepthFt: 100,
    rowFt: 60,
    pavementFt: 32,
    maxDensityPerAcre: 3,
    exteriorSetbackFt: 30,
    source: 'County default (no GIS zone string)',
    notes: ['No assigned zoning on parcel layer — used county R-1 class defaults.'],
  },
  Jefferson: {
    match: /.*/,
    label: 'Jefferson default rural residential',
    minLotAcres: 1.0,
    minFrontageFt: 150,
    minDepthFt: 150,
    rowFt: 60,
    pavementFt: 30,
    maxDensityPerAcre: 1,
    exteriorSetbackFt: 40,
    source: 'County default (no GIS zone string)',
    notes: ['No assigned zoning — Jefferson rural 1 ac class used.'],
  },
  Default: {
    match: /.*/,
    label: 'Generic Eastern Idaho R-1',
    minLotAcres: 1.0,
    minFrontageFt: 150,
    minDepthFt: 150,
    rowFt: 60,
    pavementFt: 30,
    maxDensityPerAcre: 1,
    exteriorSetbackFt: 40,
    source: 'Generic default',
    notes: ['Verify county zoning ordinance before filing.'],
  },
};

function toRules(county: string, code: string, def: ZoneDef): ZoningRules {
  return {
    code: code || 'DEFAULT',
    county,
    label: def.label,
    minLotAcres: def.minLotAcres,
    minFrontageFt: def.minFrontageFt,
    minDepthFt: def.minDepthFt,
    rowFt: def.rowFt,
    pavementFt: def.pavementFt,
    maxDensityPerAcre: def.maxDensityPerAcre,
    exteriorSetbackFt: def.exteriorSetbackFt,
    source: def.source,
    notes: def.notes,
  };
}

/**
 * Resolve zoning rules from GIS zone string + county.
 * Optional plat scenario overrides (e.g. annex into City of Rigby R-1).
 */
export function resolveZoning(
  county: string,
  zoningCode?: string | null,
  scenario?: PlatScenario | string | null
): ZoningRules {
  if (scenario === 'rigby_r1_annexed' || scenario === 'rigby' || scenario === 'annex_rigby') {
    return { ...RIGBY_CITY_R1 };
  }

  const cty = Object.keys(BY_COUNTY).find((k) => county.toLowerCase().startsWith(k.toLowerCase())) || 'Default';
  const raw = (zoningCode || '').trim();
  const table = BY_COUNTY[cty] || [];

  if (raw) {
    for (const def of table) {
      if (def.match.test(raw)) return toRules(cty, raw, def);
    }
    // Partial contains (e.g. "City R-1")
    for (const def of table) {
      if (def.match.test(raw.replace(/[^A-Za-z0-9-]/g, ''))) return toRules(cty, raw, def);
    }
  }

  const fallback =
    COUNTY_DEFAULT[cty] ||
    COUNTY_DEFAULT.Default;
  return toRules(cty, raw || 'DEFAULT', fallback);
}

/** Fixed city-density design module for Rigby R-1 annexation (ignore rural comps). */
export function rigbyAnnexDesignBase(): {
  lotWidthFt: number;
  lotDepthFt: number;
  rowFt: number;
  pavementFt: number;
  nsStreets: number;
  perimFt: number;
  source: string;
  medianLotAcres: number;
  maxBlockFt: number;
  preferredAxis: 'auto';
  layoutStyle: 'hunter_chase';
  culDeSacRadiusFt: number;
} {
  const z = RIGBY_CITY_R1;
  return {
    lotWidthFt: z.minFrontageFt,
    lotDepthFt: z.minDepthFt,
    rowFt: z.rowFt,
    pavementFt: z.pavementFt,
    nsStreets: 0,
    perimFt: 18,
    source: 'city-annexation-rigby-r1',
    medianLotAcres: z.minLotAcres,
    maxBlockFt: 500, // shorter city blocks with curb/gutter
    preferredAxis: 'auto',
    layoutStyle: 'hunter_chase',
    culDeSacRadiusFt: 45,
  };
}

/**
 * Apply zoning minimums to design lot dimensions (never undersize the ordinance).
 */
export function applyZoningToDesign<
  T extends {
    lotWidthFt: number;
    lotDepthFt: number;
    rowFt: number;
    pavementFt?: number;
    perimFt: number;
    medianLotAcres?: number;
    source?: string;
    maxBlockFt?: number;
  },
>(
  design: T,
  zoning: ZoningRules,
  opts?: { forceModule?: boolean }
): T & {
  zoningCode: string;
  zoningLabel: string;
  urban?: boolean;
  waterSewer?: boolean;
  curbGutter?: boolean;
} {
  // Annexation / force: use ordinance module exactly (not rural comps)
  if (opts?.forceModule || zoning.jurisdiction === 'City of Rigby') {
    const w = zoning.minFrontageFt;
    const minSqFt = zoning.minLotAcres * 43560;
    const d = Math.max(zoning.minDepthFt, Math.ceil(minSqFt / w));
    return {
      ...design,
      lotWidthFt: Math.round(w),
      lotDepthFt: Math.round(d),
      rowFt: zoning.rowFt,
      pavementFt: zoning.pavementFt,
      perimFt: Math.min(design.perimFt, zoning.exteriorSetbackFt),
      medianLotAcres: zoning.minLotAcres,
      maxBlockFt: Math.min(design.maxBlockFt || 660, 520),
      source: design.source?.includes('annex')
        ? design.source
        : zoning.jurisdiction
          ? `city-annexation-${zoning.code.toLowerCase()}`
          : design.source,
      zoningCode: zoning.code,
      zoningLabel: zoning.label,
      urban: zoning.urban,
      waterSewer: zoning.waterSewer,
      curbGutter: zoning.curbGutter,
    };
  }

  let w = Math.max(design.lotWidthFt, zoning.minFrontageFt);
  let d = Math.max(design.lotDepthFt, zoning.minDepthFt);
  const minSqFt = zoning.minLotAcres * 43560;
  if (w * d < minSqFt) {
    d = Math.ceil(minSqFt / w);
  }
  // Prefer lot area near zoning min when comps suggested smaller (illegal)
  const median = design.medianLotAcres;
  if (median != null && median < zoning.minLotAcres) {
    d = Math.max(d, Math.ceil(minSqFt / w));
  }
  return {
    ...design,
    lotWidthFt: Math.round(w),
    lotDepthFt: Math.round(d),
    rowFt: Math.max(design.rowFt, zoning.rowFt),
    pavementFt: Math.max(design.pavementFt || 0, zoning.pavementFt) || zoning.pavementFt,
    perimFt: Math.max(design.perimFt, Math.min(40, zoning.exteriorSetbackFt)),
    medianLotAcres: Math.max(median || 0, zoning.minLotAcres) || zoning.minLotAcres,
    zoningCode: zoning.code,
    zoningLabel: zoning.label,
    urban: zoning.urban,
    waterSewer: zoning.waterSewer,
    curbGutter: zoning.curbGutter,
  };
}
