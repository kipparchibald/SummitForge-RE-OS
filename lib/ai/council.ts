// Council - The Central Multi-AI Orchestrator for SummitForge
// Provides world-class, personalized customer experience with a personal touch

import { marketingAgent } from '../marketing/agent';
import { valuationAgent } from './valuation-agent';
import { transactionCoordinator } from '../transaction/coordinator';
import { createPreliminaryPlat } from '../development/plat-creator';

export interface UserProfile {
  id: string;
  name: string;
  preferences: {
    communicationStyle: 'professional' | 'friendly' | 'direct';
    focusAreas: string[]; // e.g., ['raw land', 'builder relations', 'quick closings']
    locationFocus: string; // Jefferson County, etc.
  };
  history: any[]; // Past interactions
}

export class Council {
  private userProfile: UserProfile | null = null;

  setUserProfile(profile: UserProfile) {
    this.userProfile = profile;
  }

  async handleRequest(request: string, context: any = {}) {
    // Personalized routing + synthesis
    const style = this.userProfile?.preferences.communicationStyle || 'friendly';
    const focus = this.userProfile?.preferences.focusAreas || [];

    let response: any = { message: '', actions: [] };

    // Route to specialized agents with personal touch
    if (request.toLowerCase().includes('marketing') || request.toLowerCase().includes('promote')) {
      const plan = await marketingAgent.generatePlan(context.property || {}, focus);
      response = {
        message: this.personalizeMessage(`Here's a tailored marketing plan for you, ${this.userProfile?.name || 'valued partner'}.`, style),
        plan,
        actions: ['generate_content', 'schedule_campaign']
      };
    } 
    else if (request.toLowerCase().includes('value') || request.toLowerCase().includes('cma')) {
      const valuation = await valuationAgent.analyze(context.property || {});
      response = {
        message: this.personalizeMessage(`I've analyzed this property with your preferred approach in mind.`, style),
        valuation,
        actions: ['generate_cma', 'compare_scenarios']
      };
    } 
    else if (request.toLowerCase().includes('plat') || request.toLowerCase().includes('subdivide')) {
      const plat = await createPreliminaryPlat(context.property || {});
      response = {
        message: this.personalizeMessage(`Here's an optimized preliminary plat tailored to your development goals.`, style),
        plat,
        actions: ['refine_lots', 'estimate_costs']
      };
    } 
    else if (request.toLowerCase().includes('transaction') || request.toLowerCase().includes('deal')) {
      response = {
        message: this.personalizeMessage(`I'm tracking your transaction closely and will keep you updated proactively.`, style),
        transaction: context.transaction || {},
        actions: ['update_status', 'generate_documents']
      };
    } 
    else {
      // Default: Proactive, helpful personal assistant
      response = {
        message: this.personalizeMessage(`I'm here to help make your real estate work seamless. What would you like to focus on today?`, style),
        suggestions: this.getProactiveSuggestions()
      };
    }

    // Add personal touch
    if (this.userProfile) {
      response.message += `\n\n(As always, keeping your focus on ${focus.join(', ')} in ${this.userProfile.preferences.locationFocus}.)`;
    }

    return response;
  }

  private personalizeMessage(baseMessage: string, style: string): string {
    if (style === 'friendly') {
      return `Hey there! ${baseMessage} Let's make this easy and successful.`;
    } else if (style === 'professional') {
      return `Thank you for your query. ${baseMessage}`;
    } else {
      return baseMessage;
    }
  }

  private getProactiveSuggestions() {
    return [
      "Check new land opportunities in your watched areas",
      "Generate marketing content for your latest listing",
      "Run valuation on a potential acquisition",
      "Review upcoming transaction deadlines"
    ];
  }
}

export const council = new Council();