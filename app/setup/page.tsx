'use client';

import { useState } from 'react';
import Link from 'next/link';
import { isDemoMode } from '@/lib/env';

export default function SetupGuide() {
  const [step, setStep] = useState(1);
  const [completed, setCompleted] = useState(false);

  const steps = [
    { num: 1, title: 'Welcome to SummitForge', desc: 'Your complete RE OS for Jefferson County raw land & development.' },
    { num: 2, title: 'Connect Your Brand', desc: 'Go to Branding settings. Pick colors and name. Instantly white-label ready.' },
    { num: 3, title: 'Try the AI Assistants', desc: 'Use Valuation, Marketing, Council, Lead Qualifier, and Transaction agents. All trained on local data.' },
    { num: 4, title: 'Explore Core Tools', desc: 'GIS Monitoring, Import, Analytics, Marketing execution, Client Portal.' },
    { num: 5, title: 'Ready for Production', desc: 'Add your real OPENAI_API_KEY + Mapbox token. Enable Stripe later for monetization.' },
  ];

  const markComplete = () => {
    localStorage.setItem('summitforge_setup_complete', 'true');
    setCompleted(true);
    // Also flag demo fully on
    localStorage.setItem('summitforge_demo', 'on');
  };

  return (
    <div className="max-w-3xl mx-auto p-8">
      <div className="mb-6">
        <Link href="/" className="text-sm text-gray-500 hover:underline">← Back to Dashboard</Link>
        <h1 className="text-4xl font-bold tracking-tighter mt-2">Welcome to SummitForge RE OS</h1>
        <p className="text-gray-600 mt-1">5-minute guided first-run. Built for agents, teams, and brokerages who focus on raw land and development in Eastern Idaho.</p>
      </div>

      {!completed ? (
        <>
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-3 text-sm font-medium">
              {steps.map((s, idx) => (
                <div key={idx} className={`px-3 py-1 rounded-full border ${step === s.num ? 'bg-black text-white border-black' : 'bg-white'}`}>
                  {s.num}
                </div>
              ))}
            </div>

            <div className="card p-8">
              <div className="text-sm text-blue-600 font-semibold">STEP {step} / {steps.length}</div>
              <h2 className="text-2xl font-semibold mt-1">{steps[step-1].title}</h2>
              <p className="mt-3 text-gray-600">{steps[step-1].desc}</p>

              {step === 1 && (
                <div className="mt-6 text-sm bg-blue-50 p-4 rounded-xl">
                  This platform is already production-oriented: real LLM agents, GIS, pro formas, marketing execution, client portals, and full white-label capability.
                </div>
              )}

              {step === 2 && (
                <div className="mt-6">
                  <Link href="/settings/branding" className="btn-primary inline-block px-6 py-3 rounded-2xl font-semibold">Open Branding Settings →</Link>
                  <p className="mt-2 text-xs text-gray-500">Changes apply live via CSS variables. Perfect for reseller / client-specific portals.</p>
                </div>
              )}

              {step === 3 && (
                <div className="mt-6">
                  <Link href="/ai-assistants" className="btn-primary inline-block px-6 py-3 rounded-2xl font-semibold">Launch AI Assistants →</Link>
                  <div className="text-xs mt-3">All agents use trained prompts specific to Jefferson County land transactions and development.</div>
                </div>
              )}

              {step === 4 && (
                <div className="mt-6 grid grid-cols-2 gap-3 text-sm">
                  <Link href="/monitoring" className="p-3 border rounded-xl hover:bg-gray-50">GIS Monitoring</Link>
                  <Link href="/marketing" className="p-3 border rounded-xl hover:bg-gray-50">Marketing Agent</Link>
                  <Link href="/analytics" className="p-3 border rounded-xl hover:bg-gray-50">Analytics</Link>
                  <Link href="/portal" className="p-3 border rounded-xl hover:bg-gray-50">Client Portal</Link>
                </div>
              )}

              {step === 5 && (
                <div className="mt-6 text-sm">
                  Add keys in <code>.env</code> or Vercel. Then set <code>NEXT_PUBLIC_DEMO_MODE=false</code> (or omit) for production (branding lock + hidden demo features). Current: {isDemoMode() ? 'DEMO' : 'PROD'}.
                  <div className="mt-4">
                    <a href="https://vercel.com" target="_blank" className="underline">Deploy on Vercel →</a>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            {step > 1 && <button onClick={() => setStep(step - 1)} className="px-5 py-2 rounded-xl border">Previous</button>}
            {step < steps.length ? (
              <button onClick={() => setStep(step + 1)} className="btn-primary px-6 py-2 rounded-xl font-semibold">Next step</button>
            ) : (
              <button onClick={markComplete} className="btn-primary px-6 py-2 rounded-xl font-semibold">Mark Setup Complete — Enter App</button>
            )}
            <Link href="/" className="px-5 py-2 rounded-xl border ml-auto">Skip for now</Link>
          </div>
        </>
      ) : (
        <div className="card p-10 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-semibold">Setup complete. Welcome aboard.</h2>
          <p className="mt-2 text-gray-600">You can return here anytime from the header. Your branding and preferences are saved locally in this preview.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/" className="btn-primary px-8 py-3 rounded-2xl">Go to Dashboard</Link>
            <Link href="/ai-assistants" className="px-8 py-3 rounded-2xl border">Talk to the AI Team</Link>
          </div>
        </div>
      )}

      <div className="text-[10px] text-center text-gray-400 mt-10">This flow is the foundation for tenant onboarding in the full multi-tenant white-label version.</div>
    </div>
  );
}
