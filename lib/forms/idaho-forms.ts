// SummitForge RE OS - Idaho REALTOR Forms Population Engine
// Smart auto-population for official Idaho Association of REALTORS forms
// Integrated with Form Simplicity workflow readiness

export interface FormField {
  key: string;
  label: string;
  value: any;
  type: 'text' | 'date' | 'number' | 'boolean' | 'select';
}

export interface PopulatedForm {
  formCode: string;
  formName: string;
  populatedFields: Record<string, any>;
  pdfReady: boolean;
  exportFormat: 'pdf' | 'json' | 'docx';
  notes?: string;
}

export class IdahoFormsEngine {
  private transactionData: any;
  private propertyData: any;
  private buyerData: any;
  private sellerData: any;
  private agentData: any;

  constructor(transaction: any, property: any, buyer: any, seller: any, agent: any) {
    this.transactionData = transaction;
    this.propertyData = property;
    this.buyerData = buyer;
    this.sellerData = seller;
    this.agentData = agent;
  }

  // ==================== PURCHASE AGREEMENTS ====================

  generateRE21(): PopulatedForm {
    return {
      formCode: 'RE-21',
      formName: 'Real Estate Purchase and Sale Agreement',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        agreementDate: this.transactionData.agreementDate || '',
        propertyAddress: this.propertyData.address || '',
        city: this.propertyData.city || '',
        county: this.propertyData.county || 'Jefferson',
        state: 'Idaho',
        zip: this.propertyData.zip || '',
        legalDescription: this.propertyData.legalDescription || '',
        buyerName: this.buyerData.name || '',
        sellerName: this.sellerData.name || '',
        purchasePrice: this.transactionData.purchasePrice || '',
        earnestMoney: this.transactionData.earnestMoney || '',
        closingDate: this.transactionData.closingDate || '',
        financingType: this.transactionData.financingType || 'Conventional',
        inspectionPeriod: this.transactionData.inspectionDays || '10',
      },
      pdfReady: true,
      exportFormat: 'pdf',
      notes: 'Core residential PSA - fully populated from transaction data'
    };
  }

  generateRE24(): PopulatedForm {
    return {
      formCode: 'RE-24',
      formName: 'Vacant Land Purchase and Sale Agreement',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        propertyAddress: this.propertyData.address || '',
        acres: this.propertyData.acres || '',
        zoning: this.propertyData.zoning || '',
        purchasePrice: this.transactionData.purchasePrice || '',
        buyerName: this.buyerData.name || '',
        sellerName: this.sellerData.name || '',
        earnestMoney: this.transactionData.earnestMoney || '',
        closingDate: this.transactionData.closingDate || '',
        wellSeptic: this.propertyData.wellSeptic || 'To be verified',
        access: this.propertyData.access || '',
      },
      pdfReady: true,
      exportFormat: 'pdf',
      notes: 'Optimized for Teton Heights / raw land transactions'
    };
  }

  generateRE22(): PopulatedForm {
    return {
      formCode: 'RE-22',
      formName: 'Pre-Sold New Construction Purchase and Sale Agreement',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        propertyAddress: this.propertyData.address || '',
        lotNumber: this.propertyData.lotNumber || '',
        subdivision: this.propertyData.subdivision || 'Teton Heights',
        buyerName: this.buyerData.name || '',
        sellerName: this.sellerData.name || this.agentData.brokerage || '',
        purchasePrice: this.transactionData.purchasePrice || '',
        plansIncluded: true,
        completionDate: this.transactionData.completionDate || '',
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  generateRE23(): PopulatedForm {
    return {
      formCode: 'RE-23',
      formName: 'Commercial/Investment Purchase and Sale Agreement',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        propertyAddress: this.propertyData.address || '',
        buyerName: this.buyerData.name || '',
        sellerName: this.sellerData.name || '',
        purchasePrice: this.transactionData.purchasePrice || '',
        capRate: this.transactionData.capRate || '',
        noi: this.transactionData.noi || '',
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  // ==================== REPRESENTATION AGREEMENTS ====================

  generateRE14(): PopulatedForm {
    return {
      formCode: 'RE-14',
      formName: 'Buyer Representation Agreement',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        buyerName: this.buyerData.name || '',
        agentName: this.agentData.name || '',
        brokerage: this.agentData.brokerage || 'Archibald-Bagley Real Estate',
        propertyType: this.transactionData.propertyType || 'Residential',
        duration: '6 months',
        compensation: this.transactionData.buyerBrokerCompensation || 'As per offer',
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  generateRE16(): PopulatedForm {
    return {
      formCode: 'RE-16',
      formName: 'Seller Representation Agreement (Exclusive Right to Represent)',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        sellerName: this.sellerData.name || '',
        agentName: this.agentData.name || '',
        brokerage: this.agentData.brokerage || 'Archibald-Bagley Real Estate',
        propertyAddress: this.propertyData.address || '',
        listPrice: this.transactionData.listPrice || this.transactionData.purchasePrice || '',
        commission: this.transactionData.commission || 'As agreed',
        term: '6 months',
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  // ==================== DISCLOSURES ====================

  generateRE25(): PopulatedForm {
    return {
      formCode: 'RE-25',
      formName: "Seller's Property Condition Disclosure",
      populatedFields: {
        sellerName: this.sellerData.name || '',
        propertyAddress: this.propertyData.address || '',
        date: new Date().toLocaleDateString(),
        knownDefects: this.propertyData.knownDefects || 'None disclosed',
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  generateRE25A(): PopulatedForm {
    return {
      formCode: 'RE-25A',
      formName: "Seller's Property Condition Disclosure - Exempt Property",
      populatedFields: {
        sellerName: this.sellerData.name || '',
        propertyAddress: this.propertyData.address || '',
        exemptionReason: this.propertyData.exemptionReason || 'Estate / Court Order / Other',
        date: new Date().toLocaleDateString(),
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  generateRE26(): PopulatedForm {
    return {
      formCode: 'RE-26',
      formName: "Seller's Property Condition Disclosure - New Construction",
      populatedFields: {
        sellerName: this.sellerData.name || this.agentData.brokerage || '',
        propertyAddress: this.propertyData.address || '',
        annexationStatus: this.propertyData.annexationStatus || 'Not in city impact area',
        cityServices: this.propertyData.cityServices || 'No',
        consentToAnnex: this.propertyData.consentToAnnex || 'No',
        date: new Date().toLocaleDateString(),
      },
      pdfReady: true,
      exportFormat: 'pdf',
      notes: 'Critical for Teton Heights new construction lots'
    };
  }

  generateLeadBasedPaint(): PopulatedForm {
    return {
      formCode: 'Lead-Based Paint',
      formName: 'Disclosure of Information on Lead-Based Paint and/or Lead-Based Paint Hazards',
      populatedFields: {
        propertyAddress: this.propertyData.address || '',
        yearBuilt: this.propertyData.yearBuilt || '',
        knownLeadHazards: this.propertyData.knownLeadHazards || 'No known lead-based paint hazards',
        recordsAvailable: this.propertyData.leadRecords || 'No reports or records available',
        buyerAcknowledgment: false,
        date: new Date().toLocaleDateString(),
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  // ==================== WORKFLOW FORMS ====================

  generateRE11(): PopulatedForm {
    return {
      formCode: 'RE-11',
      formName: 'Addendum',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        agreementDate: this.transactionData.agreementDate || '',
        propertyAddress: this.propertyData.address || '',
        buyerName: this.buyerData.name || '',
        sellerName: this.sellerData.name || '',
        addendumText: this.transactionData.addendumText || '',
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  generateRE13(): PopulatedForm {
    return {
      formCode: 'RE-13',
      formName: 'Counter Offer',
      populatedFields: {
        todayDate: new Date().toLocaleDateString(),
        agreementDate: this.transactionData.agreementDate || '',
        propertyAddress: this.propertyData.address || '',
        buyerName: this.buyerData.name || '',
        sellerName: this.sellerData.name || '',
        changes: this.transactionData.counterOfferChanges || '',
        expirationDate: this.transactionData.counterExpiration || '',
      },
      pdfReady: true,
      exportFormat: 'pdf'
    };
  }

  // ==================== MASTER GENERATOR ====================

  generateAllCriticalForms(): PopulatedForm[] {
    return [
      this.generateRE21(),
      this.generateRE24(),
      this.generateRE22(),
      this.generateRE23(),
      this.generateRE14(),
      this.generateRE16(),
      this.generateRE25(),
      this.generateRE25A(),
      this.generateRE26(),
      this.generateLeadBasedPaint(),
      this.generateRE11(),
      this.generateRE13(),
    ];
  }
}

export function createIdahoFormsEngine(transaction: any, property: any, buyer: any, seller: any, agent: any) {
  return new IdahoFormsEngine(transaction, property, buyer, seller, agent);
}