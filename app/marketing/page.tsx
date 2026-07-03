'use client';

import { useState } from 'react';
import { marketingAgent } from '../../lib/marketing/agent';

export default function MarketingAgentDashboard() {
  const [propertyData, setPropertyData] = useState({
    id: 'prop-123',
    address: 'Sample Land near Teton Heights',
    acres: 8.5,
    price: 650000
  });
  const [plan, setPlan] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateMarketingPlan = async () => {
    setIsLoading(true);
    try {
      const generatedPlan = await marketingAgent.generatePlan(propertyData);
      setPlan(generatedPlan);
    } catch (error) {
      console.error(error);
      alert('Error generating plan');
    }
    setIsLoading(false);
  };

  const executePlan = async () => {
    if (!plan) return;
    const result = await marketingAgent.executePlan(plan);
    alert(`Marketing execution started: ${result.status}`);
  };

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-4xl font-bold mb-2">Marketing Agent</h1>
      <p className="text-gray-600 mb-8">AI-powered comprehensive marketing plans and execution for your listings and developments.</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Input */}
        <div>
          <h2 className="text-2xl mb-4">Property Details</h2>
          <div className="space-y-4 bg-white p-6 rounded-lg border">
            <input 
              type="text" 
              value={propertyData.address} 
              onChange={(e) => setPropertyData({...propertyData, address: e.target.value})}
              className="w-full border p-2 rounded"
              placeholder="Property Address"
            />
            <div className="grid grid-cols-2 gap-4">
              <input 
                type="number" 
                value={propertyData.acres} 
                onChange={(e) => setPropertyData({...propertyData, acres: parseFloat(e.target.value)})}
                className="border p-2 rounded"
                placeholder="Acres"
              />
              <input 
                type="number" 
                value={propertyData.price} 
                onChange={(e) => setPropertyData({...propertyData, price: parseFloat(e.target.value)})}
                className="border p-2 rounded"
                placeholder="Price"
              />
            </div>
            <button 
              onClick={generateMarketingPlan}
              disabled={isLoading}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isLoading ? 'Generating Plan...' : 'Generate Comprehensive Marketing Plan'}
            </button>
          </div>
        </div>

        {/* Results */}
        <div>
          {plan && (
            <div>
              <h2 className="text-2xl mb-4">Generated Marketing Plan</h2>
              <div className="bg-white p-6 rounded-lg border space-y-6">
                <div>
                  <h3 className="font-semibold mb-2">Recommended Channels</h3>
                  <ul className="space-y-1 text-sm">
                    {plan.channels.map((ch: any, i: number) => (
                      <li key={i} className="flex justify-between">
                        <span>{ch.name}</span> 
                        <span className="text-gray-500">${ch.estimatedCost} • {ch.expectedReach}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="font-semibold mb-2">Content Strategy</h3>
                  <div className="text-sm space-y-2">
                    <p><strong>Listing Description:</strong> {plan.contentStrategy.listingDescription}</p>
                    <p><strong>Social Posts:</strong> {plan.contentStrategy.socialPosts.length} ready-to-use posts</p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={executePlan}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700"
                  >
                    Execute Marketing Plan
                  </button>
                  <button 
                    onClick={() => setPlan(null)}
                    className="flex-1 border py-3 rounded-lg"
                  >
                    Generate New Plan
                  </button>
                </div>

                <div className="text-xs text-gray-500">
                  Budget Estimate: ${plan.budgetEstimate} • Timeline: 2 weeks launch + ongoing
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}