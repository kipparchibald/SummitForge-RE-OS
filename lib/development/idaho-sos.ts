/**
 * Idaho Secretary of State (SOSBiz) business entity lookup.
 * Resolves LLC / company owners of record → registered agent + governors/members
 * from the public sosbiz.idaho.gov API (no auth required for public view).
 */

export type SosPrincipal = {
  role: string;
  name: string;
  address?: string | null;
};

export type SosEntityMatch = {
  id: number;
  recordNum: string;
  title: string;
  entityType: string | null;
  status: string | null;
  standing: string | null;
  agentFromSearch: string | null;
  filingDate: string | null;
};

export type SosLookupResult = {
  query: string;
  matched: boolean;
  entity: SosEntityMatch | null;
  /** Registered agent (often a firm or individual) */
  registeredAgent: string | null;
  principalAddress: string | null;
  mailingAddress: string | null;
  status: string | null;
  entityType: string | null;
  /** Governors / members / managers / partners from SOS history + detail */
  principals: SosPrincipal[];
  /** Convenience: human names preferred over nested entities when available */
  beneficialNames: string[];
  sosUrl: string | null;
  notes: string[];
  source: string;
};

const SOS_SEARCH = 'https://sosbiz.idaho.gov/api/Records/businesssearch';
const SOS_DETAIL = 'https://sosbiz.idaho.gov/api/FilingDetail/business';
const SOS_HISTORY = 'https://sosbiz.idaho.gov/api/History/business';
const SOS_PUBLIC = 'https://sosbiz.idaho.gov/search/business';

const ENTITY_HINT =
  /\b(LLC|L\.L\.C\.|LLP|L\.L\.P\.|INC\.?|INCORPORATED|CORP\.?|CORPORATION|CO\.|COMPANY|LTD\.?|LIMITED|LP|L\.P\.|PLLC|P\.L\.L\.C\.|TRUST|PARTNERSHIP|ASSOCIATES|HOLDINGS|PROPERTIES|INVESTMENTS|ENTERPRISES)\b/i;

export function looksLikeEntity(owner: string | null | undefined): boolean {
  if (!owner || !owner.trim()) return false;
  return ENTITY_HINT.test(owner);
}

/** Normalize assessor owner string into a searchable business name. */
export function normalizeEntityQuery(owner: string): string {
  let q = owner.trim();
  // Drop trailing et al / & / trustee noise
  q = q.replace(/\s+et\s+al\.?$/i, '');
  q = q.replace(/\s+trustee(s)?$/i, '');
  q = q.replace(/\s+/g, ' ').trim();
  // Remove punctuation that confuses search
  q = q.replace(/[.,]/g, ' ').replace(/\s+/g, ' ').trim();
  return q;
}

async function sosFetch(url: string, init?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...init,
    cache: 'no-store',
    headers: {
      Accept: 'application/json',
      'User-Agent': 'SummitForge-RE-OS/1.0 (idaho-sos-public-lookup)',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`SOS ${res.status}`);
  return res.json();
}

export async function searchBusinessEntities(query: string): Promise<SosEntityMatch[]> {
  const q = normalizeEntityQuery(query);
  if (q.length < 2) return [];

  const data = await sosFetch(SOS_SEARCH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      SEARCH_VALUE: q,
      STARTS_WITH_YN: 'false',
      ACTIVE_ONLY_YN: true,
    }),
  });

  const rows = data?.rows || {};
  const out: SosEntityMatch[] = [];
  for (const key of Object.keys(rows)) {
    const r = rows[key];
    const titleArr = Array.isArray(r.TITLE) ? r.TITLE : [r.TITLE];
    const title = String(titleArr[0] || '').trim();
    const entityType = titleArr[1] != null ? String(titleArr[1]).trim() : null;
    const id = Number(r.ID ?? key);
    if (!Number.isFinite(id)) continue;
    out.push({
      id,
      recordNum: String(r.RECORD_NUM || '').trim(),
      title: title.replace(/\s*\(\d+\)\s*$/, '').trim() || title,
      entityType,
      status: r.STATUS != null ? String(r.STATUS) : null,
      standing: r.STANDING != null ? String(r.STANDING) : null,
      agentFromSearch: r.AGENT != null ? String(r.AGENT).trim() : null,
      filingDate: r.FILING_DATE != null ? String(r.FILING_DATE) : null,
    });
  }
  // Prefer exact-ish name match
  const qn = q.toLowerCase().replace(/[^a-z0-9]/g, '');
  out.sort((a, b) => {
    const an = a.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const bn = b.title.toLowerCase().replace(/[^a-z0-9]/g, '');
    const as = an === qn ? 0 : an.includes(qn) || qn.includes(an) ? 1 : 2;
    const bs = bn === qn ? 0 : bn.includes(qn) || qn.includes(bn) ? 1 : 2;
    return as - bs;
  });
  return out;
}

function parsePartyBlob(text: string): SosPrincipal | null {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  if (!lines.length) return null;
  const head = lines[0];
  const m = head.match(/^([^:]+):\s*(.+)$/);
  if (m) {
    return {
      role: m[1].trim(),
      name: m[2].trim().replace(/\s+/g, ' '),
      address: lines.slice(1).join(', ') || null,
    };
  }
  // skip empty / none
  if (/^none\b/i.test(head)) return null;
  return { role: 'Party', name: head.replace(/\s+/g, ' '), address: lines.slice(1).join(', ') || null };
}

function parseRegisteredAgent(value: string | null): string | null {
  if (!value) return null;
  const lines = value
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  // Typical: Noncommercial / id / NAME / address lines
  if (lines.length >= 3 && /commercial|noncommercial/i.test(lines[0])) {
    // skip type + id number lines
    let i = 1;
    if (/^\d+$/.test(lines[i])) i++;
    return lines.slice(i).join(', ');
  }
  return lines.join(', ');
}

/** Reconstruct current parties from PARTY_ADDED / PARTY_REMOVED history. */
export async function principalsFromHistory(recordNum: string): Promise<SosPrincipal[]> {
  const padded = recordNum.padStart(10, '0');
  let data: any;
  try {
    data = await sosFetch(`${SOS_HISTORY}/${padded}`);
  } catch {
    try {
      data = await sosFetch(`${SOS_HISTORY}/${recordNum}`);
    } catch {
      return [];
    }
  }
  const hist = [...(data?.HISTORY_LIST || [])].sort(
    (a: any, b: any) => Number(a.AMENDMENT_ID || 0) - Number(b.AMENDMENT_ID || 0)
  );
  // key by role+name for remove matching
  const current = new Map<string, SosPrincipal>();
  for (const h of hist) {
    const field = String(h.FIELD_NAME || '');
    if (field === 'PARTY_ADDED') {
      const p = parsePartyBlob(String(h.CHANGED_TO || ''));
      if (p?.name) current.set(`${p.role}|${p.name}`.toLowerCase(), p);
    } else if (field === 'PARTY_REMOVED') {
      const p = parsePartyBlob(String(h.CHANGED_FROM || ''));
      if (p?.name) current.delete(`${p.role}|${p.name}`.toLowerCase());
    }
  }
  return [...current.values()];
}

export async function fetchEntityDetail(id: number): Promise<{
  registeredAgent: string | null;
  principalAddress: string | null;
  mailingAddress: string | null;
  status: string | null;
  entityType: string | null;
  drawerPrincipals: SosPrincipal[];
}> {
  const data = await sosFetch(`${SOS_DETAIL}/${id}/true`);
  const list = data?.DRAWER_DETAIL_LIST || [];
  const get = (label: string) => {
    const row = list.find((x: any) => String(x.LABEL || '').toLowerCase() === label.toLowerCase());
    return row?.VALUE != null ? String(row.VALUE).trim() : null;
  };

  const drawerPrincipals: SosPrincipal[] = [];
  for (const row of list) {
    const lab = String(row.LABEL || '');
    if (/governor|member|manager|officer|partner|director/i.test(lab) && row.VALUE) {
      const p = parsePartyBlob(String(row.VALUE));
      if (p) drawerPrincipals.push({ ...p, role: lab });
      else drawerPrincipals.push({ role: lab, name: String(row.VALUE).split('\n')[0].trim() });
    }
  }

  return {
    registeredAgent: parseRegisteredAgent(get('Registered Agent')),
    principalAddress: get('Principal Address')?.replace(/\n/g, ', ') || null,
    mailingAddress: get('Mailing Address')?.replace(/\n/g, ', ') || null,
    status: get('Status'),
    entityType: get('Filing Type'),
    drawerPrincipals,
  };
}

function beneficialFromPrincipals(principals: SosPrincipal[]): string[] {
  const names: string[] = [];
  for (const p of principals) {
    if (!p.name) continue;
    // Prefer human-looking names over nested entities for "owner name"
    if (looksLikeEntity(p.name) && !/individual|person/i.test(p.role)) {
      // still include entity managers
      names.push(`${p.name} (${p.role})`);
    } else {
      names.push(p.name);
    }
  }
  // de-dupe
  return [...new Set(names.map((n) => n.replace(/\s+/g, ' ').trim()))];
}

/**
 * Full SOS lookup for an assessor owner-of-record string (LLC/corp).
 */
export async function lookupIdahoSosEntity(ownerName: string): Promise<SosLookupResult> {
  const query = normalizeEntityQuery(ownerName);
  const empty: SosLookupResult = {
    query,
    matched: false,
    entity: null,
    registeredAgent: null,
    principalAddress: null,
    mailingAddress: null,
    status: null,
    entityType: null,
    principals: [],
    beneficialNames: [],
    sosUrl: `${SOS_PUBLIC}?q=${encodeURIComponent(query)}`,
    notes: [],
    source: 'Idaho SOSBiz (sosbiz.idaho.gov)',
  };

  if (query.length < 2) {
    empty.notes.push('Owner name too short for SOS search.');
    return empty;
  }

  try {
    const matches = await searchBusinessEntities(query);
    if (!matches.length) {
      empty.notes.push('No active Idaho SOS business matched this owner name.');
      return empty;
    }

    const entity = matches[0];
    const detail = await fetchEntityDetail(entity.id);
    let principals = [...detail.drawerPrincipals];
    if (entity.recordNum) {
      const fromHist = await principalsFromHistory(entity.recordNum);
      // Prefer history (current members) when present
      if (fromHist.length) principals = fromHist;
    }

    // If still empty, use registered agent as a lead
    if (!principals.length && detail.registeredAgent) {
      principals = [{ role: 'Registered Agent', name: detail.registeredAgent.split(',')[0].trim() }];
    }
    if (!principals.length && entity.agentFromSearch) {
      principals = [{ role: 'Registered Agent (search)', name: entity.agentFromSearch }];
    }

    const beneficialNames = beneficialFromPrincipals(principals);
    const notes: string[] = [
      `Matched Idaho SOS: ${entity.title}${entity.status ? ` · ${entity.status}` : ''}.`,
    ];
    if (beneficialNames.length) {
      notes.push(`Principals / members from SOS filings: ${beneficialNames.join('; ')}.`);
    } else {
      notes.push(
        'SOS listing found but no member/manager names in public drawer — open SOS link for annual report images.'
      );
    }

    return {
      query,
      matched: true,
      entity,
      registeredAgent: detail.registeredAgent || entity.agentFromSearch,
      principalAddress: detail.principalAddress,
      mailingAddress: detail.mailingAddress,
      status: detail.status || entity.status,
      entityType: detail.entityType || entity.entityType,
      principals,
      beneficialNames,
      sosUrl: `https://sosbiz.idaho.gov/records/business/${entity.id}`,
      notes,
      source: 'Idaho SOSBiz (sosbiz.idaho.gov)',
    };
  } catch (e) {
    empty.notes.push(
      `SOS lookup failed: ${e instanceof Error ? e.message : 'network error'}. Use the SOS search link.`
    );
    return empty;
  }
}
