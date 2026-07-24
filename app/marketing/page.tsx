'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import type { CampaignBrief, CampaignChannel, MarketingCampaign } from '@/lib/marketing/types';
import { loadCampaigns, upsertCampaign } from '@/lib/marketing/store';

const money = (n: number) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const STATUS_STYLE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  pending_approval: 'bg-amber-50 text-amber-800 border-amber-200',
  approved: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  deploying: 'bg-blue-50 text-blue-800 border-blue-200',
  deployed: 'bg-emerald-600 text-white border-emerald-700',
  rejected: 'bg-rose-50 text-rose-700 border-rose-200',
  paused: 'bg-gray-100 text-gray-600 border-gray-200',
  completed: 'bg-slate-800 text-white border-slate-900',
};

const PRESETS: { label: string; brief: Partial<CampaignBrief> }[] = [
  {
    label: '40 ac land · builders',
    brief: {
      property: {
        address: 'Sample 40 acres near Terreton, ID',
        acres: 40,
        price: 620000,
        propertyType: 'Land',
        city: 'Terreton',
      },
      primaryGoal: 'Attract builders and qualified land buyers',
      secondaryGoals: ['Share feasibility context', 'Book site tours'],
      budgetCap: 1500,
      timelineDays: 21,
      tone: 'investor',
      targetAudienceHints: ['builders', '1031 investors'],
    },
  },
  {
    label: '12 ac Rigby · family',
    brief: {
      property: {
        address: '12.5 acres near Rigby, ID',
        acres: 12.5,
        price: 650000,
        propertyType: 'Land',
        city: 'Rigby',
      },
      primaryGoal: 'Generate end-buyer leads who want to build',
      budgetCap: 1200,
      timelineDays: 21,
      tone: 'family',
    },
  },
  {
    label: 'Home · Rigby',
    brief: {
      property: {
        address: '789 Lindy Lane, Rigby, ID',
        acres: 0.25,
        price: 489000,
        propertyType: 'Single Family',
        city: 'Rigby',
      },
      primaryGoal: 'Book showings and secure a clean offer',
      budgetCap: 800,
      timelineDays: 14,
      tone: 'friendly',
    },
  },
];

export default function MarketingAgentDashboard() {
  const [brief, setBrief] = useState<CampaignBrief>({
    property: {
      address: 'Sample 40 acres near Terreton, ID',
      acres: 40,
      price: 620000,
      propertyType: 'Land',
      city: 'Terreton',
    },
    primaryGoal: 'Attract builders and qualified land buyers',
    secondaryGoals: ['Share feasibility context'],
    budgetCap: 1500,
    timelineDays: 21,
    tone: 'premium',
    agentName: 'Kipp Archibald',
    brokerageName: 'Archibald-Bagley Real Estate',
    complianceMarket: 'Idaho',
  });

  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [history, setHistory] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [banner, setBanner] = useState('');
  const [revisionNotes, setRevisionNotes] = useState('');
  const [activeTab, setActiveTab] = useState<
    'overview' | 'channels' | 'creatives' | 'calendar' | 'compliance' | 'ai'
  >('overview');

  useEffect(() => {
    setHistory(loadCampaigns());
  }, []);

  const persist = (c: MarketingCampaign) => {
    setCampaign(c);
    const list = upsertCampaign(c);
    setHistory(list);
  };

  const applyPreset = (p: (typeof PRESETS)[0]) => {
    setBrief((b) => ({
      ...b,
      ...p.brief,
      property: { ...b.property, ...p.brief.property },
      agentName: b.agentName,
      brokerageName: b.brokerageName,
      complianceMarket: b.complianceMarket,
    }));
    setCampaign(null);
    setBanner('');
  };

  const buildCampaign = async () => {
    setLoading(true);
    setBanner('');
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ brief }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error || data.message || 'Build failed');
      const c = data.campaign as MarketingCampaign;
      persist(c);
      setActiveTab('overview');
      setBanner(data.message || 'Campaign ready for approval. Nothing has been published.');
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Build failed');
    } finally {
      setLoading(false);
    }
  };

  const approve = async (action: 'approve' | 'reject' | 'request_changes') => {
    if (!campaign) return;
    setLoading(true);
    setBanner('');
    try {
      const res = await fetch('/api/ai/marketing/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaign,
          action,
          notes: revisionNotes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Approval failed');
      persist(data.campaign);
      setBanner(data.message);
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Approval failed');
    } finally {
      setLoading(false);
    }
  };

  const rebuild = async () => {
    if (!campaign || !revisionNotes.trim()) {
      setBanner('Add revision notes before rebuilding.');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rebuild',
          campaign,
          notes: revisionNotes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Rebuild failed');
      persist(data.campaign);
      setBanner(data.message || 'Rebuilt — please re-approve.');
      setRevisionNotes('');
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Rebuild failed');
    } finally {
      setLoading(false);
    }
  };

  const deploy = async (dryRun = false) => {
    if (!campaign) return;
    setLoading(true);
    setBanner('');
    try {
      const res = await fetch('/api/ai/marketing/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaign, dryRun }),
      });
      const data = await res.json();
      if (data.campaign) persist(data.campaign);
      setBanner(data.message || (data.ok ? 'Deployed' : data.error || 'Deploy blocked'));
    } catch (e: unknown) {
      setBanner(e instanceof Error ? e.message : 'Deploy failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleChannel = (key: string) => {
    if (!campaign) return;
    const channels = campaign.channels.map((c) =>
      c.key === key ? { ...c, enabled: !c.enabled } : c
    );
    const budgetTotal = channels.filter((c) => c.enabled).reduce((s, c) => s + c.budget, 0);
    persist({
      ...campaign,
      channels,
      budgetTotal,
      budgetBreakdown: channels
        .filter((c) => c.enabled && c.budget > 0)
        .map((c) => ({ channel: c.name, amount: c.budget })),
      updatedAt: new Date().toISOString(),
    });
  };

  const enabledBudget = useMemo(() => {
    if (!campaign) return 0;
    return campaign.channels.filter((c) => c.enabled).reduce((s, c) => s + c.budget, 0);
  }, [campaign]);

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto">
      <div className="page-header flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-700 mb-1">
            Autonomous agent · Human approval required
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">Marketing Agent</h1>
          <p className="text-gray-600 mt-1 max-w-2xl">
            Builds full campaigns from a brief using land/home playbooks, Fair Housing guardrails,
            and channel budgets — then waits for you to approve and deploy.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-sm">
          <Link href="/crm" className="px-3 py-2 rounded-xl border hover:bg-gray-50">
            CRM
          </Link>
          <Link href="/development/plat" className="px-3 py-2 rounded-xl border hover:bg-gray-50">
            AI Plat
          </Link>
          <Link
            href="/ai-assistants"
            className="px-3 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-500"
          >
            AI Assistants
          </Link>
        </div>
      </div>

      {/* Pipeline steps */}
      <ol className="flex flex-wrap gap-2 mb-6 text-xs">
        {[
          { n: '1', t: 'Brief' },
          { n: '2', t: 'Agent builds' },
          { n: '3', t: 'You review' },
          { n: '4', t: 'Approve' },
          { n: '5', t: 'Deploy' },
        ].map((s, i) => (
          <li
            key={s.n}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-gray-200 text-gray-700"
          >
            <span className="w-5 h-5 rounded-full bg-gray-900 text-white flex items-center justify-center text-[10px] font-bold">
              {s.n}
            </span>
            {s.t}
            {i < 4 && <span className="text-gray-300 ml-1">→</span>}
          </li>
        ))}
      </ol>

      {banner && (
        <div
          className={`mb-4 text-sm px-4 py-3 rounded-xl border ${
            banner.toLowerCase().includes('fail') || banner.toLowerCase().includes('cannot')
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-900'
          }`}
        >
          {banner}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Brief */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white border rounded-2xl p-5 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold">Campaign brief</div>
              <span className="text-[10px] uppercase tracking-wide text-gray-400">Inputs</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="text-[11px] px-2.5 py-1 rounded-full border hover:bg-gray-50"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <Field
              label="Address"
              value={brief.property.address}
              onChange={(v) => setBrief({ ...brief, property: { ...brief.property, address: v } })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Acres"
                type="number"
                value={String(brief.property.acres ?? '')}
                onChange={(v) =>
                  setBrief({
                    ...brief,
                    property: { ...brief.property, acres: v ? Number(v) : undefined },
                  })
                }
              />
              <Field
                label="Price $"
                type="number"
                value={String(brief.property.price ?? '')}
                onChange={(v) =>
                  setBrief({
                    ...brief,
                    property: { ...brief.property, price: v ? Number(v) : undefined },
                  })
                }
              />
            </div>
            <label className="block text-xs text-gray-500">
              Property type
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={brief.property.propertyType || 'Land'}
                onChange={(e) =>
                  setBrief({
                    ...brief,
                    property: { ...brief.property, propertyType: e.target.value },
                  })
                }
              >
                <option>Land</option>
                <option>Vacant Land</option>
                <option>Single Family</option>
                <option>New Construction</option>
                <option>Farm/Ranch</option>
              </select>
            </label>
            <Field
              label="Primary goal"
              value={brief.primaryGoal}
              onChange={(v) => setBrief({ ...brief, primaryGoal: v })}
            />
            <div className="grid grid-cols-2 gap-2">
              <Field
                label="Budget cap $"
                type="number"
                value={String(brief.budgetCap ?? '')}
                onChange={(v) =>
                  setBrief({ ...brief, budgetCap: v ? Number(v) : undefined })
                }
              />
              <Field
                label="Timeline (days)"
                type="number"
                value={String(brief.timelineDays ?? 21)}
                onChange={(v) =>
                  setBrief({ ...brief, timelineDays: v ? Number(v) : 21 })
                }
              />
            </div>
            <label className="block text-xs text-gray-500">
              Tone
              <select
                className="mt-1 w-full border rounded-xl px-3 py-2 text-sm"
                value={brief.tone || 'premium'}
                onChange={(e) =>
                  setBrief({
                    ...brief,
                    tone: e.target.value as CampaignBrief['tone'],
                  })
                }
              >
                <option value="premium">Premium</option>
                <option value="friendly">Friendly</option>
                <option value="investor">Investor</option>
                <option value="family">Family</option>
              </select>
            </label>

            <button
              type="button"
              disabled={loading}
              onClick={buildCampaign}
              className="w-full py-3 rounded-2xl bg-black text-white text-sm font-semibold hover:bg-gray-900 disabled:opacity-50"
            >
              {loading ? 'Agent building campaign…' : '▶ Build campaign autonomously'}
            </button>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Best practices: goal → audience → message → channel → creative → calendar → KPI.
              Nothing publishes until you approve and deploy.
            </p>
          </div>

          {history.length > 0 && (
            <div className="bg-white border rounded-2xl p-4 shadow-sm">
              <div className="text-sm font-semibold mb-2">Recent campaigns</div>
              <ul className="space-y-1.5 max-h-48 overflow-auto">
                {history.slice(0, 8).map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setCampaign(h);
                        setBanner('');
                      }}
                      className="w-full text-left text-xs px-2 py-2 rounded-lg hover:bg-gray-50 border border-transparent hover:border-gray-100"
                    >
                      <div className="font-medium text-gray-800 truncate">
                        {h.brief.property.address}
                      </div>
                      <div className="text-gray-400 flex justify-between gap-2">
                        <span className="capitalize">{h.status.replace(/_/g, ' ')}</span>
                        <span>{money(h.budgetTotal)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Campaign review */}
        <div className="lg:col-span-8">
          {!campaign ? (
            <div className="h-full min-h-[420px] flex flex-col items-center justify-center text-center border border-dashed rounded-3xl bg-white/50 p-10">
              <div className="text-4xl mb-3">📣</div>
              <div className="font-semibold text-gray-700 text-lg">No campaign yet</div>
              <p className="text-sm text-gray-500 mt-2 max-w-md">
                Fill the brief (or pick a preset) and let the agent assemble channels, creatives,
                calendar, KPIs, and compliance — then approve to unlock deploy.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header card */}
              <div className="bg-white border rounded-3xl p-5 sm:p-6 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-xs text-gray-400 font-mono">{campaign.id}</div>
                    <h2 className="text-xl font-semibold mt-0.5">{campaign.brief.property.address}</h2>
                    <p className="text-sm text-gray-600 mt-1">{campaign.concept}</p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-semibold border capitalize ${
                      STATUS_STYLE[campaign.status] || STATUS_STYLE.draft
                    }`}
                  >
                    {campaign.status.replace(/_/g, ' ')}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5">
                  <MiniStat label="Budget (enabled)" value={money(enabledBudget)} />
                  <MiniStat
                    label="Channels on"
                    value={String(campaign.channels.filter((c) => c.enabled).length)}
                  />
                  <MiniStat label="Assets" value={String(campaign.assets.length)} />
                  <MiniStat label="Weeks" value={String(campaign.calendar.length)} />
                </div>

                {/* Approval / deploy actions */}
                <div className="mt-5 pt-5 border-t space-y-3">
                  {(campaign.status === 'pending_approval' || campaign.status === 'draft') && (
                    <>
                      <label className="block text-xs text-gray-500">
                        Notes for reject / request changes / rebuild
                        <textarea
                          className="mt-1 w-full border rounded-xl px-3 py-2 text-sm min-h-[72px]"
                          placeholder="e.g. Cut Google Ads, emphasize builder outreach, softer tone…"
                          value={revisionNotes}
                          onChange={(e) => setRevisionNotes(e.target.value)}
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => approve('approve')}
                          className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-500 disabled:opacity-50"
                        >
                          ✓ Approve campaign
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => approve('request_changes')}
                          className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                          Request changes
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={rebuild}
                          className="px-4 py-2.5 rounded-xl border text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                          Rebuild with notes
                        </button>
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => approve('reject')}
                          className="px-4 py-2.5 rounded-xl border border-rose-200 text-rose-700 text-sm hover:bg-rose-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    </>
                  )}

                  {campaign.status === 'approved' && (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => deploy(false)}
                        className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-900 disabled:opacity-50"
                      >
                        🚀 Deploy campaign
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => deploy(true)}
                        className="px-4 py-2.5 rounded-xl border text-sm hover:bg-gray-50 disabled:opacity-50"
                      >
                        Dry run
                      </button>
                      <p className="w-full text-[11px] text-gray-400">
                        Deploy is simulated until Meta Marketing API + email ESP are connected. Lead
                        routing still goes to your CRM playbook.
                      </p>
                    </div>
                  )}

                  {campaign.status === 'deployed' && campaign.deployLog && (
                    <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4 text-sm text-emerald-900">
                      <div className="font-semibold">Deployed</div>
                      <p className="mt-1">{campaign.deployLog.note}</p>
                      <div className="text-xs mt-2 text-emerald-700">
                        Channels: {campaign.deployLog.channels.join(' · ')}
                      </div>
                      <ul className="mt-2 text-xs space-y-0.5">
                        {campaign.deployLog.actions.map((a) => (
                          <li key={a}>• {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {campaign.status === 'rejected' && (
                    <p className="text-sm text-rose-600">
                      Rejected. Adjust the brief and build a new campaign.
                    </p>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex flex-wrap gap-1 border-b">
                {(
                  [
                    ['overview', 'Overview'],
                    ['channels', 'Channels'],
                    ['creatives', 'Creatives'],
                    ['calendar', 'Calendar'],
                    ['compliance', 'Compliance'],
                    ['ai', 'AI strategy'],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition ${
                      activeTab === id
                        ? 'border-gray-900 text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="bg-white border rounded-2xl p-5 shadow-sm min-h-[280px]">
                {activeTab === 'overview' && (
                  <div className="space-y-5 text-sm">
                    <section>
                      <h3 className="font-semibold text-gray-900 mb-1">Positioning</h3>
                      <p className="text-gray-600">{campaign.positioning}</p>
                    </section>
                    <section>
                      <h3 className="font-semibold text-gray-900 mb-2">Goals</h3>
                      <ul className="list-disc pl-5 text-gray-600 space-y-1">
                        {campaign.goals.map((g, i) => (
                          <li key={i}>{g}</li>
                        ))}
                      </ul>
                    </section>
                    <section>
                      <h3 className="font-semibold text-gray-900 mb-2">Audiences</h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {campaign.audiences.map((a) => (
                          <div key={a.id} className="rounded-xl border p-3 bg-gray-50">
                            <div className="flex justify-between gap-2">
                              <span className="font-medium">{a.name}</span>
                              <span className="text-[10px] uppercase text-gray-400">
                                {a.priority}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">{a.description}</p>
                            <p className="text-xs text-emerald-800 mt-2">
                              Angle: {a.messagingAngle}
                            </p>
                          </div>
                        ))}
                      </div>
                    </section>
                    <section>
                      <h3 className="font-semibold text-gray-900 mb-2">KPIs</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead className="text-left text-gray-400">
                            <tr>
                              <th className="py-1 pr-2">Metric</th>
                              <th className="py-1 pr-2">Target</th>
                              <th className="py-1">How measured</th>
                            </tr>
                          </thead>
                          <tbody>
                            {campaign.kpis.map((k) => (
                              <tr key={k.name} className="border-t">
                                <td className="py-2 pr-2 font-medium">{k.name}</td>
                                <td className="py-2 pr-2">{k.target}</td>
                                <td className="py-2 text-gray-500">{k.measurement}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                    <section>
                      <h3 className="font-semibold text-gray-900 mb-2">Risks</h3>
                      <ul className="text-gray-600 space-y-1">
                        {campaign.risks.map((r, i) => (
                          <li key={i}>• {r}</li>
                        ))}
                      </ul>
                    </section>
                  </div>
                )}

                {activeTab === 'channels' && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 mb-3">
                      Toggle channels before approve/deploy. Budget updates from enabled channels.
                    </p>
                    {campaign.channels.map((ch) => (
                      <ChannelRow key={ch.key} ch={ch} onToggle={() => toggleChannel(ch.key)} />
                    ))}
                  </div>
                )}

                {activeTab === 'creatives' && (
                  <div className="space-y-3">
                    {campaign.assets.map((a) => (
                      <div key={a.id} className="rounded-xl border p-3">
                        <div className="flex flex-wrap justify-between gap-2 text-xs">
                          <span className="font-semibold text-gray-800">{a.title}</span>
                          <span className="text-gray-400 uppercase tracking-wide">{a.type}</span>
                        </div>
                        <pre className="mt-2 text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">
                          {a.body}
                        </pre>
                        {a.cta && (
                          <div className="mt-2 text-[11px] text-emerald-700 font-medium">
                            CTA: {a.cta}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'calendar' && (
                  <div className="space-y-4">
                    {campaign.calendar.map((w) => (
                      <div key={w.week} className="rounded-xl border p-4">
                        <div className="font-semibold">
                          Week {w.week} — {w.label}
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {w.objectives.join(' · ')}
                        </div>
                        <ul className="mt-2 text-sm text-gray-700 space-y-1">
                          {w.tasks.map((t, i) => (
                            <li key={i} className="flex gap-2">
                              <span className="text-emerald-600">☐</span> {t}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}

                {activeTab === 'compliance' && (
                  <div className="space-y-4 text-sm">
                    <p className="text-gray-600">
                      Fair Housing and advertising checklist (Idaho / federal best practices).
                      Confirm before deploy.
                    </p>
                    <ul className="space-y-2">
                      {campaign.fairHousingChecklist.map((item, i) => (
                        <li key={i} className="flex gap-2 items-start">
                          <span className="text-emerald-600 mt-0.5">✓</span>
                          <span className="text-gray-700">{item}</span>
                        </li>
                      ))}
                    </ul>
                    <div className="rounded-xl bg-amber-50 border border-amber-100 p-3 text-xs text-amber-900">
                      Marketing claims about buildability, views, or entitlements should be verified
                      with county data / PLS. Prefer “buyer to verify” language where uncertain.
                    </div>
                  </div>
                )}

                {activeTab === 'ai' && (
                  <div className="text-sm">
                    {campaign.aiStrategy ? (
                      <div className="whitespace-pre-wrap text-gray-700 leading-relaxed">
                        {campaign.aiStrategy}
                      </div>
                    ) : (
                      <p className="text-gray-400">
                        No LLM narrative (demo mode or key missing). Structured playbook still
                        applied.
                      </p>
                    )}
                    {campaign.revisionNotes && (
                      <div className="mt-4 p-3 rounded-xl bg-slate-50 border text-xs">
                        <div className="font-semibold text-slate-600">Revision notes</div>
                        <p className="mt-1 text-slate-700">{campaign.revisionNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block text-xs text-gray-500">
      {label}
      <input
        type={type}
        className="mt-1 w-full border rounded-xl px-3 py-2 text-sm text-gray-900"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-gray-50 border border-gray-100 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-gray-400">{label}</div>
      <div className="font-semibold text-gray-900 tabular-nums">{value}</div>
    </div>
  );
}

function ChannelRow({ ch, onToggle }: { ch: CampaignChannel; onToggle: () => void }) {
  return (
    <div
      className={`rounded-xl border p-3 flex flex-wrap gap-3 items-start justify-between ${
        ch.enabled ? 'bg-white' : 'bg-gray-50 opacity-60'
      }`}
    >
      <div className="flex gap-3 min-w-0">
        <input
          type="checkbox"
          checked={ch.enabled}
          onChange={onToggle}
          className="mt-1"
          aria-label={`Toggle ${ch.name}`}
        />
        <div>
          <div className="font-medium text-sm flex flex-wrap items-center gap-2">
            {ch.name}
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full uppercase ${
                ch.priority === 'high'
                  ? 'bg-emerald-100 text-emerald-800'
                  : ch.priority === 'medium'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-gray-100 text-gray-600'
              }`}
            >
              {ch.priority}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5">{ch.expectedReach}</div>
          <ul className="text-[11px] text-gray-500 mt-1 space-y-0.5">
            {ch.tactics.slice(0, 3).map((t) => (
              <li key={t}>• {t}</li>
            ))}
          </ul>
          {ch.complianceNotes?.length ? (
            <div className="text-[10px] text-amber-700 mt-1">
              {ch.complianceNotes.join(' · ')}
            </div>
          ) : null}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="font-semibold text-sm tabular-nums">
          {ch.budget > 0 ? money(ch.budget) : 'Owned'}
        </div>
        {ch.cpaTarget && <div className="text-[10px] text-gray-400">{ch.cpaTarget}</div>}
      </div>
    </div>
  );
}
