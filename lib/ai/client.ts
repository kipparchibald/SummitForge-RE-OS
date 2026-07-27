import OpenAI from 'openai';

export type AiProvider = 'xai' | 'openai' | 'demo';

let openaiClient: OpenAI | null = null;
let xaiClient: OpenAI | null = null;

function hasRealKey(v: string | undefined): boolean {
  if (!v) return false;
  const t = v.trim();
  if (!t) return false;
  if (/your[_-]?|xxx|placeholder|sk-your/i.test(t)) return false;
  return t.length >= 20;
}

/** Prefer Grok (xAI) when available; else OpenAI; else demo. */
export function resolveAiProvider(): AiProvider {
  if (hasRealKey(process.env.XAI_API_KEY) || hasRealKey(process.env.GROK_API_KEY)) return 'xai';
  if (hasRealKey(process.env.OPENAI_API_KEY)) return 'openai';
  return 'demo';
}

export function isAiLive(): boolean {
  return resolveAiProvider() !== 'demo';
}

function getOpenAI() {
  if (!openaiClient && hasRealKey(process.env.OPENAI_API_KEY)) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

function getXai() {
  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY;
  if (!xaiClient && hasRealKey(key)) {
    xaiClient = new OpenAI({
      apiKey: key,
      baseURL: 'https://api.x.ai/v1',
    });
  }
  return xaiClient;
}

function defaultModel(provider: AiProvider, override?: string): string {
  if (override) return override;
  if (provider === 'xai') {
    return process.env.XAI_MODEL || process.env.GROK_MODEL || 'grok-3-mini';
  }
  if (provider === 'openai') {
    return process.env.OPENAI_MODEL || 'gpt-4o-mini';
  }
  return 'demo';
}

/**
 * Real LLM call via xAI (Grok) or OpenAI. Falls back to demo text only when no key.
 */
export async function callLLM(
  systemPrompt: string,
  userPrompt: string,
  model?: string
): Promise<string> {
  const provider = resolveAiProvider();

  if (provider === 'demo') {
    return (
      `Demo response (no XAI_API_KEY / OPENAI_API_KEY): ${userPrompt.slice(0, 100)}… ` +
      `[Simulated expert real estate advice based on Eastern Idaho data]`
    );
  }

  const client = provider === 'xai' ? getXai() : getOpenAI();
  if (!client) {
    return `Demo response: ${userPrompt.slice(0, 80)}…`;
  }

  const useModel = defaultModel(provider, model);

  try {
    const completion = await client.chat.completions.create({
      model: useModel,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 900,
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (text) return text;

    // Empty — try OpenAI fallback if we were on xAI
    if (provider === 'xai' && hasRealKey(process.env.OPENAI_API_KEY)) {
      return callLLMOpenAIOnly(systemPrompt, userPrompt, process.env.OPENAI_MODEL || 'gpt-4o-mini');
    }
    return 'No response generated.';
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[ai/client] ${provider}/${useModel} failed:`, msg);

    // Cross-fallback OpenAI ↔ xAI
    if (provider === 'xai' && hasRealKey(process.env.OPENAI_API_KEY)) {
      try {
        return await callLLMOpenAIOnly(
          systemPrompt,
          userPrompt,
          process.env.OPENAI_MODEL || 'gpt-4o-mini'
        );
      } catch (e2: unknown) {
        console.error('[ai/client] OpenAI fallback failed:', e2);
      }
    }
    if (provider === 'openai' && (hasRealKey(process.env.XAI_API_KEY) || hasRealKey(process.env.GROK_API_KEY))) {
      try {
        const x = getXai();
        if (x) {
          const completion = await x.chat.completions.create({
            model: defaultModel('xai'),
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            max_tokens: 900,
          });
          return completion.choices[0]?.message?.content?.trim() || 'No response generated.';
        }
      } catch (e2: unknown) {
        console.error('[ai/client] xAI fallback failed:', e2);
      }
    }

    return `AI temporarily unavailable (${provider}): ${msg.slice(0, 160)}`;
  }
}

async function callLLMOpenAIOnly(
  systemPrompt: string,
  userPrompt: string,
  model: string
): Promise<string> {
  const client = getOpenAI();
  if (!client) throw new Error('OpenAI client missing');
  const completion = await client.chat.completions.create({
    model,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 900,
  });
  return completion.choices[0]?.message?.content?.trim() || 'No response generated.';
}

/** Status for health / UI badges — never includes secrets. */
export function aiStatus() {
  const provider = resolveAiProvider();
  return {
    live: provider !== 'demo',
    provider,
    model: defaultModel(provider),
    hasXai: hasRealKey(process.env.XAI_API_KEY) || hasRealKey(process.env.GROK_API_KEY),
    hasOpenAI: hasRealKey(process.env.OPENAI_API_KEY),
  };
}

// Trained system prompts for world-class real estate assistants
export const SYSTEM_PROMPTS = {
  valuation: `You are a world-class real estate valuation expert specializing in raw land and development across Eastern Idaho — Jefferson, Madison, Bonneville, Bingham, Bannock, Fremont, and Teton counties. Tailor comps and market factors to the parcel's actual county; these markets differ sharply (e.g. Teton Valley resort pricing vs. Bingham ag ground). 
Use data-driven insights from local comps, market trends, and development potential. 
Provide clear, actionable valuations with confidence scores. 
Be professional, empathetic, and focused on helping clients make dignified, informed decisions about land that can become home.
Always reference specific local factors like zoning, water rights, septic feasibility, and buildability.`,

  marketing: `You are an expert real estate marketing strategist and autonomous campaign architect for Eastern Idaho (Jefferson, Madison, Bonneville, Bingham, Bannock, Fremont, Teton counties) specializing in raw land, development, and homes.

Best practices you always follow:
1) Goal → audience → message pillars → channel mix → creative → calendar → KPIs
2) Fair Housing / truth-in-advertising: never discriminate by protected class; avoid coded "family-only" language; include EHO awareness
3) Land campaigns dual-track builders (yield/plat) and end buyers (legacy/home)
4) Budget by priority, not equal vanity split; owned channels (MLS/IDX) first
5) Human approval before any paid deploy — recommend review gates
6) Measurable KPIs (CPL, qualified leads, showings, builder conversations)

Create compelling, authentic plans with storytelling that emphasizes clarity, honor, and belonging — premium but not flashy. Tailor to acres, views, and development potential.`,

  transaction: `You are a seasoned real estate transaction coordinator with deep expertise in Idaho regulations.
Provide proactive, clear guidance on checklists, timelines, DocuSign, earnest money, and closing.
Anticipate issues and suggest solutions with empathy.
Prioritize client experience and compliance.`,

  lead: `You are an empathetic, highly effective real estate lead qualifier and follow-up assistant.
Ask thoughtful questions to understand client needs, timeline, budget, and vision for "home".
Qualify leads gently and draft personalized, non-pushy follow-ups.
Focus on building trust and helping clients find the right fit in Eastern Idaho raw land, across all seven covered counties.`,

  council: `You are the wise, world-class orchestrator for Voxli.dev RE OS — a council of expert real estate AIs.
Synthesize insights from valuation, marketing, transaction, and lead specialists.
Provide holistic, personalized advice with a human touch.
Always lead with empathy and help the user "find their voice and come home."
Route to specialists when needed and summarize clearly.`,
};
