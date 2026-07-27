'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  loadPortalMatches,
  requestShowing,
  markMatchSeen,
  type PortalMatch,
  type ShowingRequest,
  loadShowingRequests,
} from '@/lib/portal/matches';

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

const ACTIVITY = [
  { time: 'Today', text: 'New MLS matches pushed to your portal' },
  { time: 'Yesterday', text: 'You viewed 172 Kiana Dr details' },
  { time: '2 days ago', text: 'Showing request submitted for Lindy Lane' },
  { time: '3 days ago', text: 'Preference profile updated (ADA / single-level)' },
];

export default function ClientPortalPage() {
  const [voiceActive, setVoiceActive] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [pin, setPin] = useState('');
  const [unlocked, setUnlocked] = useState(false);
  const [matches, setMatches] = useState<PortalMatch[]>([]);
  const [showings, setShowings] = useState<ShowingRequest[]>([]);
  const [toast, setToast] = useState('');

  useEffect(() => {
    setMatches(loadPortalMatches());
    setShowings(loadShowingRequests());
  }, []);

  const startVoice = () => {
    setVoiceActive(true);
    setTranscript([
      'AI: Hi Jordan and Taylor — this is Voxli, your Archibald-Bagley assistant.',
      'AI: I see you prefer single-level homes around Rigby under $525k. Shall I walk you through your newest match?',
      'You: Yes, tell me about the layout and any contingencies.',
      'AI: Your top match is single level with wide halls. I can request a private showing or prep a draft offer for Kipp to review.',
    ]);
  };

  const stopVoice = () => setVoiceActive(false);

  const onSchedule = (m: PortalMatch) => {
    requestShowing(m, 'This weekend preferred');
    setShowings(loadShowingRequests());
    setMatches((prev) => prev.map((x) => (x.id === m.id ? { ...x, isNew: false } : x)));
    markMatchSeen(m.id);
    setToast(`Showing requested for ${m.address} — ${DEMO_CLIENT.agent} will confirm.`);
    setTimeout(() => setToast(''), 4000);
  };

  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-emerald-950 flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-xl border border-white/15 rounded-3xl p-10 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
            <span className="text-2xl font-bold text-white">SF</span>
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">Client Portal</h1>
          <p className="text-zinc-300 text-sm mb-8">Archibald-Bagley Real Estate · Secure access</p>
          <input
            type="password"
            placeholder="Enter access PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-zinc-400 mb-4 focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={() => setUnlocked(pin.length >= 4 || pin === 'demo')}
            className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-white font-medium rounded-xl transition"
          >
            Enter Portal
          </button>
          <p className="text-xs text-zinc-400 mt-4">Demo PIN: any 4+ characters or "demo"</p>
          <Link href="/" className="block mt-6 text-sm text-emerald-300 hover:underline">
            ← Back to agent dashboard
          </Link>
        </div>
      </div>
    );
  }

  const newCount = matches.filter((m) => m.isNew).length;

  return (
    <div className="min-h-screen bg-zinc-50">
      <header className="bg-white border-b border-zinc-200 px-4 sm:px-6 py-4 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-emerald-600 rounded-xl flex items-center justify-center">
            <span className="text-white font-bold text-sm">SF</span>
          </div>
          <div>
            <div className="font-semibold text-zinc-900">Your Home Search</div>
            <div className="text-xs text-zinc-500">with {DEMO_CLIENT.agent}</div>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {newCount > 0 && (
            <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {newCount} new match{newCount > 1 ? 'es' : ''}
            </span>
          )}
          <button
            onClick={voiceActive ? stopVoice : startVoice}
            className={`px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition flex items-center gap-2 ${
              voiceActive ? 'bg-rose-500 text-white' : 'bg-emerald-600 text-white hover:bg-emerald-500'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${voiceActive ? 'bg-white animate-pulse' : 'bg-white/80'}`} />
            <span className="hidden sm:inline">{voiceActive ? 'End Voice' : 'Talk to AI'}</span>
            <span className="sm:hidden">{voiceActive ? 'End' : 'AI'}</span>
          </button>
          <Link href="/" className="text-sm text-zinc-500 hover:text-zinc-800 hidden sm:inline">
            Agent view
          </Link>
        </div>
      </header>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl bg-zinc-900 text-white text-sm shadow-xl max-w-md text-center">
          {toast}
        </div>
      )}

      <div className="max-w-6xl mx-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 order-2 lg:order-1">
          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <h2 className="font-semibold text-zinc-900 mb-1">{DEMO_CLIENT.name}</h2>
            <p className="text-sm text-zinc-500 mb-4">{DEMO_CLIENT.email}</p>
            <div className="space-y-2 text-sm">
              <Row label="Budget" value={`Up to $${DEMO_CLIENT.preferences.maxPrice.toLocaleString()}`} />
              <Row label="Beds" value={`${DEMO_CLIENT.preferences.minBeds}+`} />
              <Row label="Areas" value={DEMO_CLIENT.preferences.areas.join(', ')} />
              <Row label="Style" value={DEMO_CLIENT.preferences.style} />
              <Row label="Timeline" value={DEMO_CLIENT.preferences.timeline} />
            </div>
          </div>

          <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
            <h3 className="font-semibold text-zinc-900 mb-3">Recent Activity</h3>
            <ul className="space-y-3">
              {ACTIVITY.map((a, i) => (
                <li key={i} className="text-sm">
                  <div className="text-xs text-zinc-400">{a.time}</div>
                  <div className="text-zinc-700">{a.text}</div>
                </li>
              ))}
            </ul>
          </div>

          {showings.length > 0 && (
            <div className="bg-white border border-zinc-200 rounded-3xl p-6 shadow-sm">
              <h3 className="font-semibold text-zinc-900 mb-3">Showing requests</h3>
              <ul className="space-y-2 text-sm">
                {showings.slice(0, 5).map((s) => (
                  <li key={s.id} className="flex justify-between gap-2">
                    <span className="text-zinc-700 truncate">{s.address}</span>
                    <span className="text-xs text-amber-600 shrink-0 capitalize">{s.status}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-4 order-1 lg:order-2">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-zinc-900">Homes matched for you</h2>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
              Live from MLS alerts
            </span>
          </div>

          {matches.length === 0 && (
            <div className="bg-white border border-dashed border-zinc-200 rounded-3xl p-10 text-center text-zinc-400">
              No matches yet — your agent will push listings that fit your search.
            </div>
          )}

          {matches.map((home) => (
            <div
              key={home.id}
              className={`bg-white border rounded-3xl p-5 shadow-sm hover:shadow-md transition flex flex-col sm:flex-row sm:items-center gap-4 ${
                home.isNew ? 'border-emerald-300 ring-1 ring-emerald-100' : 'border-zinc-200'
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  {home.isNew && (
                    <span className="text-[10px] uppercase tracking-wide font-semibold px-2 py-0.5 rounded-full bg-emerald-500 text-white">
                      New match
                    </span>
                  )}
                  <h3 className="font-semibold text-zinc-900 truncate">{home.address}</h3>
                  {home.status && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600">{home.status}</span>
                  )}
                </div>
                <div className="text-sm text-zinc-500">
                  {home.sqft && home.sqft > 0 ? (
                    <>${home.price.toLocaleString()} · {home.beds} bd · {home.baths} ba · {home.sqft.toLocaleString()} sqft</>
                  ) : home.acres ? (
                    <>${home.price.toLocaleString()} · {home.acres} acres</>
                  ) : (
                    <>${home.price.toLocaleString()}</>
                  )}
                </div>
                {home.alertName && (
                  <div className="text-[11px] text-zinc-400 mt-1">From alert: {home.alertName}</div>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">{home.matchScore}%</div>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wide">Match</div>
                </div>
                <button
                  type="button"
                  onClick={() => onSchedule(home)}
                  className="px-4 py-2.5 bg-zinc-900 text-white text-sm font-medium rounded-xl hover:bg-zinc-800 transition"
                >
                  Schedule showing
                </button>
              </div>
            </div>
          ))}

          {(voiceActive || transcript.length > 0) && (
            <div className="bg-zinc-900 text-zinc-100 rounded-3xl p-6 shadow-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Voice Assistant
                </h3>
                {voiceActive && <span className="text-xs text-emerald-300">Listening / speaking…</span>}
              </div>
              <div className="space-y-2 max-h-64 overflow-y-auto text-sm">
                {transcript.map((line, i) => (
                  <p key={i} className={line.startsWith('You:') ? 'text-emerald-300' : 'text-zinc-200'}>
                    {line}
                  </p>
                ))}
              </div>
              <p className="text-xs text-zinc-500 mt-4">
                Powered by Grok TTS · Your agent reviews every action before it is sent
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-zinc-500 shrink-0">{label}</span>
      <span className="font-medium text-zinc-900 text-right">{value}</span>
    </div>
  );
}
