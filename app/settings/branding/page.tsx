'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { isDemoMode } from '@/lib/env';

export default function BrandingSettings() {
  const [branding, setBranding] = useState({
    logo: '',
    primaryColor: '#1e40af',
    secondaryColor: '#3b82f6',
    accentColor: '#0ea5e9',
    companyName: 'Archibald-Bagley Real Estate',
    customDomain: 'archibaldbagley.com',
    tagline: 'Your Eastern Idaho Realtors',
    phone: '(208) 745-5911',
    facebook: 'https://www.facebook.com/archibaldbagleyrealestate',
    aboutBlurb: 'Archibald-Bagley Real Estate has built a reputation for integrity, professionalism, and a deep understanding of the local market. With over two decades of experience, we specialize in connecting individuals and families with their ideal properties across Rigby, Idaho Falls, and the surrounding regions.'
  });

  const [previewName, setPreviewName] = useState(branding.companyName);
  const isDemo = isDemoMode();

  useEffect(() => {
    const saved = localStorage.getItem('summitforge_branding');
    if (saved) {
      const parsed = JSON.parse(saved);
      setBranding(parsed);
      setPreviewName(parsed.companyName);
      applyTheme(parsed);
    } else {
      // Automate: on first open without branding, pull from live site
      importFromSite();
    }
  }, []);

  const applyTheme = (b: any) => {
    const root = document.documentElement;
    if (b.primaryColor) root.style.setProperty('--primary', b.primaryColor);
    if (b.secondaryColor) root.style.setProperty('--secondary', b.secondaryColor);
    if (b.accentColor) root.style.setProperty('--accent', b.accentColor);
    setPreviewName(b.companyName || 'Your Brand');
  };

  const updateBranding = (updates: Partial<typeof branding>) => {
    const next = { ...branding, ...updates };
    setBranding(next);
    applyTheme(next);
  };

  const handleSave = () => {
    localStorage.setItem('summitforge_branding', JSON.stringify(branding));
    applyTheme(branding);
    alert('Branding saved. This preview uses localStorage. In real deployment: persisted to Supabase per-organization + instant theme propagation across white-label instances.');
  };

  const resetTheme = () => {
    localStorage.removeItem('summitforge_branding');
    const defaults = {
      logo: '', primaryColor: '#1e40af', secondaryColor: '#3b82f6', accentColor: '#0ea5e9',
      companyName: 'Archibald-Bagley Real Estate', customDomain: 'archibaldbagley.com', tagline: 'Your Eastern Idaho Realtors',
      phone: '(208) 745-5911', facebook: 'https://www.facebook.com/archibaldbagleyrealestate',
      aboutBlurb: 'Archibald-Bagley Real Estate has built a reputation for integrity, professionalism, and a deep understanding of the local market.'
    };
    setBranding(defaults);
    document.documentElement.style.removeProperty('--primary');
    document.documentElement.style.removeProperty('--secondary');
    document.documentElement.style.removeProperty('--accent');
    setPreviewName(defaults.companyName);
  };

  const simulateLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      updateBranding({ logo: url });
    }
  };

  // Fully automated live sync from archibaldbagley.com (calls server API)
  const importFromSite = async () => {
    try {
      const res = await fetch('/api/branding/sync');
      const data = await res.json();
      if (data.branding) {
        const next = { ...branding, ...data.branding };
        setBranding(next);
        applyTheme(next);
        alert(`✅ Automated sync complete from archibaldbagley.com (${data.source}). ${data.branding.logo ? 'Logo detected.' : 'Logo not auto-detected — upload it.'} Non-data content (about, contact) imported. Save to persist.`);
      }
    } catch (e) {
      alert('Live sync unavailable — using reliable Archibald-Bagley defaults.');
      const fallback = {
        ...branding,
        companyName: 'Archibald-Bagley Real Estate',
        tagline: 'Your Eastern Idaho Realtors',
        phone: '(208) 745-5911',
        facebook: 'https://www.facebook.com/archibaldbagleyrealestate',
        aboutBlurb: 'Archibald-Bagley Real Estate has built a reputation for integrity, professionalism, and a deep understanding of the local market. With over two decades of experience, we specialize in Land & Acreage across Rigby, Idaho Falls, and Eastern Idaho.',
      };
      setBranding(fallback);
      applyTheme(fallback);
    }
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-1">White-Label Branding Engine</h1>
        <p className="text-gray-600">Live preview. Changes apply across the entire app instantly. Foundation for reseller + multi-tenant SaaS.</p>
        {!isDemo && <div className="mt-2 inline-block text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded">PRODUCTION — Branding lock engaged. Customize to your real brokerage. Demo-only elements are hidden app-wide.</div>}
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Controls */}
        <div className="lg:col-span-3 card p-8 space-y-6">
          <div>
            <label className="block font-medium mb-2">Company / Brokerage Name</label>
            <input 
              type="text" 
              value={branding.companyName}
              onChange={(e) => updateBranding({ companyName: e.target.value })}
              className="w-full border p-3 rounded-lg text-lg"
            />
          </div>

          <div>
            <label className="block font-medium mb-2">Tagline</label>
            <input 
              type="text" 
              value={branding.tagline}
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
            <label className="block font-medium mb-2">About / Company Description (non-data content)</label>
            <textarea 
              value={branding.aboutBlurb || ''}
              onChange={(e) => updateBranding({ aboutBlurb: e.target.value })}
              className="w-full border p-3 rounded-lg h-24 text-sm"
              placeholder="Company story, expertise..."
            />
          </div>

          <button 
            onClick={importFromSite}
            className="w-full py-2 rounded-xl border border-blue-600 text-blue-600 hover:bg-blue-50 font-medium text-sm"
          >
            📥 Import Official Branding + Info from archibaldbagley.com
          </button>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { key: 'primaryColor', label: 'Primary' },
              { key: 'secondaryColor', label: 'Secondary' },
              { key: 'accentColor', label: 'Accent' }
            ].map(({ key, label }) => (
              <div key={key}>
                <label className="block font-medium mb-2 text-sm">{label}</label>
                <div className="flex gap-2">
                  <input 
                    type="color" 
                    value={(branding as any)[key]}
                    onChange={(e) => updateBranding({ [key]: e.target.value })}
                    className="w-14 h-11 border rounded"
                  />
                  <input 
                    type="text" 
                    value={(branding as any)[key]}
                    onChange={(e) => updateBranding({ [key]: e.target.value })}
                    className="flex-1 border p-2.5 rounded-lg font-mono text-sm"
                  />
                </div>
              </div>
            ))}
          </div>

          <div>
            <label className="block font-medium mb-2">Logo (Preview)</label>
            <div className="flex items-center gap-4">
              <input type="file" accept="image/*" onChange={simulateLogo} className="text-sm" />
              {branding.logo && (
                <img src={branding.logo} alt="logo preview" className="h-9 object-contain border rounded px-2 bg-white" />
              )}
              <span className="text-xs text-gray-500">Upload will be stored per tenant in prod.</span>
            </div>
          </div>

          <div>
            <label className="block font-medium mb-2">Custom Domain</label>
            <input 
              type="text" 
              value={branding.customDomain}
              onChange={(e) => updateBranding({ customDomain: e.target.value })}
              className="w-full border p-3 rounded-lg font-mono"
            />
            <p className="text-xs mt-1 text-gray-500">CNAME your domain → platform. Full support in production + reseller mode.</p>
          </div>

          <div className="flex gap-3 pt-2">
            <button onClick={handleSave} className="flex-1 btn-primary py-3 rounded-2xl font-semibold">Save &amp; Apply to App</button>
            <button onClick={resetTheme} className="px-8 border rounded-2xl">Reset to Default</button>
          </div>
        </div>

        {/* Live Preview Panel */}
        <div className="lg:col-span-2">
          <div className="text-sm font-medium mb-2 text-gray-500">LIVE PREVIEW — Applied to sidebar + header</div>
          <div className="border rounded-2xl overflow-hidden bg-white shadow-sm">
            {/* Mini Sidebar Preview */}
            <div className="p-4 border-b bg-white" style={{ borderColor: 'var(--primary)' }}>
              <div className="font-bold text-xl" style={{ color: 'var(--primary)' }}>{previewName}</div>
              <div className="text-[10px] text-gray-500">{branding.tagline}</div>
              {branding.phone && <div className="text-xs mt-1">📞 {branding.phone}</div>}
            </div>
            <div className="p-4 text-xs space-y-1 text-gray-600 bg-white">
              <div>Dashboard</div>
              <div>GIS Monitoring</div>
              <div>Marketing Agent</div>
              <div className="font-semibold" style={{ color: 'var(--primary)' }}>AI Assistants</div>
              <div>Client Portal</div>
              <div>Branding</div>
            </div>
            <div className="p-3 border-t bg-gray-50 text-xs flex items-center justify-between">
              <span style={{ color: 'var(--primary)' }}>Branded header preview</span>
              <span className="font-mono text-[10px]">{branding.customDomain}</span>
            </div>
            {branding.aboutBlurb && (
              <div className="p-3 border-t bg-white text-[10px] text-gray-600 italic line-clamp-3">
                {branding.aboutBlurb.slice(0, 140)}...
              </div>
            )}
          </div>

          <div className="mt-6 text-xs bg-white border p-4 rounded-2xl">
            <strong>Production path:</strong> Save to org record in Supabase. Rehydrate on login per tenant. 
            Override emails, PDFs, and PWA manifest. Enables true reseller SaaS.
          </div>

          <Link href="/" className="block mt-4 text-sm underline">See branding live on Dashboard →</Link>
        </div>
      </div>
    </div>
  );
}
