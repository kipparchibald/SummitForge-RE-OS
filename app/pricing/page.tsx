'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { isDemoMode } from '@/lib/env';

interface Tier {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  ctaSecondary?: string;
  popular?: boolean;
  features: string[];
}

interface FeatureRow {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
  enterprise: string | boolean;
  category?: string;
}

const tiers: Tier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'Perfect for trying out core tools and basic AI assistance on Jefferson County land deals.',
    cta: 'Start Free',
    features: [
      'Basic AI assistants (limited calls)',
      'Core GIS parcel viewing',
      'Limited marketing plan generation',
      'Import & basic analytics',
      'Community support',
    ],
  },
  {
    name: 'Pro',
    price: '$99',
    period: '/mo',
    description: 'Full power for active agents & small teams. Unlimited AI, white-label branding, and marketing execution.',
    cta: 'Subscribe (Demo)',
    popular: true,
    features: [
      'Full AI Assistants (Valuation, Marketing, Council, Transaction, Lead)',
      'Unlimited AI usage & interactions',
      'Complete GIS monitoring + pro formas',
      'Full marketing plan + execution',
      'White-label branding & client portal',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'For brokerages, resellers, and teams needing advanced white-label, multi-tenant, and dedicated support.',
    cta: 'Subscribe (Demo)',
    ctaSecondary: 'Contact Sales',
    features: [
      'Everything in Pro',
      'Advanced white-label (custom domains, reseller controls)',
      'Team seats & role management',
      'Dedicated account + SLA',
      'API access & custom integrations',
      'On-prem / self-host options',
      'Revenue share & marketplace features',
    ],
  },
];

const comparisonFeatures: FeatureRow[] = [
  // AI Agents
  { category: 'AI Agents', feature: 'Valuation Agent (AVM/CMA for land)', free: 'Limited (25/mo)', pro: 'Unlimited', enterprise: 'Unlimited + priority' },
  { feature: 'Marketing Agent (plans + content)', free: 'Limited (10/mo)', pro: 'Unlimited', enterprise: 'Unlimited + templates' },
  { feature: 'Council (Multi-agent Orchestrator)', free: false, pro: true, enterprise: true },
  { feature: 'Transaction Coordinator + Idaho forms', free: false, pro: true, enterprise: true },
  { feature: 'Lead Qualifier', free: 'Basic', pro: 'Full empathetic + routing', enterprise: 'Full + CRM sync' },
  { feature: 'AI Council synthesis & recommendations', free: false, pro: true, enterprise: true },

  // White-Label
  { category: 'White-Label & Branding', feature: 'Live branding (colors, logo, name)', free: false, pro: true, enterprise: true },
  { feature: 'Custom domain & client portal theming', free: false, pro: 'Single domain', enterprise: 'Unlimited + reseller' },
  { feature: 'Branded client portal (checklists, docs)', free: false, pro: true, enterprise: true },
  { feature: 'Reseller / multi-tenant controls', free: false, pro: false, enterprise: true },

  // Usage
  { category: 'Usage & Limits', feature: 'Monthly AI interactions', free: '50', pro: 'Unlimited (demo)', enterprise: 'Unlimited + custom quotas' },
  { feature: 'GIS checks & parcel monitoring', free: 'Limited', pro: 'Unlimited', enterprise: 'Unlimited + alerts API' },
  { feature: 'Marketing executions per month', free: '5', pro: 'Unlimited', enterprise: 'Unlimited + bulk' },
  { feature: 'Pro forma & analytics runs', free: 'Basic', pro: 'Full', enterprise: 'Full + export' },

  // GIS
  { category: 'GIS & Monitoring', feature: 'Interactive Jefferson County map', free: true, pro: true, enterprise: true },
  { feature: 'Parcel analysis & raw land pro formas', free: 'Limited', pro: true, enterprise: true },
  { feature: 'Watched area alerts & zoning checks', free: false, pro: true, enterprise: true },
  { feature: 'Advanced GIS layers & exports', free: false, pro: false, enterprise: true },

  // Marketing Execution
  { category: 'Marketing Execution', feature: 'Generate professional marketing plans', free: 'Basic templates', pro: 'Full AI + custom focus', enterprise: 'Full + A/B variants' },
  { feature: 'Execute campaigns (content, channels)', free: false, pro: true, enterprise: true },
  { feature: 'Branded asset generation', free: false, pro: true, enterprise: true },
  { feature: 'Performance tracking & optimization', free: false, pro: 'Basic', enterprise: 'Advanced + integrations' },
];

export default function PricingPage() {
  const [selectedTier, setSelectedTier] = useState<string | null>(null);
  const [checkoutLog, setCheckoutLog] = useState<string[]>([]);
  const [isAnnual, setIsAnnual] = useState(false);

  // Centralized (build-time NEXT_PUBLIC + consistent with layout)
  const isDemo = isDemoMode();

  const getPrice = (tier: Tier) => {
    if (tier.name === 'Free') return tier.price;
    if (tier.name === 'Enterprise') return tier.price;
    const base = parseInt(tier.price.replace('$', ''));
    return isAnnual ? `$${Math.round(base * 12 * 0.85)}` : tier.price;
  };

  const getPeriod = (tier: Tier) => {
    if (tier.name === 'Free' || tier.name === 'Enterprise') return tier.period;
    return isAnnual ? '/yr (save 15%)' : tier.period;
  };

  const simulateCheckout = (tierName: string, price: string) => {
    const stripePublishable = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_placeholder_from_.env.example';
    const timestamp = new Date().toLocaleTimeString();

    const logEntry = `[${timestamp}] Demo checkout initiated for ${tierName} (${price}) — using Stripe key: ${stripePublishable.slice(0, 12)}...`;
    
    console.log('[SummitForge Pricing] Simulating Stripe checkout:', {
      tier: tierName,
      price,
      publishableKey: stripePublishable,
      mode: isDemo ? 'DEMO' : 'PROD',
      note: 'In real deployment: window.location = `https://checkout.stripe.com/...` or use Stripe.js with success_url',
    });

    setCheckoutLog(prev => [logEntry, ...prev].slice(0, 6));
    setSelectedTier(tierName);

    // Beautiful demo feedback
    const message = isDemo 
      ? `✅ Stripe checkout SIMULATED for ${tierName}.\n\nPublishable key placeholder used: ${stripePublishable.slice(0, 20)}...\n\nIn production this would redirect to Stripe Checkout session.`
      : `Stripe checkout would be triggered for ${tierName}.`;

    // Use a non-blocking toast simulation
    const toast = document.createElement('div');
    toast.className = 'fixed bottom-6 right-6 bg-gray-900 text-white px-6 py-3 rounded-2xl text-sm shadow-xl z-50 max-w-sm';
    toast.innerHTML = `
      <div class="font-medium">${tierName} selected</div>
      <div class="text-gray-300 text-xs mt-0.5">${message.split('\n')[0]}</div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
      toast.style.transition = 'all 0.2s';
      toast.style.opacity = '0';
      setTimeout(() => document.body.removeChild(toast), 200);
    }, 3200);

    // For Free tier: also guide to setup
    if (tierName === 'Free') {
      setTimeout(() => {
        console.log('[Pricing] Free tier activated in demo. User can proceed to /setup or dashboard.');
      }, 800);
    }
  };

  const handleStartFree = () => {
    console.log('[Pricing] Start Free clicked');
    simulateCheckout('Free', '$0');
    // In real app could set localStorage plan or redirect
  };

  const handleSubscribe = (tier: Tier) => {
    const displayPrice = getPrice(tier) + (tier.name !== 'Enterprise' ? (isAnnual ? '/yr' : '/mo') : '');
    simulateCheckout(tier.name, displayPrice);
  };

  const clearLog = () => setCheckoutLog([]);

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Header */}
      <div className="page-header">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1>Pricing</h1>
            <p>Simple, transparent freemium tiers built for real estate professionals focused on raw land and development in Jefferson County.</p>
          </div>
          <Link href="/" className="text-sm text-gray-500 hover:underline hidden md:block">← Back to Dashboard</Link>
        </div>
      </div>

      {/* Demo awareness banner */}
      {isDemo && (
        <div className="mb-8 rounded-2xl bg-amber-50 border border-amber-200 px-5 py-3 text-sm text-amber-800 flex items-center gap-2">
          <span>🚀</span>
          <span><strong>DEMO MODE</strong> — Buttons simulate Stripe checkout using env placeholders. No real charges. Full access unlocked for preview.</span>
        </div>
      )}

      {/* Billing toggle */}
      <div className="flex justify-center mb-8">
        <div className="inline-flex items-center bg-white border rounded-full p-1 text-sm">
          <button
            onClick={() => setIsAnnual(false)}
            className={`px-5 py-1.5 rounded-full transition ${!isAnnual ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Monthly
          </button>
          <button
            onClick={() => setIsAnnual(true)}
            className={`px-5 py-1.5 rounded-full transition ${isAnnual ? 'bg-gray-900 text-white' : 'text-gray-600 hover:text-gray-900'}`}
          >
            Annual <span className="text-[10px] opacity-70">(Save 15%)</span>
          </button>
        </div>
      </div>

      {/* Tier Cards */}
      <div className="grid md:grid-cols-3 gap-6 mb-14">
        {tiers.map((tier) => {
          const price = getPrice(tier);
          const period = getPeriod(tier);
          const isPro = tier.popular;

          return (
            <div
              key={tier.name}
              className={`card p-8 flex flex-col relative ${isPro ? 'ring-2 ring-offset-2 ring-[var(--primary)] scale-[1.01]' : ''}`}
            >
              {isPro && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-0.5 bg-[var(--primary)] text-white text-xs font-semibold rounded-full tracking-widest">
                  MOST POPULAR
                </div>
              )}

              <div className="mb-1 text-sm font-semibold tracking-wider text-gray-500">{tier.name.toUpperCase()}</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-5xl font-semibold tracking-tighter">{price}</span>
                <span className="text-gray-500">{period}</span>
              </div>

              <p className="mt-3 text-sm text-gray-600 min-h-[3.5rem]">{tier.description}</p>

              <div className="mt-auto pt-8">
                {tier.name === 'Free' ? (
                  <button
                    onClick={handleStartFree}
                    className="btn-primary w-full py-3 rounded-2xl font-semibold text-base"
                  >
                    {tier.cta}
                  </button>
                ) : (
                  <button
                    onClick={() => handleSubscribe(tier)}
                    className="btn-primary w-full py-3 rounded-2xl font-semibold text-base"
                  >
                    {tier.cta}
                  </button>
                )}

                {tier.ctaSecondary && (
                  <Link
                    href="/setup"
                    className="block text-center mt-3 text-sm text-gray-500 hover:text-gray-700 underline"
                  >
                    {tier.ctaSecondary}
                  </Link>
                )}

                <div className="mt-6 space-y-2 text-sm">
                  {tier.features.map((f, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-gray-700">
                      <span className="mt-0.5 text-emerald-500">✓</span>
                      <span>{f}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-6 border-t text-[10px] text-gray-400">
                  {tier.name === 'Free' && 'No credit card required. Upgrade anytime.'}
                  {tier.name === 'Pro' && 'Cancel anytime. Billed securely via Stripe.'}
                  {tier.name === 'Enterprise' && 'Custom invoicing • Annual options available.'}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Table */}
      <div className="mb-4 flex items-end justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Feature Comparison</h2>
          <p className="text-sm text-gray-600">Focused on AI agents, white-label, usage, GIS, and marketing execution.</p>
        </div>
        <Link href="/ai-assistants" className="text-sm underline hidden sm:inline">Explore AI Assistants →</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b bg-gray-50">
              <th className="text-left font-medium p-4 pl-6 w-80">Feature</th>
              <th className="text-center font-medium p-4">Free</th>
              <th className="text-center font-medium p-4 bg-blue-50/50">Pro</th>
              <th className="text-center font-medium p-4">Enterprise</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {comparisonFeatures.map((row, index) => {
              const isCategory = !!row.category;
              if (isCategory) {
                return (
                  <tr key={`cat-${index}`} className="bg-gray-50/60">
                    <td colSpan={4} className="px-6 py-3 text-xs font-semibold tracking-widest text-gray-500 uppercase">
                      {row.category}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={index} className="hover:bg-gray-50/50">
                  <td className="p-4 pl-6 font-medium text-gray-800">{row.feature}</td>
                  <td className="p-4 text-center">
                    {typeof row.free === 'boolean' ? (row.free ? '✓' : '—') : row.free}
                  </td>
                  <td className="p-4 text-center bg-blue-50/30 font-medium">
                    {typeof row.pro === 'boolean' ? (row.pro ? '✓' : '—') : row.pro}
                  </td>
                  <td className="p-4 text-center">
                    {typeof row.enterprise === 'boolean' ? (row.enterprise ? '✓' : '—') : row.enterprise}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Demo Checkout Simulation Panel */}
      <div className="mt-8 card p-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold">Demo Stripe Simulation</div>
            <div className="text-xs text-gray-500">Actions here log to console and use existing env placeholders. No real API calls.</div>
          </div>
          {checkoutLog.length > 0 && (
            <button onClick={clearLog} className="text-xs px-3 py-1 border rounded-lg hover:bg-gray-50">Clear log</button>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-gray-400 mb-2">RECENT SIMULATED EVENTS</div>
            {checkoutLog.length === 0 ? (
              <div className="text-sm text-gray-500 italic">Click “Start Free” or “Subscribe (Demo)” above to simulate checkout.</div>
            ) : (
              <div className="space-y-1.5 text-sm font-mono bg-gray-950 text-emerald-400 p-4 rounded-xl text-xs leading-relaxed">
                {checkoutLog.map((log, i) => (
                  <div key={i}>{log}</div>
                ))}
              </div>
            )}
          </div>

          <div className="text-sm text-gray-600 space-y-2">
            <div className="font-medium text-gray-800">How it works in production:</div>
            <ul className="list-disc pl-5 space-y-1 text-xs">
              <li>Server action creates Stripe Checkout Session using <code>STRIPE_SECRET_KEY</code></li>
              <li>Client redirects with <code>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code></li>
              <li>Success/cancel URLs point back to <code>/pricing?success=true</code></li>
              <li>Webhooks update tenant plan in Supabase (schema ready)</li>
            </ul>
            <div className="pt-2 text-xs">
              Current env placeholder in use: <span className="font-mono text-gray-500">{process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || 'pk_test_... (from .env.example)'}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t flex flex-wrap gap-3 text-sm">
          <Link href="/setup" className="btn-primary px-6 py-2 rounded-xl inline-block">Go to Setup Guide</Link>
          <Link href="/ai-assistants" className="px-6 py-2 rounded-xl border inline-block">Try AI Assistants</Link>
          <Link href="/settings/branding" className="px-6 py-2 rounded-xl border inline-block">Configure White-Label</Link>
          <span className="ml-auto text-xs text-gray-400 self-center hidden lg:block">All tiers respect NEXT_PUBLIC_DEMO_MODE</span>
        </div>
      </div>

      <div className="text-center mt-12 text-xs text-gray-400">
        Questions? Email sales@yourdomain.com or use the AI Council for a custom plan recommendation.
      </div>
    </div>
  );
}
