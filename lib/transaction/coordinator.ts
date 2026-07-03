// Refined Transaction Coordinator for SummitForge
// Handles full transaction workflow with AI assistance

import { createIdahoFormsEngine } from '../forms/idaho-forms';

export interface Transaction {
  id: string;
  propertyId: string;
  status: 'new' | 'under_contract' | 'inspection' | 'appraisal' | 'lending' | 'title' | 'closing' | 'closed';
  buyer?: string;
  seller?: string;
  price: number;
  timeline: {
    showingDate?: string;
    inspectionDate?: string;
    closingDate?: string;
  };
  documents: any[];
  notes: string[];
}

export class TransactionCoordinator {
  private transactions: Map<string, Transaction> = new Map();

  createTransaction(propertyId: string, price: number): Transaction {
    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      propertyId,
      status: 'new',
      price,
      timeline: {},
      documents: [],
      notes: []
    };
    this.transactions.set(tx.id, tx);
    return tx;
  }

  updateStatus(txId: string, status: Transaction['status']): void {
    const tx = this.transactions.get(txId);
    if (tx) {
      tx.status = status;
      this.triggerAIAction(tx);
    }
  }

  private triggerAIAction(tx: Transaction) {
    switch (tx.status) {
      case 'under_contract':
        console.log(`[AI] Generating contract for ${tx.id}`);
        break;
      case 'inspection':
        tx.timeline.inspectionDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        break;
      case 'closing':
        console.log(`[AI] Ordering title report for ${tx.id}`);
        break;
    }
  }

  getTransaction(txId: string): Transaction | undefined {
    return this.transactions.get(txId);
  }

  // ==================== IDAHO FORMS GENERATION ====================

  generateIdahoForm(transactionId: string, formType: string, context: any = {}) {
    const tx = this.transactions.get(transactionId);
    if (!tx) return { success: false, error: 'Transaction not found' };

    const mockProperty = { address: context.address || 'Sample Property', acres: context.acres || 0.6, zoning: 'Residential' };
    const mockBuyer = { name: context.buyerName || 'Buyer Name' };
    const mockSeller = { name: context.sellerName || 'Seller Name' };
    const mockAgent = { name: 'Kipp Archibald', brokerage: 'Archibald-Bagley Real Estate' };

    const engine = createIdahoFormsEngine(tx, mockProperty, mockBuyer, mockSeller, mockAgent);

    let form;
    switch (formType) {
      case 'RE-21': form = engine.generateRE21(); break;
      case 'RE-24': form = engine.generateRE24(); break;
      case 'RE-22': form = engine.generateRE22(); break;
      case 'RE-23': form = engine.generateRE23(); break;
      case 'RE-14': form = engine.generateRE14(); break;
      case 'RE-16': form = engine.generateRE16(); break;
      case 'RE-25': form = engine.generateRE25(); break;
      case 'RE-25A': form = engine.generateRE25A(); break;
      case 'RE-26': form = engine.generateRE26(); break;
      case 'LeadPaint': form = engine.generateLeadBasedPaint(); break;
      case 'RE-11': form = engine.generateRE11(); break;
      case 'RE-13': form = engine.generateRE13(); break;
      case 'all': form = engine.generateAllCriticalForms(); break;
      default: return { success: false, error: 'Unknown form type' };
    }

    if (!tx.documents) tx.documents = [];
    tx.documents.push({ type: formType, generatedAt: new Date().toISOString(), form });

    return { success: true, form };
  }
}