'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { isDemoMode } from '@/lib/env';
import {
  applyBrandToDocument,
  colorInputValue,
  loadPersistedBranding,
  persistBranding,
  type BrandPayload,
} from '@/lib/branding/apply';
import { normalizeHex } from '@/lib/branding/extract';

const DEFAULTS: BrandPayload = {
  logo: '',
  primaryColor: '#1e40af',
  secondaryColor: '#3b82f6',
  accentColor: '#0ea5e9',
  companyName: 'Archibald-Bagley Real Estate',
  customDomain: 'archibaldbagley.com',
  tagline: 'Your Eastern Idaho Realtors',
  phone: '(208) 745-5911',
  facebook: 'https://www.facebook.com/archibaldbagleyrealestate',
  aboutBlurb:
    'Archibald-Bagley Real Estate has built a reputation for integrity, professionalism, and a deep understanding of the local market. With over two decades of experience, we specialize in connecting individuals and families with their ideal properties across Rigby, Idaho Falls, and the surrounding regions.',
};

export default function BrandingSettings() {
  const [importStatus, setImportStatus] = useState('');
  const [importing, setImporting] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [branding, setBranding] = useState<BrandPayload>(DEFAULTS);
  const [previewName, setPreviewName] = useState(DEFAULTS.companyName || '');
  const [domainInput, setDomainInput] = useState(DEFAULTS.customDomain || 'archibaldbagley.com');
  const isDemo = isDemoMode();

  const applyTheme = useCallback((b: BrandPayload) => {
    applyBrandToDocument(b);
    setPreviewName(b.companyName || 'Your Brand');
  }, []);

  useEffect(() => {
    const saved = loadPersistedBranding();
    if (saved) {
      const merged = { ...DEFAULTS, ...saved };
      setBranding(merged);
      setDomainInput(merged.customDomain || 'archibaldbagley.com');
      applyTheme(merged);
    }
    // Do not auto-import on every visit — that overwrote intentional edits.
    // User clicks Import explicitly.
  }, [applyTheme]);

  const updateBranding = (updates: Partial<BrandPayload>) => {
    setBranding((prev) => {
      const next = { ...prev, ...updates };
      applyTheme(next);
      return next;
    });
  };

  const handleSave = () => {
    persistBranding(branding);
    applyTheme(branding);
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2500);
  };

  const resetTheme = () => {
    try {
      localStorage.removeItem('summitforge_branding');
    } catch {
      /* ignore */
    }
    setBranding(DEFAULTS);
    setDomainInput(DEFAULTS.customDomain || '');
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--secondary');
    document.documentElement.style.removeProperty('--accent');
    setPreviewName(DEFAULTS.companyName || '');
    setImportStatus('Reset to defaults. Save if you want this to stick.');
  };

  const simulateLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        updateBranding({ logo: reader.result });
      }
    };
    reader.readAsDataURL(file);
  };

  /**
   * Import branding from the brokerage's public site.
   * Uses domainInput (not only branding state) so edits apply immediately.
   * On success: merges found fields, applies theme, auto-persists.
   */
  const importFromSite = async () => {
    const site = (domainInput || branding.customDomain || 'archibaldbagley.com').trim();
    if (!site) {
      setImportStatus('Enter a domain (e.g. archibaldbagley.com) first.');
      return;
    }
    const url = /^https?:\/\//i.test(site) ? site : `https://${site}`;

    setImporting(true);
    setImportStatus(`Reading ${site}…`);

    try {
      const res = await fetch('/api/branding/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success || !data.branding) {
        setImportStatus(
          `Could not import from ${site}: ${data.error || data.hint || `HTTP ${res.status}`}. Enter branding manually below.`
        );
        return;
      }

      const incoming = data.branding as Record<string, string>;
      const found: string[] = data.found || [];

      setBranding((prev) => {
        const next: BrandPayload = { ...prev };

        for (const key of found) {
          if (key === 'colors') {
            const p = normalizeHex(incoming.primaryColor);
            const s = normalizeHex(incoming.secondaryColor);
            const a = normalizeHex(incoming.accentColor);
            if (p) next.primaryColor = p;
            if (s) next.secondaryColor = s;
            if (a) next.accentColor = a;
          } else if (key === 'logo' && incoming.logo) {
            next.logo = incoming.logo;
          } else if (key === 'companyName' && incoming.companyName) {
            next.companyName = incoming.companyName;
          } else if (key === 'tagline' && incoming.tagline) {
            next.tagline = incoming.tagline;
          } else if (key === 'phone' && incoming.phone) {
            next.phone = incoming.phone;
          } else if (key === 'facebook' && incoming.facebook) {
            next.facebook = incoming.facebook;
          } else if (key === 'aboutBlurb' && incoming.aboutBlurb) {
            next.aboutBlurb = incoming.aboutBlurb;
          }
        }

        if (incoming.customDomain) {
          next.customDomain = incoming.customDomain;
        } else {
          next.customDomain = site.replace(/^https?:\/\//i, '').replace(/\/.*$/, '');
        }

        // Persist + paint shell immediately so import "works" without a second Save
        applyBrandToDocument(next);
        persistBranding(next);
        setPreviewName(next.companyName || 'Your Brand');
        setDomainInput(next.customDomain || site);

        return next;
      });

      const missing: string[] = data.missing || [];
      setImportStatus(
        `✓ Imported ${found.join(', ')} from ${data.finalUrl || site}.` +
          (data.colorSource ? ` Colors via ${data.colorSource}.` : '') +
          (missing.length ? ` Not found: ${missing.join(', ')} — set manually if needed.` : '') +
          ' Saved to this browser.'
      );
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (e: unknown) {
      setImportStatus(
        `Import failed: ${e instanceof Error ? e.message : 'network error'}. Enter branding manually below.`
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1 tracking-tight">White-Label Branding Engine</h1>
        <p className="text-gray-600">
          Live preview. Import from your brokerage site or edit manually — changes apply across the
          app when saved.
        </p>
        {!isDemo && (
          <div className="mt-2 inline-block text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">
            PRODUCTION — Branding lock engaged. Customize to your real brokerage.
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 card p-6 sm:p-8 space-y-6">
          {/* Import first — primary workflow */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50/40 p-4 space-y-3">
            <div className="text-sm font-semibold text-blue-900">Import from brokerage website</div>
            <p className="text-xs text-blue-800/80">
              Reads logo, colors, company name, phone, and Facebook from the public homepage. Works
              with most WordPress / IDX brokerage sites.
            </p>
            <label className="block text-xs font-medium text-gray-600">
              Domain or full URL
              <input
                type="text"
                value={domainInput}
                onChange={(e) => {
                  setDomainInput(e.target.value);
                  updateBranding({ customDomain: e.target.value.replace(/^https?:\/\//i, '').replace(/\/.*$/, '') });
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    importFromSite();
                  }
                }}
                className="mt-1 w-full border p-3 rounded-xl font-mono text-sm bg-white"
                placeholder="archibaldbagley.com"
                disabled={importing}
              />
            </label>
            <button
              type="button"
              onClick={importFromSite}
              disabled={importing}
              className="w-full py-2.5 rounded-xl bg-blue-600 text-white hover:bg-blue-500 font-medium text-sm disabled:opacity-50"
            >
              {importing
                ? 'Importing…'
                : `📥 Import branding from ${domainInput || 'site'}`}
            </button>
            {importStatus && (
              <p
                className={`text-xs rounded-lg px-3 py-2 border ${
                  importStatus.startsWith('✓')
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : importStatus.includes('Could not') || importStatus.includes('failed')
                      ? 'bg-rose-50 border-rose-200 text-rose-800'
                      : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                {importStatus}
              </p>
            )}
          </div>

          <div>
            <label className="block font-medium mb-2">Company / Brokerage Name</label>
            <input
              type="text"
              value={branding.companyName || ''}
              onChange={(e) => updateBranding({ companyName: e.target.value })}
              className="w-full border p-3 rounded-lg text-lg"
            />
          </div>

          <div>
            <label className="block font-medium mb-2">Tagline</label>
            <input
              type="text"
              value={branding.tagline || ''}
              onChange={(e) => updateBranding({ tagline: e.target.value })}
              className="w-full border p-3 rounded-lg"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium mb-2">Phone</label>
              <input
                type="text"
                value={branding.phone || ''}
                onChange={(e) => updateBranding({ phone: e.target.value })}
                className="w-full border p-3 rounded-lg"
                placeholder="(208) 745-5911"
              />
            </div>
            <div>
              <label className="block font-medium mb-2">Facebook</label>
              <input
                type="text"
                value={branding.facebook || ''}
                onChange={(e) => updateBranding({ facebook: e.target.value })}
                className="w-full border p-3 rounded-lg"
                placeholder="https://www.facebook.com/..."
              />
            </div>
          </div>

          <div>
            <label className="block font-medium mb-2">About / Company Description</label>
            <textarea
              value={branding.aboutBlurb || ''}
              onChange={(e) => updateBranding({ aboutBlurb: e.target.value })}
              className="w-full border p-3 rounded-lg h-24 text-sm"
              placeholder="Company story, expertise..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(
              [
                { key: 'primaryColor' as const, label: 'Primary', fallback: '#1e40af' },
                { key: 'secondaryColor' as const, label: 'Secondary', fallback: '#3b82f6' },
                { key: 'accentColor' as const, label: 'Accent', fallback: '#0ea5e9' },
              ] as const
            ).map(({ key, label, fallback }) => (
              <div key={key}>
                <label className="block font-medium mb-2 text-sm">{label}</label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={colorInputValue(branding[key], fallback)}
                    onChange={(e) => updateBranding({ [key]: e.target.value })}
                    className="w-14 h-11 border rounded"
                  />
                  <input
                    type="text"
                    value={branding[key] || fallback}
                    onChange={(e) => {
                      const hex = normalizeHex(e.target.value);
                      updateBranding({ [key]: hex || e.target.value });
                    }}
                    className="flex-1 border p-2.5 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block font-medium mb-2">Logo</label>
            <div className="flex items-center gap-4 flex-wrap">
              <input type="file" accept="image/*" onChange={simulateLogo} className="text-sm" />
              {branding.logo && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={branding.logo}
                  alt="logo preview"
                  className="h-9 object-contain border rounded px-2 bg-white max-w-[160px]"
                />
              )}
              <span className="text-xs text-gray-500">
                Upload or import from site. Stored in this browser for preview.
              </span>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={handleSave}
              className="flex-1 btn-primary py-3 rounded-2xl font-semibold"
            >
              {savedFlash ? '✓ Saved' : 'Save & Apply to App'}
            </button>
            <button type="button" onClick={resetTheme} className="px-8 border rounded-2xl">
              Reset
            </button>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="text-sm font-medium mb-2 text-gray-500">
            LIVE PREVIEW — Sidebar + header
          </div>
          <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
            <div className="p-4 border-b bg-white flex items-center gap-3">
              {branding.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={branding.logo} alt="" className="h-8 object-contain max-w-[120px]" />
              ) : null}
              <div>
                <div className="font-bold text-xl" style={{ color: 'var(--primary)' }}>
                  {previewName}
                </div>
                <div className="text-[10px] text-gray-500">{branding.tagline}</div>
                {branding.phone && <div className="text-xs mt-1">📞 {branding.phone}</div>}
              </div>
            </div>
            <div className="p-4 text-xs space-y-1 text-gray-600 bg-white">
              <div>Dashboard</div>
              <div>GIS Monitoring</div>
              <div>Marketing Agent</div>
              <div className="font-semibold" style={{ color: 'var(--primary)' }}>
                AI Assistants
              </div>
              <div>Client Portal</div>
              <div>Branding</div>
            </div>
            <div className="p-3 border-t bg-gray-50 text-xs flex items-center justify-between">
              <span style={{ color: 'var(--primary)' }}>Branded header preview</span>
              <span className="font-mono text-[10px]">{branding.customDomain}</span>
            </div>
            {branding.aboutBlurb && (
              <div className="p-3 border-t bg-white text-[10px] text-gray-600 italic line-clamp-3">
                {branding.aboutBlurb.slice(0, 160)}
                {branding.aboutBlurb.length > 160 ? '…' : ''}
              </div>
            )}
          </div>

          <div className="mt-6 text-xs bg-white border p-4 rounded-2xl space-y-2">
            <strong>How import works</strong>
            <ol className="list-decimal pl-4 space-y-1 text-gray-600">
              <li>Enter the public website domain</li>
              <li>Click Import — server fetches HTML (SSRF-safe)</li>
              <li>Logo, colors, name, phone, social are extracted</li>
              <li>Theme applies immediately and saves to this browser</li>
            </ol>
          </div>

          <Link href="/" className="block mt-4 text-sm underline">
            See branding live on Dashboard →
          </Link>
        </div>
      </div>
    </div>
  );
}
