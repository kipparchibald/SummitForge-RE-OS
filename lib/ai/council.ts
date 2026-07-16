// World-Class Council - Multi-AI Orchestrator powered by real LLMs
// Trained on deep real estate domain knowledge + Eastern Idaho market data

import { callLLM, SYSTEM_PROMPTS } from './client';
import { marketingAgent } from '../marketing/agent';
import { valuationAgent } from './valuation-agent';
import { queryListings } from '../supabase/client';
// import { transactionCoordinator } from '../transaction/coordinator'; // Uncomment when transaction is stable

export interface UserProfile {
  id: string;
  name: string;
  preferences: {
    communicationStyle: 'professional' | 'friendly' | 'direct';
    focusAreas: string[];
    locationFocus: string;
  };
  history: any[];
}

export class Council {
  private userProfile: UserProfile | null = null;

  setUserProfile(profile: UserProfile) {
    this.userProfile = profile;
  }

  async handleRequest(request: string, context: any = {}) {
    const style = this.userProfile?.preferences.communicationStyle || 'friendly';
    const focus = this.userProfile?.preferences.focusAreas || [];
    const location = this.userProfile?.preferences.locationFocus || 'Jefferson County';

    // Use LLM for intelligent routing + synthesis (world-class orchestration)
    const routingPrompt = `User request: "${request}"
User preferences: ${JSON.stringify(this.userProfile?.preferences || {})}
Available specialists: Marketing, Valuation, Plat/Development, Transaction.

Decide the primary specialist(s) and a short synthesis plan.`;

    const routing = await callLLM(SYSTEM_PROMPTS.council, routingPrompt);

    let response: any = { 
      message: '', 
      actions: [],
      aiRouting: routing 
    };

    const reqLower = request.toLowerCase();

    // Semantic Search with AI support (for import page 'Semantic Search with AI' button + queryListings)
    if (reqLower.includes('semantic search') || reqLower.includes('match listings') || reqLower.includes('search listings') || reqLower.includes('find listings')) {
      const term = (context?.searchTerm || request).replace(/semantic search.*?:/i, '').trim();
      const matches = await queryListings(term, { 
        minAcres: context?.filters?.minAcres, 
        maxPrice: context?.filters?.maxPrice, 
        limit: 12 
      });
      const topMatches = matches.slice(0, 8).map((m: any) => ({
        address: m.address,
        price: m.price,
        acres: m.acres,
        external_id: m.external_id,
        description: (m.description || '').slice(0, 120),
      }));
      const synthesis = await callLLM(
        SYSTEM_PROMPTS.council, 
        `Semantic search term: "${term}". Here are DB matches from queryListings: ${JSON.stringify(topMatches)}. Provide a concise ranked summary of the best matching listings, highlight why they match (MLS, desc keywords, acres etc).`
      );
      return {
        message: this.personalizeMessage(synthesis || 'Here are the top semantic matches.', style),
        matches: topMatches,
        count: topMatches.length,
        searchTerm: term,
        aiRouting: routing,
        source: 'semantic-search-via-queryListings'
      };
    }

    if (reqLower.includes('marketing') || reqLower.includes('promote') || reqLower.includes('content')) {
      const plan = await marketingAgent.generatePlan(context.property || {}, focus);
      const aiMessage = await callLLM(SYSTEM_PROMPTS.marketing, `Synthesize this plan into a warm, personal message for the user: ${JSON.stringify(plan)}`);
      
      response = {
        message: this.personalizeMessage(aiMessage, style),
        plan,
        actions: ['generate_content', 'schedule_campaign'],
        aiRouting: routing
      };
    } 
    else if (reqLower.includes('value') || reqLower.includes('cma') || reqLower.includes('appraisal')) {
      const valuation = await valuationAgent.analyze(context.property || {}, this.userProfile);
      const aiMessage = await callLLM(SYSTEM_PROMPTS.valuation, `Turn this valuation into empathetic, clear advice: ${JSON.stringify(valuation)}`);
      
      response = {
        message: this.personalizeMessage(aiMessage, style),
        valuation,
        actions: ['generate_cma', 'compare_scenarios'],
        aiRouting: routing
      };
    } 
    else if (reqLower.includes('plat') || reqLower.includes('subdivide') || reqLower.includes('development')) {
      response = {
        message: this.personalizeMessage(`For plat and development needs, please use the dedicated development tools in the dashboard.`, style),
        actions: ['use_plat_tool'],
        aiRouting: routing
      };
    } 
    else if (reqLower.includes('transaction') || reqLower.includes('deal') || reqLower.includes('closing')) {
      const txMessage = await callLLM(SYSTEM_PROMPTS.transaction, `User needs help with: ${request}. Current context: ${JSON.stringify(context.transaction || {})}`);
      response = {
        message: this.personalizeMessage(txMessage, style),
        transaction: context.transaction || {},
        actions: ['update_status', 'generate_documents'],
        aiRouting: routing
      };
    } 
    else {
      // World-class default orchestration
      const defaultMessage = await callLLM(
        SYSTEM_PROMPTS.council, 
        `The user said: "${request}". Give a warm, proactive, expert response focused on helping them feel at home in their real estate journey in ${location}.`
      );
      
      response = {
        message: this.personalizeMessage(defaultMessage, style),
        suggestions: this.getProactiveSuggestions(),
        aiRouting: routing
      };
    }

    return response;
  }

  private personalizeMessage(baseMessage: string, style: string): string {
    const name = this.userProfile?.name ? `, ${this.userProfile.name}` : '';
    
    if (style === 'friendly') {
      return `Hey${name}! ${baseMessage}`;
    } else if (style === 'professional') {
      return `Thank you${name}. ${baseMessage}`;
    }
    return baseMessage;
  }

  private getProactiveSuggestions() {
    return [
      "Check new opportunities in your watched areas",
      "Generate a full marketing plan for your latest listing",
      "Run an updated valuation or plat scenario",
      "Review transaction deadlines and next steps"
    ];
  }
}

export const council = new Council();