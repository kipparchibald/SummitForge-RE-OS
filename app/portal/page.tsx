'use client';

import React, { useState } from 'react';
import Link from 'next/link';

// Client Portal — personalized dashboard + voice AI interface
// White-label ready for Archibald-Bagley or any brokerage tenant

const DEMO_CLIENT = {
  name: 'Jordan & Taylor Mitchell',
  email: 'mitchell.family@example.com',
  phone: '(208) 555-0142',
  agent: 'Kipp Archibald',
  preferences: {
    maxPrice: 525000,
    minBeds: 3,
    areas: ['Rigby', 'Ririe'],
    style: 'Single-level / ADA-friendly preferred',
    timeline: '30–60 days',
  },
};

const SAVED_HOMES = [
  {
    id: '1',
    address: '789 Lindy Lane, Rigby',
    price: 489000,
    beds: 3,
    baths: 2,
    sqft: 1680,
    status: 'Pending Contingent',
    match: 94,
  },
  {
    id: '2',
    address: '172 Kiana Dr, Rigby',
    price: 512000,
    beds: 4,
    baths: 2.5,
    sqft: 1850,
    status: 'Coming Soon',
    match: 91,
  },
  {
    id: '3',
    address: 'Teton Heights Lot 14',
    price: 99500,
    beds: 0,
    baths: 0,
    sqft: 0,
    status: 'Active Land',
    match: 88,
  },
];

const ACTIVITY = [
  { time: 'Today 10:14 AM', text: 'Agent sent you comps for 789 Lindy Lane' },
  { time: 'Yesterday', text: 'You viewed 172 Kiana Dr details' },
  { time: '2 days ago', text: 'Showing request submitted for Lindy Lane' },
  { time: '3 days ago', text: 'Preference profile updated (ADA / single-level)' },
];

export default function ClientPortalPage() {
  const [voiceActive, setVoiceActive] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);

  const startVoice = () => {
    setVoiceActive(true);
    setTranscript([
      'AI: Hi Jordan and Taylor — this is Summit Forge, your Archibald-Bagley assistant.',
      'AI: I see you prefer single-level homes around Rigby under $525k. Shall I walk you through 789 Lindy Lane?',
      'You: Yes, tell me about the layout and any contingencies.',
      'AI: 789 Lindy Lane is 3 bed / 2 bath, 1,680 sq ft, single level with wide halls. Current offer is contingent on financing — deadline in 6 days. I can request a private showing or prep a draft offer for Kipp to review.',
    ]);
  };

  const stopVoice = () => {
    setVoiceActive(false);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-2xl font-bold text-slate-900">SF</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Client Portal</h1>
          <p className="text-slate-300 text-sm mb-8">
            Archibald-Bagley Real Estate · Secure access
          </p>
          <input
            type="password"
            placeholder="Enter access PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-slate-400 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={() => setUnlocked(pin.length >= 4 || pin === 'demo')}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition"
          >
            Enter Portal
          </button>
          <p className="text-xs text-slate-400 mt-4">Demo PIN: any 4+ characters or &quot;demo&quot;</p>
          <Link href="/" className="block mt-6 text-sm text-emerald-300 hover:underline">
            ← Back to agent dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--sf-bg,#f8fafc)]">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-black rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">SF</span>
          </div>
          <div>
            <div className="font-semibold text-gray-900">Your Home Search</div>
            <div className="text-xs text-gray-500">with {DEMO_CLIENT.agent}</div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={voiceActive ? stopVoice : startVoice}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              voiceActive
                ? 'bg-rose-500 text-white'
                : 'bg-emerald-500 text-white hover:bg-emerald-600'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${voiceActive ? 'bg-white animate-pulse' : 'bg-white/80'}`} />
            {voiceActive ? 'End Voice' : 'Talk to AI Assistant'}
          </button>
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-800">
            Agent view
          </Link>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-1">{DEMO_CLIENT.name}</h2>
            <p className="text-sm text-gray-500 mb-4">{DEMO_CLIENT.email}</p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Budget</span>
                <span className="font-medium">Up to ${DEMO_CLIENT.preferences.maxPrice.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Beds</span>
                <span className="font-medium">{DEMO_CLIENT.preferences.minBeds}+</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Areas</span>
                <span className="font-medium">{DEMO_CLIENT.preferences.areas.join(', ')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Style</span>
                <span className="font-medium text-right max-w-[60%]">{DEMO_CLIENT.preferences.style}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Timeline</span>
                <span className="font-medium">{DEMO_CLIENT.preferences.timeline}</span>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-semibold text-gray-900 mb-3">Recent Activity</h3>
            <ul className="space-y-3">
              {ACTIVITY.map((a, i) => (
                <li key={i} className="text-sm">
                  <div className="text-xs text-gray-400">{a.time}</div>
                  <div className="text-gray-700">{a.text}</div>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Homes matched for you</h2>
            <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
              Updated live from MLS
            </span>
          </div>

          {SAVED_HOMES.map((home) => (
            <div
              key={home.id}
              className="bg-white border border-gray-200 rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center gap-4"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900">{home.address}</h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                    {home.status}
                  </span>
                </div>
                <div className="text-sm text-gray-500">
                  {home.sqft > 0 ? (
                    <>
                      ${home.price.toLocaleString()} · {home.beds} bd · {home.baths} ba ·{' '}
                      {home.sqft.toLocaleString()} sqft
                    </>
                  ) : (
                    <>${home.price.toLocaleString()} · Land / lot</>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{home.match}%</div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wide">Match</div>
                </div>
                <button className="px-4 py-2 bg-black text-white text-sm rounded-xl hover:bg-gray-800">
                  Request showing
                </button>
              </div>
            </div>
          ))}

          {(voiceActive || transcript.length > 0) && (
            <div className="bg-slate-900 text-slate-100 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Voice Assistant
                </h3>
                {voiceActive && (
                  <span className="text-xs text-emerald-300">Listening / speaking…</span>
                )}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
                {transcript.map((line, i) => (
                  <p
                    key={i}
                    className={
                      line.startsWith('You:')
                        ? 'text-emerald-300'
                        : 'text-slate-200'
                    }
                  >
                    {line}
                  </p>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                Powered by Grok TTS · Your agent reviews every action before it is sent
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
