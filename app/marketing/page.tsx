'use client';

import { useState } from 'react';

export default function MarketingAgentDashboard() {
  const [propertyData, setPropertyData] = useState({
    id: 'prop-123',
    address: 'Sample Land near Teton Heights',
    acres: 8.5,
    price: 650000
  });
  const [plan, setPlan] = useState<any>(null);
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateMarketingPlan = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/ai/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ property: propertyData })
      });
      const generatedPlan = await res.json();
      setPlan(generatedPlan);
    } catch (error) {
      console.error(error);
      alert('Error generating plan. Ensure OPENAI_API_KEY is set.');
    }
    setIsLoading(false);
  };

  const executePlan = async () => {
    if (!plan) return;
    const res = await fetch('/api/ai/marketing/execute', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan })
    });
    const result = await res.json();
    setExecutionResult(result);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <div className="page-header">
        <h1>Marketing Agent</h1>
        <p>World-class AI plans + execution. Storytelling for raw land and development in Jefferson County.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Input Panel */}
        <div className="lg:col-span-2">
          <div className="card p-6">
            <div className="uppercase text-xs tracking-widest text-gray-500 mb-2">Property</div>
            <input 
              type="text" value={propertyData.address} 
              onChange={(e) => setPropertyData({...propertyData, address: e.target.value})}
              className="w-full border p-3 rounded-lg mb-3" 
            />
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <div className="text-xs mb-1">Acres</div>
                <input type="number" value={propertyData.acres} onChange={(e) => setPropertyData({...propertyData, acres: parseFloat(e.target.value)})} className="border p-3 w-full rounded-lg" />
              </div>
              <div>
                <div className="text-xs mb-1">Asking Price</div>
                <input type="number" value={propertyData.price} onChange={(e) => setPropertyData({...propertyData, price: parseFloat(e.target.value)})} className="border p-3 w-full rounded-lg" />
              </div>
            </div>
            <button onClick={generateMarketingPlan} disabled={isLoading} className="btn-primary w-full py-3 rounded-2xl font-semibold">
              {isLoading ? 'Generating with trained models...' : 'Generate Full Marketing Plan'}
            </button>
          </div>
        </div>

        {/* Plan + Execution */}
        <div className="lg:col-span-3">
          {!plan && <div className="text-gray-400 text-sm">Generate a plan to see channels, storytelling content, timeline, and execution options.</div>}

          {plan && !plan.error && (
            <div className="card p-6 space-y-5">
              <div>
                <div className="font-semibold">Recommended Channels</div>
                <ul className="mt-2 space-y-1 text-sm">
                  {plan.channels?.map((ch: any, i: number) => <li key={i} className="flex justify-between border-b py-1 last:border-none"><span>{ch.name}</span><span className="text-gray-500">${ch.estimatedCost} • {ch.expectedReach}</span></li>)}
                </ul>
              </div>

              {plan.contentStrategy && (
                <div>
                  <div className="font-semibold mb-1">Content Strategy</div>
                  <div className="text-sm bg-gray-50 p-3 rounded">{plan.contentStrategy.listingDescription}</div>
                  <div className="text-xs mt-2">Social posts: {plan.contentStrategy.socialPosts?.length || 0} • Emails: {plan.contentStrategy.emailSequence?.length || 0}</div>
                </div>
              )}

              <div className="flex gap-3">
                <button onClick={executePlan} className="flex-1 bg-emerald-600 text-white py-3 rounded-2xl font-semibold">Execute Plan</button>
                <button onClick={() => { setPlan(null); setExecutionResult(null); }} className="flex-1 border py-3 rounded-2xl">New Plan</button>
              </div>

              <div className="text-xs text-gray-500">Budget: ${plan.budgetEstimate} • Ready for real social/email in production</div>

              {executionResult && (
                <div className="p-4 bg-emerald-50 rounded-xl text-sm">
                  ✅ Execution: {executionResult.status}. {executionResult.note}
                  <div className="text-[10px] mt-1 text-emerald-700">In prod: posts to Meta, sends email sequences, logs ROI.</div>
                </div>
              )}
            </div>
          )}

          {plan?.error && <div className="p-4 bg-amber-50 border border-amber-200 rounded">{plan.message}</div>}
        </div>
      </div>
    </div>
  );
}