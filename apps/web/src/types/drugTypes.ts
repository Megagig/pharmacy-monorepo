export interface DrugSearchResult {
  success?: boolean;
  data?: {
    drugGroup?: {
      name: string;
      conceptGroup: Array<{
        tty: string;
        conceptProperties: Array<{
          rxcui: string;
          name: string;
          synonym: string;
          tty: string;
          language: string;
          suppress: string;
          umlscui: string;
        }>;
      }>;
    };
  };
}

interface DrugMonographContent {
  section_id: string;
  section_name?: string;
  content_type: string;
  text?: string;
  subsections?: DrugMonographContent[];
}

export interface DrugMonograph {
  SPL?: {
    set_id: string;
    title: string;
    published_date: string;
    content: DrugMonographContent[];
  };
}

export interface DrugInteraction {
  interactionTypeGroup?: Array<{
    interactionType: Array<{
      minConceptItem: {
        rxcui: string;
        name: string;
        tty: string;
      };
      interactionPair: Array<{
        interactionConcept: Array<{
          minConceptItem: {
            rxcui: string;
            name: string;
            tty: string;
          };
          sourceConceptItem: {
            id: string;
            name: string;
            url: string;
          };
        }>;
        severity: string;
        description: string;
      }>;
    }>;
  }>;
}

export interface AdverseEffect {
  meta: {
    disclaimer: string;
    terms: string;
    license: string;
    last_updated: string;
    results: {
      skip: number;
      limit: number;
      total: number;
    };
  };
  results: Array<{
    safetyreportid: string;
    receivedate: string;
    receiptdate: string;
    seriousnessdeath: string;
    seriousnesslifethreatening: string;
    seriousnesshospitalization: string;
    patient: {
      drug: Array<{
        medicinalproduct: string;
        drugcharacterization: string;
        medicinalproductversion: string;
        drugdosagetext: string;
        drugadministrationroute: string;
        drugindication: string;
      }>;
      reaction: Array<{
        reactionmeddrapt: string;
        reactionoutcome: string;
      }>;
    };
  }>;
}

export interface FormularyInfo {
  relatedGroup?: {
    rxCui: string;
    termType: string;
    conceptGroup: Array<{
      tty: string;
      conceptProperties: Array<{
        rxcui: string;
        name: string;
        synonym: string;
        tty: string;
        language: string;
        suppress: string;
        umlscui: string;
      }>;
    }>;
  };
}

export interface Drug {
  rxCui: string;
  name: string;
  dosage?: string;
  frequency?: string;
  route?: string;
  notes?: string;
  monograph?: DrugMonograph;
  interactions?: DrugInteraction;
  adverseEffects?: AdverseEffect;
  formularyInfo?: FormularyInfo;
}

export interface DrugIndication {
  results: Array<{
    indication: string;
    purpose: string;
    patientPopulation?: string;
    usageGuidelines?: string;
  }>;
  source?: string;
  lastUpdated?: string;
}

export interface TherapyPlan {
  _id?: string;
  planName: string;
  drugs: Drug[];
  guidelines?: string;
  createdAt?: string;
  updatedAt?: string;
}
