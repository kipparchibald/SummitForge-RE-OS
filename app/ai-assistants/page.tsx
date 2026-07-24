'use client';

import { useEffect, useRef, useState } from 'react';

interface Assistant {
  id: string;
  name: string;
  description: string;
  icon: string;
  route: string;
  placeholder: string;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const assistants: Assistant[] = [
  {
    id: 'valuation',
    name: 'Valuation Agent',
    description: 'AVM and CMA for raw land & development.',
    icon: '📊',
    route: '/api/ai/valuation',
    placeholder: 'e.g. Value this 12 acre parcel near Rigby listed at $650k',
  },
  {
    id: 'marketing',
    name: 'Marketing Agent',
    description: 'Plans, content, and campaign execution.',
    icon: '📣',
    route: '/api/ai/marketing',
    placeholder: 'e.g. Draft a land marketing plan for builders and investors',
  },
  {
    id: 'council',
    name: 'Council (Orchestrator)',
    description: 'Multi-agent wisdom for complex decisions.',
    icon: '🧠',
    route: '/api/ai/council',
    placeholder: 'e.g. Should I buy 40 acres near Terreton for subdivision?',
  },
  {
    id: 'transaction',
    name: 'Transaction Coordinator',
    description: 'Idaho checklists, timelines, next steps.',
    icon: '📋',
    route: '/api/ai/transaction',
    placeholder: 'e.g. What are the next deadlines on an under-contract land deal?',
  },
  {
    id: 'lead',
    name: 'Lead Qualifier',
    description: 'Empathetic qualification and follow-ups.',
    icon: '🤝',
    route: '/api/ai/lead',
    placeholder: 'e.g. Buyer wants 5–10 acres near Rigby under $400k',
  },
];

function buildBody(active: string, userInput: string): Record<string, unknown> {
  if (active === 'valuation') {
    return {
      property: {
        address: userInput || 'Demo Parcel near Rigby, ID',
        acres: 8.5,
        price: 620000,
      },
      profile: { focusAreas: ['raw land'], notes: userInput },
      request: userInput,
    };
  }
  if (active === 'marketing') {
    return {
      property: {
        id: 'demo',
        address: 'Sample Land, Rigby ID',
        acres: 8.5,
        price: 650000,
      },
      request: userInput,
      focusAreas: ['maximize exposure', 'attract builders/investors'],
    };
  }
  if (active === 'lead') {
    return {
      leadInfo: { name: 'Alex Buyer', interest: userInput, market: 'Jefferson County' },
      request: userInput,
    };
  }
  if (active === 'transaction') {
    return {
      action: 'status',
      data: { dealId: 'demo-deal', status: 'under_contract', notes: userInput },
      request: userInput,
    };
  }
  return { request: userInput, context: { assistant: active, market: 'Eastern Idaho' } };
}

function normalizeReply(data: Record<string, unknown>): string {
  if (typeof data.message === 'string' && data.message.trim()) return data.message;
  if (typeof data.aiInsights === 'string' && data.aiInsights.trim()) return data.aiInsights;
  if (typeof data.insights === 'string' && data.insights.trim()) return data.insights;
  if (typeof data.aiStrategy === 'string' && data.aiStrategy.trim()) return data.aiStrategy;
  if (data.status) {
    return `Status: ${data.status}. ${typeof data.note === 'string' ? data.note : ''}`;
  }
  if (typeof data.estimatedValue === 'number') {
    const parts = [
      `Estimated value: $${data.estimatedValue.toLocaleString()}`,
      typeof data.perAcre === 'number' ? `Per acre: $${Math.round(data.perAcre).toLocaleString()}` : null,
      typeof data.suggestedListPrice === 'number'
        ? `Suggested list: $${data.suggestedListPrice.toLocaleString()}`
        : null,
      typeof data.aiInsights === 'string' ? data.aiInsights : null,
    ].filter(Boolean);
    return parts.join('\n');
  }
  return 'Thank you. Analysis complete using trained Jefferson County models.';
}

export default function AIAssistants() {
  const [active, setActive] = useState('council');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        'Hello. I am your real estate AI assistant, trained on Jefferson County data and best practices. How can I help you today?',
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [voiceActive, setVoiceActive] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const current = assistants.find((a) => a.id === active)!;

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const sendToAgent = async (userInput: string) => {
    setLoading(true);
    try {
      const res = await fetch(current.route, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBody(active, userInput)),
      });
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      if (!res.ok) {
        const errMsg =
          (typeof data.error === 'string' && data.error) ||
          (typeof data.message === 'string' && data.message) ||
          `Agent error (${res.status})`;
        setMessages((m) => [...m, { role: 'assistant', content: errMsg }]);
        return;
      }
      setMessages((m) => [...m, { role: 'assistant', content: normalizeReply(data) }]);
    } catch {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          content:
            'Agent temporarily unavailable in this preview. Connect OPENAI_API_KEY for full intelligence.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const currentInput = input.trim();
    setMessages((m) => [...m, { role: 'user', content: currentInput }]);
    setInput('');
    await sendToAgent(currentInput);
  };

  const toggleVoice = () => {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => any; webkitSpeechRecognition?: new () => any })
        .SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => any }).webkitSpeechRecognition;
    if (!SpeechRec) {
      alert('Voice input not supported in this browser. Try Chrome or Edge.');
      return;
    }
    const rec = new SpeechRec();
    rec.continuous = false;
    rec.interimResults = false;
    rec.lang = 'en-US';

    rec.onresult = (event: { results: { [i: number]: { [j: number]: { transcript: string } } } }) => {
      const transcript = event.results[0][0].transcript;
      setInput(transcript);
      setVoiceActive(false);
      setTimeout(() => {
        setMessages((m) => [...m, { role: 'user', content: transcript }]);
        sendToAgent(transcript);
      }, 120);
    };
    rec.onerror = () => setVoiceActive(false);
    rec.onend = () => setVoiceActive(false);

    setVoiceActive(true);
    rec.start();
  };

  const switchAssistant = (id: string) => {
    setActive(id);
    setMessages([
      {
        role: 'assistant',
        content: `Switched to ${assistants.find((a) => a.id === id)?.name}. Ask me anything about your Jefferson County deals.`,
      },
    ]);
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI Real Estate Assistants</h1>
          <p className="text-gray-600 mt-1">
            Trained on local Jefferson County + Eastern Idaho data. Production-ready agents for
            clients and internal teams.
          </p>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          Add <code className="bg-gray-100 px-1 rounded">OPENAI_API_KEY</code> for full power
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <div className="bg-white border rounded-2xl p-4">
            <div className="font-semibold mb-3 text-xs uppercase tracking-[1px] text-gray-500">
              Select agent
            </div>
            {assistants.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => switchAssistant(a.id)}
                className={`w-full text-left p-3 rounded-xl mb-1.5 flex gap-3 items-start transition ${
                  active === a.id
                    ? 'bg-blue-50 border border-blue-200'
                    : 'hover:bg-gray-50 border border-transparent'
                }`}
              >
                <span className="text-2xl mt-0.5" aria-hidden>
                  {a.icon}
                </span>
                <div className="text-left">
                  <div className="font-medium">{a.name}</div>
                  <div className="text-xs text-gray-500 leading-tight">{a.description}</div>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-4 p-3 text-xs bg-white border rounded-2xl text-gray-600">
            <div className="font-medium mb-1 text-gray-800">Deploy note</div>
            Agents use engineered system prompts + local market data. Gate usage and credits for
            SaaS multi-tenant rollouts.
          </div>
        </div>

        <div className="lg:col-span-3 bg-white border rounded-2xl flex flex-col h-[min(560px,70vh)] shadow-sm">
          <div className="p-4 border-b flex items-center gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-2xl" aria-hidden>
                {current.icon}
              </span>
              <div className="min-w-0">
                <div className="font-semibold truncate">{current.name}</div>
                <div className="text-[10px] text-green-600 font-medium tracking-wide">
                  ● TRAINED ON JEFFERSON COUNTY DATA
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={toggleVoice}
              className={`ml-auto px-3 py-1 text-xs rounded-lg border flex items-center gap-1 shrink-0 ${
                voiceActive ? 'bg-red-100 text-red-700 border-red-200' : 'hover:bg-gray-50'
              }`}
            >
              {voiceActive ? '● Listening…' : '🎤 Voice'}
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-auto p-6 space-y-4 text-sm bg-gray-50/50">
            {messages.map((m, i) => (
              <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
                <div
                  className={
                    m.role === 'user' ? 'chat-bubble-user whitespace-pre-wrap' : 'chat-bubble-assistant whitespace-pre-wrap'
                  }
                >
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="text-gray-400 flex items-center gap-2">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Thinking with local market models…
              </div>
            )}
          </div>

          <div className="p-4 border-t flex gap-2 bg-white rounded-b-2xl">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && !loading && send()}
              placeholder={current.placeholder}
              className="flex-1 border rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              disabled={loading}
              aria-label="Message"
            />
            <button
              type="button"
              onClick={send}
              disabled={loading || !input.trim()}
              className="px-7 rounded-2xl bg-black text-white text-sm font-medium disabled:opacity-50 hover:bg-gray-900 transition"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
